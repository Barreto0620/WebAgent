"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { canManage, getSession } from "@/lib/session";

type Result = { ok: true } | { ok: false; error: string };

const mediaSchema = z.object({
  path: z.string().min(10).max(300),
  mime: z.string().max(60),
  kind: z.enum(["image", "video"]),
  size: z.number().int().nonnegative(),
});

const schema = z.object({
  id: z.uuid(),
  caption: z.string().max(5000, "Legenda muito longa."),
  hashtags: z.array(z.string().max(100)).max(60),
  media: z.array(mediaSchema).max(10, "No máximo 10 arquivos."),
  accountIds: z.array(z.uuid()).max(20),
});

/** Cria ou atualiza o rascunho e as contas de destino. */
export async function saveDraft(input: unknown): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const { active, role, user } = await getSession();
  if (!active || !canManage(role, "supervisor")) return { ok: false, error: "Sem permissão." };
  if (d.media.some((m) => !m.path.startsWith(`${active.id}/${d.id}/`))) return { ok: false, error: "Arquivo inválido." };
  const supabase = await createClient();

  const { data: existing } = await supabase.from("posts").select("id, status").eq("id", d.id).maybeSingle();
  if (existing && existing.status !== "draft") return { ok: false, error: "Só rascunhos podem ser editados." };
  const row = { caption: d.caption, hashtags: d.hashtags, media: d.media };
  const { error } = existing
    ? await supabase.from("posts").update(row).eq("id", d.id)
    : await supabase.from("posts").insert({ ...row, id: d.id, system_id: active.id, created_by: user.id, status: "draft" });
  if (error) return { ok: false, error: "Não foi possível salvar o rascunho." };

  await supabase.from("post_targets").delete().eq("post_id", d.id);
  if (d.accountIds.length) {
    const { error: tErr } = await supabase.from("post_targets").insert(d.accountIds.map((account_id) => ({ post_id: d.id, system_id: active.id, account_id })));
    if (tErr) return { ok: false, error: "Não foi possível salvar as contas de destino." };
  }
  revalidatePath("/publicacoes");
  return { ok: true };
}

async function call(path: string, body?: unknown): Promise<Result> {
  try {
    await apiFetch(path, { method: "POST", body });
    revalidatePath("/publicacoes");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado." };
  }
}

export async function schedulePost(id: string, scheduledAt: string | null) {
  return call(`/posts/${id}/schedule`, { scheduledAt });
}
export async function cancelPost(id: string) {
  return call(`/posts/${id}/cancel`);
}
export async function retryPost(id: string) {
  return call(`/posts/${id}/retry`);
}

export async function deletePost(id: string): Promise<Result> {
  const { active, role } = await getSession();
  if (!active || !canManage(role, "supervisor")) return { ok: false, error: "Sem permissão." };
  const supabase = await createClient();
  const { data: post } = await supabase.from("posts").select("media").eq("id", id).maybeSingle();
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) return { ok: false, error: "Cancele o agendamento antes de excluir." };
  const paths = ((post?.media as { path: string }[] | null) ?? []).map((m) => m.path);
  if (paths.length) await supabase.storage.from("social").remove(paths);
  revalidatePath("/publicacoes");
  return { ok: true };
}
