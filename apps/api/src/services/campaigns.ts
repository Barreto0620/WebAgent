import { startOfDayInZone } from "@webagent/shared";
import { campaignText, msUntilWindow, randomDelay } from "./campaign-rules";
import { db } from "../lib/supabase";
import { scheduleCampaignTick } from "../queues";
import { queueText } from "./outbound";

/** Monta a lista de destinatários (só opt-in) e coloca a campanha para rodar. */
export async function startCampaign(campaignId: string) {
  const { data: c } = await db.from("campaigns").select("*").eq("id", campaignId).single();
  if (!c) throw new Error("Campanha não encontrada.");
  if (c.status !== "draft") throw new Error("Esta campanha já foi iniciada.");

  let query = db.from("contacts").select("id").eq("system_id", c.system_id).eq("consent_status", "opt_in");
  if (c.audience_tags.length) query = query.overlaps("tags", c.audience_tags);
  const { data: contacts } = await query.limit(20_000);
  if (!contacts?.length) throw new Error("Nenhum contato com consentimento (opt-in) neste público.");

  for (let i = 0; i < contacts.length; i += 500) {
    const chunk = contacts.slice(i, i + 500).map((ct) => ({ campaign_id: c.id, system_id: c.system_id, contact_id: ct.id }));
    const { error } = await db.from("campaign_recipients").upsert(chunk, { onConflict: "campaign_id,contact_id", ignoreDuplicates: true });
    if (error) throw error;
  }

  const future = c.scheduled_at && new Date(c.scheduled_at).getTime() > Date.now();
  await db
    .from("campaigns")
    .update({ status: future ? "scheduled" : "running", total: contacts.length, started_at: future ? null : new Date().toISOString() })
    .eq("id", c.id);
  await scheduleCampaignTick(c.id, future ? new Date(c.scheduled_at!).getTime() - Date.now() : 0);
  return { total: contacts.length };
}

/** Um passo da campanha: envia para 1 destinatário e agenda o próximo com intervalo aleatório. */
export async function campaignTick(campaignId: string) {
  const { data: c } = await db.from("campaigns").select("*, systems!inner(name, timezone)").eq("id", campaignId).single();
  if (!c) return;
  const sys = c.systems as unknown as { name: string; timezone: string };

  if (c.status === "scheduled") {
    await db.from("campaigns").update({ status: "running", started_at: new Date().toISOString() }).eq("id", c.id);
  } else if (c.status !== "running") {
    return; // pausada, cancelada ou concluída
  }

  // Janela de envio (ex.: 09:00–20:00 no fuso do sistema)
  const wait = msUntilWindow(new Date(), sys.timezone, c.window_start, c.window_end);
  if (wait > 0) return scheduleCampaignTick(c.id, wait + 30_000);

  // Limite diário por número (todas as campanhas do sistema)
  const dayStart = startOfDayInZone(new Date(), sys.timezone);
  const { count: sentToday } = await db
    .from("campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("system_id", c.system_id)
    .eq("status", "sent")
    .gte("sent_at", dayStart);
  if ((sentToday ?? 0) >= c.daily_limit) {
    const tomorrow = new Date(new Date(dayStart).getTime() + 86_400_000);
    return scheduleCampaignTick(c.id, tomorrow.getTime() - Date.now() + msUntilWindow(tomorrow, sys.timezone, c.window_start, c.window_end) + 60_000);
  }

  // WhatsApp precisa estar conectado; senão a campanha pausa e avisa no painel
  const { data: channel } = await db.from("channels").select("id").eq("system_id", c.system_id).eq("type", "whatsapp").eq("status", "connected").limit(1).maybeSingle();
  if (!channel) {
    await db.from("campaigns").update({ status: "paused" }).eq("id", c.id);
    return;
  }

  const { data: rcpt } = await db
    .from("campaign_recipients")
    .select("id, contact_id, contacts!inner(name, push_name, consent_status)")
    .eq("campaign_id", c.id)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (!rcpt) {
    await db.from("campaigns").update({ status: "completed", finished_at: new Date().toISOString() }).eq("id", c.id);
    return;
  }

  const contact = rcpt.contacts as unknown as { name: string | null; push_name: string | null; consent_status: string };
  if (contact.consent_status !== "opt_in") {
    // Descadastrou depois que a campanha começou
    await db.from("campaign_recipients").update({ status: "skipped", error: "Contato sem consentimento" }).eq("id", rcpt.id);
    await db.from("campaigns").update({ skipped: c.skipped + 1 }).eq("id", c.id);
    return scheduleCampaignTick(c.id, 1_000);
  }

  try {
    let { data: conv } = await db
      .from("conversations")
      .select("id")
      .eq("channel_id", channel.id)
      .eq("contact_id", rcpt.contact_id)
      .neq("status", "resolved")
      .maybeSingle();
    if (!conv) {
      const { data: protocol, error: pErr } = await db.rpc("next_protocol", { p_system: c.system_id });
      if (pErr || !protocol) throw pErr ?? new Error("Falha ao gerar protocolo");
      const { data, error } = await db
        .from("conversations")
        .insert({ system_id: c.system_id, channel_id: channel.id, contact_id: rcpt.contact_id, protocol, status: "pending", origin: "campaign" })
        .select("id")
        .single();
      if (error) throw error;
      conv = data;
    }
    const messageId = await queueText({
      systemId: c.system_id,
      conversationId: conv.id,
      body: campaignText(c.message, contact, sys.name),
      senderType: "system",
    });
    await db.from("campaign_recipients").update({ status: "sent", message_id: messageId, sent_at: new Date().toISOString() }).eq("id", rcpt.id);
    await db.from("campaigns").update({ sent: c.sent + 1 }).eq("id", c.id);
  } catch (err) {
    await db.from("campaign_recipients").update({ status: "failed", error: err instanceof Error ? err.message.slice(0, 300) : "Falha" }).eq("id", rcpt.id);
    await db.from("campaigns").update({ failed: c.failed + 1 }).eq("id", c.id);
  }

  await scheduleCampaignTick(c.id, randomDelay(c.min_interval_s, c.max_interval_s));
}
