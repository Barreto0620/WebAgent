"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { canManage, getSession } from "@/lib/session";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function audienceCount(tags: string[]): Promise<number> {
  const { supabase, active } = await getSession();
  if (!active) return 0;
  let q = supabase.from("contacts").select("id", { count: "exact", head: true }).eq("system_id", active.id).eq("consent_status", "opt_in");
  if (tags.length) q = q.overlaps("tags", tags);
  const { count } = await q;
  return count ?? 0;
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const schema = z
  .object({
    name: z.string().trim().min(2, "Dê um nome à campanha.").max(80),
    message: z.string().trim().min(2, "Escreva a mensagem.").max(3000, "Mensagem muito longa (máx. 3.000)."),
    audience_tags: z.array(z.string().trim().toLowerCase().min(1)).max(20),
    scheduled_at: z.string().nullable(),
    min_interval_s: z.number().int().min(5).max(600),
    max_interval_s: z.number().int().min(5).max(900),
    daily_limit: z.number().int().min(1).max(2000),
    window_start: time,
    window_end: time,
  })
  .refine((d) => d.max_interval_s >= d.min_interval_s, { message: "Intervalo máximo menor que o mínimo." })
  .refine((d) => d.window_end > d.window_start, { message: "A janela de envio termina antes de começar." })
  .refine((d) => !d.scheduled_at || new Date(d.scheduled_at).getTime() > Date.now() - 60_000, { message: "A data agendada já passou." });

export async function createCampaign(input: unknown, startNow: boolean): Promise<Result<{ id: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { active, role, user } = await getSession();
  if (!active || !canManage(role, "supervisor")) return { ok: false, error: "Sem permissão." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({ ...parsed.data, system_id: active.id, created_by: user.id, status: "draft" })
    .select("id")
    .single();
  if (error) return { ok: false, error: "Não foi possível salvar a campanha." };
  if (startNow) {
    try {
      await apiFetch(`/campaigns/${data.id}/start`, { method: "POST" });
    } catch (e) {
      revalidatePath("/campanhas");
      return { ok: false, error: `Salva como rascunho, mas não iniciou: ${e instanceof Error ? e.message : "erro"}` };
    }
  }
  revalidatePath("/campanhas");
  return { ok: true, data: { id: data.id } };
}

export async function campaignAction(id: string, action: "start" | "pause" | "resume" | "cancel"): Promise<Result> {
  try {
    await apiFetch(`/campaigns/${id}/${action}`, { method: "POST" });
    revalidatePath("/campanhas");
    revalidatePath(`/campanhas/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado." };
  }
}

export async function deleteCampaign(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) return { ok: false, error: "Só rascunhos, canceladas ou concluídas podem ser excluídas." };
  revalidatePath("/campanhas");
  return { ok: true };
}
