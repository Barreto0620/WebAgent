"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canManage, getSession } from "@/lib/session";

type Result = { ok: true } | { ok: false; error: string };

const schema = z.object({
  shortcut: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,30}$/, "Atalho: 2 a 30 letras minúsculas, números, - ou _."),
  title: z.string().trim().min(2, "Informe um título.").max(60),
  body: z.string().trim().min(2, "Escreva a mensagem.").max(4096),
});

export async function saveQuickReply(id: string | null, input: unknown): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { active, role, user } = await getSession();
  if (!active || !canManage(role, "supervisor")) return { ok: false, error: "Sem permissão." };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("quick_replies").update(parsed.data).eq("id", id).eq("system_id", active.id)
    : await supabase.from("quick_replies").insert({ ...parsed.data, system_id: active.id, created_by: user.id });
  if (error) return { ok: false, error: error.code === "23505" ? "Já existe uma resposta com este atalho." : "Não foi possível salvar." };
  revalidatePath("/respostas-rapidas");
  return { ok: true };
}

export async function deleteQuickReply(id: string): Promise<Result> {
  const { active, role } = await getSession();
  if (!active || !canManage(role, "supervisor")) return { ok: false, error: "Sem permissão." };
  const supabase = await createClient();
  const { error } = await supabase.from("quick_replies").delete().eq("id", id).eq("system_id", active.id);
  if (error) return { ok: false, error: "Não foi possível excluir." };
  revalidatePath("/respostas-rapidas");
  return { ok: true };
}
