"use server";
import { revalidatePath } from "next/cache";
import { buildLeads, type LeadOptions } from "@webagent/shared";
import { apiFetch } from "@/lib/api";
import { canManage, getSession } from "@/lib/session";
import { parseFromLink, parseUploadedFile, type ParsedSheet } from "@/lib/spreadsheet";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function guard() {
  const s = await getSession();
  if (!s.active || !canManage(s.role, "supervisor")) throw new Error("Sem permissão.");
  return s;
}

/** Lê a planilha enviada (arquivo) ou do link e devolve cabeçalhos e linhas. */
export async function readLeadSource(form: FormData): Promise<Result<ParsedSheet>> {
  try {
    await guard();
    const file = form.get("file");
    const link = String(form.get("link") ?? "").trim();
    if (file instanceof File && file.size > 0) return { ok: true, data: await parseUploadedFile(file) };
    if (link) return { ok: true, data: await parseFromLink(link) };
    return { ok: false, error: "Envie um arquivo ou cole o link da planilha." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível ler a planilha." };
  }
}

export interface LeadCampaignInput {
  name: string;
  sourceName: string | null;
  sourceUrl: string | null;
  mapping: LeadOptions;
  respectDay: boolean;
  followupsEnabled: boolean;
  appendOptout: boolean;
  minIntervalS: number;
  maxIntervalS: number;
  dailyLimit: number;
  windowStart: string;
  windowEnd: string;
  scheduledAt: string | null;
  start: boolean;
  leads: ReturnType<typeof buildLeads>["leads"];
}

export async function createLeadCampaign(input: LeadCampaignInput): Promise<Result<{ id: string; added: number; invalid: number; optedOut: number; started: boolean; startError?: string }>> {
  try {
    const { active } = await guard();
    const r = await apiFetch<{ id: string; added: number; invalid: number; optedOut: number; started: boolean; startError?: string }>("/campaigns/leads", {
      method: "POST",
      body: { ...input, systemId: active!.id, sourceUrl: input.sourceUrl || null },
    });
    revalidatePath("/campanhas");
    return { ok: true, data: r };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado." };
  }
}

/** Relê o link da planilha e acrescenta só as linhas novas. */
export async function syncLeadCampaign(campaignId: string): Promise<Result<{ added: number; alreadyInCampaign: number; invalid: number }>> {
  try {
    const { supabase, active } = await guard();
    const { data: c } = await supabase.from("campaigns").select("id, kind, source_url, mapping").eq("id", campaignId).eq("system_id", active!.id).single();
    if (!c || c.kind !== "leads" || !c.source_url) return { ok: false, error: "Esta campanha não tem link de planilha." };
    const sheet = await parseFromLink(c.source_url);
    const { leads } = buildLeads(sheet.rows, c.mapping as unknown as LeadOptions, new Date(), active!.timezone);
    if (!leads.length) return { ok: false, error: "Nenhuma linha válida no link com o mapeamento desta campanha." };
    const r = await apiFetch<{ added: number; alreadyInCampaign: number; invalid: number }>(`/campaigns/${c.id}/leads`, { method: "POST", body: { leads } });
    revalidatePath(`/campanhas/${c.id}`);
    return { ok: true, data: r };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado." };
  }
}
