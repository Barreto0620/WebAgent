"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, "Identificador inválido."),
  protocol_prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,5}$/, "Prefixo inválido."),
  description: z.string().trim().max(280).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export async function createSystem(_: FormState, form: FormData): Promise<FormState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sessão expirada." };
  const { error } = await supabase.from("systems").insert({ ...parsed.data, description: parsed.data.description || null, created_by: auth.user.id });
  if (error) {
    if (error.code === "23505") return { error: "Já existe um sistema com este identificador." };
    if (error.code === "42501") return { error: "Só administradores da plataforma podem criar sistemas." };
    return { error: "Não foi possível criar o sistema." };
  }
  revalidatePath("/", "layout");
  return { ok: `Sistema ${parsed.data.name} criado com horário padrão seg. a sex., 08h–18h.` };
}
