import { startOfDayInZone } from "@webagent/shared";
import { campaignText, msUntilWindow, randomDelay, OPT_OUT_FOOTER } from "./campaign-rules";
import { db } from "../lib/supabase";
import { scheduleCampaignTick } from "../queues";
import { queueText } from "./outbound";
import { evolution } from "../evolution/client";

const DAY = 86_400_000;

interface Followup {
  afterDays: number;
  text: string;
}

/** Monta a lista (campanha opt-in) e coloca a campanha para rodar. Campanhas de leads já têm a lista. */
export async function startCampaign(campaignId: string) {
  const { data: c } = await db.from("campaigns").select("*").eq("id", campaignId).single();
  if (!c) throw new Error("Campanha não encontrada.");
  if (c.status !== "draft") throw new Error("Esta campanha já foi iniciada.");

  let total: number;
  if (c.kind === "leads") {
    const { count } = await db.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "pending");
    total = count ?? 0;
    if (!total) throw new Error("Nenhum lead válido para enviar.");
  } else {
    let query = db.from("contacts").select("id").eq("system_id", c.system_id).eq("consent_status", "opt_in");
    if (c.audience_tags.length) query = query.overlaps("tags", c.audience_tags);
    const { data: contacts } = await query.limit(20_000);
    if (!contacts?.length) throw new Error("Nenhum contato com consentimento (opt-in) neste público.");
    for (let i = 0; i < contacts.length; i += 500) {
      const chunk = contacts.slice(i, i + 500).map((ct) => ({ campaign_id: c.id, system_id: c.system_id, contact_id: ct.id }));
      const { error } = await db.from("campaign_recipients").upsert(chunk, { onConflict: "campaign_id,contact_id", ignoreDuplicates: true });
      if (error) throw error;
    }
    total = contacts.length;
  }

  const future = c.scheduled_at && new Date(c.scheduled_at).getTime() > Date.now();
  await db
    .from("campaigns")
    .update({ status: future ? "scheduled" : "running", total: c.kind === "leads" ? c.total : total, started_at: future ? null : new Date().toISOString() })
    .eq("id", c.id);
  await scheduleCampaignTick(c.id, future ? new Date(c.scheduled_at!).getTime() - Date.now() : 0);
  return { total };
}

async function bump(campaignId: string, field: "sent" | "failed" | "skipped" | "replied" | "opted_out", by = 1) {
  const { data } = await db.from("campaigns").select(field).eq("id", campaignId).single();
  const current = (data as Record<string, number> | null)?.[field] ?? 0;
  await db.from("campaigns").update({ [field]: current + by } as Record<typeof field, number>).eq("id", campaignId);
}

async function conversationFor(systemId: string, channelId: string, contactId: string) {
  const { data: conv } = await db
    .from("conversations")
    .select("id")
    .eq("channel_id", channelId)
    .eq("contact_id", contactId)
    .neq("status", "resolved")
    .maybeSingle();
  if (conv) return conv.id;
  const { data: protocol, error: pErr } = await db.rpc("next_protocol", { p_system: systemId });
  if (pErr || !protocol) throw pErr ?? new Error("Falha ao gerar protocolo");
  const { data, error } = await db
    .from("conversations")
    .insert({ system_id: systemId, channel_id: channelId, contact_id: contactId, protocol, status: "pending", origin: "campaign" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Um passo da campanha: envia 1 mensagem (primeira ou acompanhamento) e agenda o próximo passo. */
export async function campaignTick(campaignId: string) {
  const { data: c } = await db.from("campaigns").select("*, systems!inner(name, timezone)").eq("id", campaignId).single();
  if (!c) return;
  const sys = c.systems as unknown as { name: string; timezone: string };

  if (c.status === "scheduled") {
    await db.from("campaigns").update({ status: "running", started_at: new Date().toISOString() }).eq("id", c.id);
  } else if (c.status !== "running") {
    return;
  }

  const wait = msUntilWindow(new Date(), sys.timezone, c.window_start, c.window_end);
  if (wait > 0) return scheduleCampaignTick(c.id, wait + 30_000);

  // Limite diário por número: conta tudo o que saiu hoje (primeiras mensagens e acompanhamentos)
  const dayStart = startOfDayInZone(new Date(), sys.timezone);
  const { count: sentToday } = await db
    .from("campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("system_id", c.system_id)
    .gte("last_sent_at", dayStart);
  if ((sentToday ?? 0) >= c.daily_limit) {
    const tomorrow = new Date(new Date(dayStart).getTime() + DAY);
    return scheduleCampaignTick(c.id, tomorrow.getTime() - Date.now() + msUntilWindow(tomorrow, sys.timezone, c.window_start, c.window_end) + 60_000);
  }

  const { data: channel } = await db
    .from("channels")
    .select("id, instance_name")
    .eq("system_id", c.system_id)
    .eq("type", "whatsapp")
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();
  if (!channel) {
    await db.from("campaigns").update({ status: "paused" }).eq("id", c.id);
    return;
  }

  const now = new Date().toISOString();
  const select = "id, contact_id, status, step, message, followups, sent_at, next_at, contacts!inner(name, push_name, phone, consent_status)";

  // 1) Acompanhamento vencido (+3 dias, +7 dias...) de quem não respondeu
  let item: any = null;
  let isFollowup = false;
  if (c.followups_enabled) {
    const { data } = await db
      .from("campaign_recipients")
      .select(select)
      .eq("campaign_id", c.id)
      .eq("status", "sent")
      .is("replied_at", null)
      .not("next_at", "is", null)
      .lte("next_at", now)
      .order("next_at")
      .limit(1)
      .maybeSingle();
    if (data) {
      item = data;
      isFollowup = true;
    }
  }
  // 2) Primeira mensagem pendente (respeitando a coluna "Dia", se ativado)
  if (!item) {
    let q = db.from("campaign_recipients").select(select).eq("campaign_id", c.id).eq("status", "pending");
    if (c.respect_day) q = q.or(`send_after.is.null,send_after.lte.${now}`);
    const { data } = await q.order("send_after", { ascending: true, nullsFirst: true }).limit(1).maybeSingle();
    item = data;
  }

  if (!item) {
    // Nada vencido agora: agenda para o próximo item futuro ou encerra
    const [{ data: nextFirst }, { data: nextFu }] = await Promise.all([
      db.from("campaign_recipients").select("send_after").eq("campaign_id", c.id).eq("status", "pending").order("send_after").limit(1).maybeSingle(),
      c.followups_enabled
        ? db.from("campaign_recipients").select("next_at").eq("campaign_id", c.id).eq("status", "sent").is("replied_at", null).not("next_at", "is", null).order("next_at").limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const times = [nextFirst?.send_after, (nextFu as { next_at?: string } | null)?.next_at].filter(Boolean).map((t) => new Date(t as string).getTime());
    if (!times.length) {
      await db.from("campaigns").update({ status: "completed", finished_at: new Date().toISOString() }).eq("id", c.id);
      return;
    }
    return scheduleCampaignTick(c.id, Math.max(60_000, Math.min(...times) - Date.now() + 5_000));
  }

  const contact = item.contacts as { name: string | null; push_name: string | null; phone: string; consent_status: string };
  const followups = (item.followups as Followup[]) ?? [];

  // Quem pediu para não receber nunca recebe (opt-out vale para qualquer campanha)
  const blocked = contact.consent_status === "opt_out" || (c.kind === "optin" && contact.consent_status !== "opt_in");
  if (blocked) {
    await db.from("campaign_recipients").update({ status: isFollowup ? "sent" : "skipped", next_at: null, error: "Contato sem consentimento" }).eq("id", item.id);
    if (!isFollowup) await bump(c.id, "skipped");
    return scheduleCampaignTick(c.id, 1_000);
  }

  // Leads: confere se o número tem WhatsApp antes da primeira mensagem
  if (!isFollowup && c.kind === "leads") {
    try {
      const [check] = await evolution.checkNumbers(channel.instance_name, [contact.phone]);
      if (check && check.exists === false) {
        await db.from("campaign_recipients").update({ status: "skipped", error: "Número sem WhatsApp" }).eq("id", item.id);
        await bump(c.id, "skipped");
        return scheduleCampaignTick(c.id, 2_000);
      }
    } catch {
      // Se a checagem falhar, segue: o envio informa o erro
    }
  }

  let text: string;
  if (isFollowup) {
    text = followups[item.step - 1]?.text ?? "";
  } else if (c.kind === "leads") {
    text = (item.message as string) ?? "";
  } else {
    text = campaignText(c.message, contact, sys.name).replace(OPT_OUT_FOOTER, "");
  }
  text = text.trim();
  if (!text) {
    await db.from("campaign_recipients").update(isFollowup ? { next_at: null } : { status: "skipped", error: "Mensagem vazia na planilha" }).eq("id", item.id);
    if (!isFollowup) await bump(c.id, "skipped");
    return scheduleCampaignTick(c.id, 1_000);
  }
  if (c.append_optout && !isFollowup) text += OPT_OUT_FOOTER;

  try {
    const conversationId = await conversationFor(c.system_id, channel.id, item.contact_id);
    const messageId = await queueText({ systemId: c.system_id, conversationId, body: text, senderType: "system" });
    const sentAt = isFollowup ? (item.sent_at as string) : new Date().toISOString();
    const nextStep = isFollowup ? item.step + 1 : 1;
    const nextFollowup = c.followups_enabled ? followups[nextStep - 1] : undefined;
    await db
      .from("campaign_recipients")
      .update({
        status: "sent",
        step: nextStep,
        last_sent_at: new Date().toISOString(),
        next_at: nextFollowup ? new Date(new Date(sentAt).getTime() + nextFollowup.afterDays * DAY).toISOString() : null,
        ...(isFollowup ? {} : { message_id: messageId, sent_at: sentAt, error: null }),
      })
      .eq("id", item.id);
    if (!isFollowup) await bump(c.id, "sent");
  } catch (err) {
    await db
      .from("campaign_recipients")
      .update(isFollowup ? { next_at: null, error: "Acompanhamento falhou" } : { status: "failed", error: err instanceof Error ? err.message.slice(0, 300) : "Falha" })
      .eq("id", item.id);
    if (!isFollowup) await bump(c.id, "failed");
  }

  await scheduleCampaignTick(c.id, randomDelay(c.min_interval_s, c.max_interval_s));
}

/** Resposta de um contato: interrompe os acompanhamentos pendentes das campanhas. */
export async function onContactReply(systemId: string, contactId: string): Promise<string[]> {
  const { data: rows } = await db
    .from("campaign_recipients")
    .update({ replied_at: new Date().toISOString(), next_at: null })
    .eq("system_id", systemId)
    .eq("contact_id", contactId)
    .is("replied_at", null)
    .gte("step", 1)
    .select("campaign_id");
  const ids = [...new Set((rows ?? []).map((r) => r.campaign_id))];
  for (const id of ids) await bump(id, "replied");
  return ids;
}

/**
 * Lead disse que não tem interesse. Só vale para quem recebeu campanha (cliente do suporte não é afetado).
 * Devolve null se o contato não veio de campanha; senão, a resposta pronta da planilha (ou string vazia).
 */
export async function onLeadNoInterest(systemId: string, contactId: string): Promise<string | null> {
  const { data } = await db
    .from("campaign_recipients")
    .select("campaign_id, row_data, campaigns!inner(mapping)")
    .eq("system_id", systemId)
    .eq("contact_id", contactId)
    .gte("step", 1)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const camp = data.campaigns as unknown as { mapping: { noInterest?: string | null } };
  await bump(data.campaign_id, "opted_out");
  const col = camp.mapping?.noInterest;
  return (col ? (data.row_data as Record<string, string>)[col] : "") || "";
}
