"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

export async function setTheme(theme: "dark" | "light") {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("profiles").update({ theme }).eq("id", data.user.id);
  const store = await cookies();
  // Cookie de preferência só se a pessoa permitiu no aviso de cookies
  const consent = store.get("wa_consent")?.value ?? "";
  if (consent.endsWith(":p")) {
    store.set("wa_theme", theme, { maxAge: 60 * 60 * 24 * 365, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  }
}

const nameSchema = z.object({ full_name: z.string().trim().min(2, "Informe seu nome.").max(120) });

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const parsed = nameSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Sessão expirada." };
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.full_name }).eq("id", data.user.id);
  if (error) return { error: "Não foi possível salvar. Tente de novo." };
  revalidatePath("/", "layout");
  return { ok: "Nome atualizado." };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Informe a senha atual."),
    password: z
      .string()
      .min(10, "A nova senha precisa de pelo menos 10 caracteres.")
      .regex(/[A-Za-z]/, "Use pelo menos uma letra.")
      .regex(/[0-9]/, "Use pelo menos um número."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas novas não conferem.", path: ["confirm"] })
  .refine((d) => d.password !== d.current, { message: "A nova senha precisa ser diferente da atual.", path: ["password"] });

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return { error: "Sessão expirada." };

  // Confirma a senha atual antes de trocar
  const check = await supabase.auth.signInWithPassword({ email: data.user.email, password: parsed.data.current });
  if (check.error) return { error: "Senha atual incorreta." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Não foi possível trocar a senha. Tente de novo." };
  await supabase.rpc("log_audit", { p_system: null as unknown as string, p_action: "profile.password_change", p_entity: "profile", p_entity_id: data.user.id });
  return { ok: "Senha alterada." };
}
