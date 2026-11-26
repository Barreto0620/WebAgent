import type { FastifyBaseLogger } from "fastify";
import { db } from "../lib/supabase";
import { previewFor, type InboundMessage } from "../evolution/parse";
import { queueText } from "./outbound";
import { detectConsentKeyword, loadSystemContext, openState, parseCsat, pickGreeting, templateVars } from "./automations";

interface ChannelRow {
  id: string;
  system_id: string;
  instance_name: string;
}

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

async function upsertContact(channel: ChannelRow, msg: InboundMessage) {
  const { data: existing } = await db
    .from("contacts")
    .select("id, name, push_name, consent_status")
    .eq("system_id", channel.system_id)
    .eq("phone", msg.phone)
    .maybeSingle();

  if (existing) {
    if (!msg.fromMe) {
      await db
        .from("contacts")
        .update({ push_name: msg.pushName ?? existing.push_name, last_inbound_at: msg.timestamp.toISOString() })
        .eq("id", existing.id);
    }
    return existing;
  }

  const { data, error } = await db
    .from("contacts")
    .insert({
      system_id: channel.system_id,
      phone: msg.phone,
      push_name: msg.fromMe ? null : (msg.pushName ?? null),
      name: msg.fromMe ? null : (msg.pushName ?? null),
      last_inbound_at: msg.fromMe ? null : msg.timestamp.toISOString(),
    })
    .select("id, name, push_name, consent_status")
    .single();
  if (error) {
    // Corrida entre dois webhooks simultâneos do mesmo contato
    const { data: again } = await db
      .from("contacts")
      .select("id, name, push_name, consent_status")
      .eq("system_id", channel.system_id)
      .eq("phone", msg.phone)
      .single();
    if (!again) throw error;
    return again;
  }
  return data;
}

async function getOrOpenConversation(channel: ChannelRow, contactId: string, outsideHours: boolean) {
  const { data: active } = await db
    .from("conversations")
    .select("id, protocol, status, created_at")
    .eq("channel_id", channel.id)
    .eq("contact_id", contactId)
    .neq("status", "resolved")
    .maybeSingle();
  if (active) return { conversation: active, created: false };

  const { data: protocol, error: pErr } = await db.rpc("next_protocol", { p_system: channel.system_id });
  if (pErr || !protocol) throw pErr ?? new Error("Falha ao gerar protocolo");

  const { data, error } = await db
    .from("conversations")
    .insert({
      system_id: channel.system_id,
      channel_id: channel.id,
      contact_id: contactId,
      protocol,
      status: "queued",
      opened_outside_hours: outsideHours,
    })
    .select("id, protocol, status, created_at")
    .single();
  if (error) {
    const { data: again } = await db
      .from("conversations")
      .select("id, protocol, status, created_at")
      .eq("channel_id", channel.id)
      .eq("contact_id", contactId)
      .neq("status", "resolved")
      .single();
    if (!again) throw error;
    return { conversation: again, created: false };
  }
  return { conversation: data, created: true };
}

async function storeMedia(systemId: string, conversationId: string, msg: InboundMessage) {
  if (!msg.base64 || !msg.mimetype) return null;
  const buffer = Buffer.from(msg.base64, "base64");
  if (buffer.byteLength > MAX_MEDIA_BYTES) return null;
  const ext = msg.mimetype.split("/")[1]?.split(";")[0] ?? "bin";
  const path = `${systemId}/${conversationId}/${msg.externalId}.${ext}`;
  const { error } = await db.storage.from("media").upload(path, buffer, { contentType: msg.mimetype.split(";")[0], upsert: true });
  return error ? null : path;
}

/**
 * Pipeline de uma mensagem recebida:
 * contato → conversa (protocolo) → mensagem → LGPD (SAIR/VOLTAR) → boas-vindas ou fora do horário.
 */
export async function handleInbound(channel: ChannelRow, msg: InboundMessage, log: FastifyBaseLogger) {
  const ctx = await loadSystemContext(channel.system_id);
  const state = openState(ctx, msg.timestamp);
  const contact = await upsertContact(channel, msg);

  // Mensagem enviada pelo próprio celular (ou eco do que a API enviou)
  if (msg.fromMe) {
    const { data: conv } = await db
      .from("conversations")
      .select("id")
      .eq("channel_id", channel.id)
      .eq("contact_id", contact.id)
      .neq("status", "resolved")
      .maybeSingle();
    if (!conv) return;
    // Eco de mensagem enviada pela API: só vincula o ID externo
    const since = new Date(Date.now() - 2 * 60_000).toISOString();
    const { data: echo } = await db
      .from("messages")
      .select("id")
      .eq("conversation_id", conv.id)
      .eq("direction", "out")
      .is("external_id", null)
      .eq("body", msg.body ?? "")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (echo) {
      await db.from("messages").update({ external_id: msg.externalId, status: "sent" }).eq("id", echo.id);
      return;
    }
    await db.from("messages").upsert(
      {
        system_id: channel.system_id,
        conversation_id: conv.id,
        direction: "out",
        sender_type: "agent",
        type: msg.type,
        body: msg.body,
        external_id: msg.externalId,
        status: "sent",
        created_at: msg.timestamp.toISOString(),
      },
      { onConflict: "system_id,external_id", ignoreDuplicates: true },
    );
    return;
  }

  // Resposta à pesquisa de satisfação de uma conversa encerrada (até 24 h depois)
  const score = parseCsat(msg.body);
  if (score !== null) {
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const { data: pendingCsat } = await db
      .from("conversations")
      .select("id")
      .eq("channel_id", channel.id)
      .eq("contact_id", contact.id)
      .eq("status", "resolved")
      .is("csat_score", null)
      .gte("csat_requested_at", since)
      .order("csat_requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pendingCsat) {
      await db
        .from("conversations")
        .update({ csat_score: score, csat_answered_at: new Date().toISOString() })
        .eq("id", pendingCsat.id);
      await db.from("messages").upsert(
        {
          system_id: channel.system_id,
          conversation_id: pendingCsat.id,
          direction: "in",
          sender_type: "contact",
          type: "text",
          body: msg.body,
          external_id: msg.externalId,
          status: "received",
          created_at: msg.timestamp.toISOString(),
        },
        { onConflict: "system_id,external_id", ignoreDuplicates: true },
      );
      await queueText({
        systemId: channel.system_id,
        conversationId: pendingCsat.id,
        body: score >= 4 ? "Obrigado pela avaliação! 💚" : "Obrigado pela avaliação. Vamos usar sua nota para melhorar.",
        senderType: "system",
      });
      return;
    }
  }

  const { conversation, created } = await getOrOpenConversation(channel, contact.id, !state.open);
  const mediaPath = await storeMedia(channel.system_id, conversation.id, msg);

  const { error: insErr, data: inserted } = await db
    .from("messages")
    .upsert(
      {
        system_id: channel.system_id,
        conversation_id: conversation.id,
        direction: "in",
        sender_type: "contact",
        type: msg.type,
        body: msg.body,
        media_path: mediaPath,
        media_mime: msg.mimetype ?? null,
        external_id: msg.externalId,
        status: "received",
        created_at: msg.timestamp.toISOString(),
      },
      { onConflict: "system_id,external_id", ignoreDuplicates: true },
    )
    .select("id");
  if (insErr) throw insErr;
  if (!inserted || inserted.length === 0) {
    log.debug({ externalId: msg.externalId }, "mensagem duplicada ignorada");
    return;
  }

  // Atualiza a conversa (contador de não lidas incrementado no banco para evitar corrida)
  const { data: convNow } = await db.from("conversations").select("unread_count").eq("id", conversation.id).single();
  await db
    .from("conversations")
    .update({
      last_message_at: msg.timestamp.toISOString(),
      last_message_preview: previewFor(msg.type, msg.body),
      unread_count: (convNow?.unread_count ?? 0) + 1,
      ...(conversation.status === "pending" ? { status: "open" as const } : {}),
    })
    .eq("id", conversation.id);

  // LGPD: palavras-chave de consentimento
  const keyword = detectConsentKeyword(msg.body);
  if (keyword) {
    const status = keyword === "opt_out" ? "opt_out" : "opt_in";
    await db
      .from("contacts")
      .update({ consent_status: status, consent_updated_at: new Date().toISOString() })
      .eq("id", contact.id);
    await db.from("consent_events").insert({
      system_id: channel.system_id,
      contact_id: contact.id,
      status,
      source: "keyword",
      evidence: `Mensagem ${msg.externalId}: "${(msg.body ?? "").slice(0, 40)}"`,
    });
    const reply =
      keyword === "opt_out"
        ? ctx.settings.opt_out_message
        : "Pronto! Você voltou a receber nossas mensagens automáticas.";
    await queueText({ systemId: channel.system_id, conversationId: conversation.id, body: reply, senderType: "system" });
    return;
  }

  if (contact.consent_status === "opt_out") return;

  // Boas-vindas ou aviso de fora do horário enquanto a conversa ainda não teve nenhuma resposta
  // (cobre também conversas abertas cuja primeira tentativa falhou)
  const { count: replies } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversation.id)
    .eq("direction", "out");
  if (created || (replies ?? 0) === 0) {
    const vars = templateVars(ctx, contact.name ?? contact.push_name ?? msg.pushName, conversation.protocol);
    const greeting = pickGreeting(ctx, state, vars);
    if (greeting) {
      await queueText({ systemId: channel.system_id, conversationId: conversation.id, body: greeting, senderType: "bot" });
    }
  }
}
