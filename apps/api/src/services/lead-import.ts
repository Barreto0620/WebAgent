import { z } from "zod";
import { normalizePhone } from "@webagent/shared";
import { db } from "../lib/supabase";

export const leadSchema = z.object({
  phone: z.string().max(40),
  name: z.string().max(120).nullable(),
  message: z.string().max(4000),
  sendAfter: z.string().nullable(),
  followups: z.array(z.object({ afterDays: z.number().int().min(1).max(60), text: z.string().max(4000) })).max(5),
  row: z.record(z.string(), z.string().max(5000)),
});
export type LeadInput = z.infer<typeof leadSchema>;

/**
 * Cria/atualiza os contatos e adiciona os leads à campanha.
 * Ignora telefones inválidos, repetidos e quem já pediu para não receber.
 */
export async function addLeads(campaign: { id: string; system_id: string }, leads: LeadInput[], tag: string) {
  const seen = new Set<string>();
  const valid: (LeadInput & { phoneE164: string })[] = [];
  let invalid = 0;
  for (const l of leads) {
    const p = normalizePhone(l.phone);
    if (!p) {
      invalid++;
      continue;
    }
    if (seen.has(p)) continue;
    seen.add(p);
    valid.push({ ...l, phoneE164: p });
  }

  const { data: already } = await db.from("campaign_recipients").select("contacts!inner(phone)").eq("campaign_id", campaign.id).limit(20_000);
  const inCampaign = new Set((already ?? []).map((r) => (r.contacts as unknown as { phone: string }).phone));
  const fresh = valid.filter((l) => !inCampaign.has(l.phoneE164));

  let added = 0;
  let optedOut = 0;
  for (let i = 0; i < fresh.length; i += 200) {
    const chunk = fresh.slice(i, i + 200);
    const phones = chunk.map((l) => l.phoneE164);
    const { data: existing } = await db.from("contacts").select("id, phone, tags, consent_status, name").eq("system_id", campaign.system_id).in("phone", phones);
    const byPhone = new Map((existing ?? []).map((c) => [c.phone, c]));

    const toCreate = chunk.filter((l) => !byPhone.has(l.phoneE164));
    if (toCreate.length) {
      const { data: created, error } = await db
        .from("contacts")
        .insert(toCreate.map((l) => ({ system_id: campaign.system_id, phone: l.phoneE164, name: l.name?.slice(0, 120) || null, tags: ["lead", tag] })))
        .select("id, phone, tags, consent_status, name");
      if (error) throw error;
      for (const c of created ?? []) byPhone.set(c.phone, c);
    }
    // Etiqueta os contatos que já existiam
    for (const c of existing ?? []) {
      if (!c.tags.includes(tag)) await db.from("contacts").update({ tags: [...new Set([...c.tags, "lead", tag])] }).eq("id", c.id);
    }

    const rows = chunk.map((l) => {
      const contact = byPhone.get(l.phoneE164)!;
      const blocked = contact.consent_status === "opt_out";
      if (blocked) optedOut++;
      return {
        campaign_id: campaign.id,
        system_id: campaign.system_id,
        contact_id: contact.id,
        lead_name: l.name,
        message: l.message,
        followups: l.followups,
        row_data: l.row,
        send_after: l.sendAfter,
        status: blocked ? ("skipped" as const) : ("pending" as const),
        error: blocked ? "Pediu para não receber mensagens" : null,
      };
    });
    const { error } = await db.from("campaign_recipients").upsert(rows, { onConflict: "campaign_id,contact_id", ignoreDuplicates: true });
    if (error) throw error;
    added += rows.length;
  }

  const { count: total } = await db.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id);
  const { count: skipped } = await db.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("status", "skipped");
  await db.from("campaigns").update({ total: total ?? 0, skipped: skipped ?? 0 }).eq("id", campaign.id);
  return { added, invalid, duplicates: leads.length - invalid - valid.length, alreadyInCampaign: valid.length - fresh.length, optedOut };
}
