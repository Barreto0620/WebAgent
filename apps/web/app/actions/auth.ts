"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { APP_URL } from "@/lib/env";

export interface FormState {
  error?: string;
  ok?: string;
}

const loginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
  next: z.string().optional(),
});

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    if (error.message.toLowerCase().includes("rate")) return { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
    return { error: "E-mail ou senha incorretos." };
  }
  redirect(safeNext(parsed.data.next));
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { error: "Informe um e-mail válido." };
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? APP_URL;
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${origin}/auth/callback?next=/auth/redefinir` });
  // Mesma resposta exista ou não a conta (evita descobrir e-mails cadastrados)
  return { ok: "Se este e-mail tiver acesso ao WebAgent, você vai receber um link para criar uma nova senha." };
}

const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, "A senha precisa de pelo menos 10 caracteres.")
      .regex(/[A-Za-z]/, "Use pelo menos uma letra.")
      .regex(/[0-9]/, "Use pelo menos um número."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas não conferem.", path: ["confirm"] });

export async function setNewPassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Não foi possível salvar. O link pode ter expirado; peça outro." };
  redirect("/dashboard");
}
