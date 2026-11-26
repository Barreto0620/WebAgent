import type { Enums } from "@webagent/shared";
import { db } from "../lib/supabase";
import { enqueueOutbound } from "../queues";
import { evolution } from "../evolution/client";

interface QueueTextParams {
  systemId: string;
  conversationId: string;
  body: string;
  senderType: Extract<Enums<"sender_type">, "agent" | "bot" | "system">;
  senderId?: string | null;
}

/** Registra a mensagem como "queued" e agenda o envio. A fila garante intervalo entre envios. */
export async function queueText(p: QueueTextParams) {
  const { data, error } = await db
    .from("messages")
    .insert({
      system_id: p.systemId,
      conversation_id: p.conversationId,
      direction: "out",
      sender_type: p.senderType,
      sender_id: p.senderId ?? null,
      type: "text",
      body: p.body,
      status: "queued",
    })
    .select("id")
    .single();
  if (error) throw error;

  await db
    .from("conversations")
    .update({ last_message_at: new Date().toISOString(), last_message_preview: p.body.slice(0, 140) })
    .eq("id", p.conversationId);

  await enqueueOutbound(data.id);
  return data.id;
}

/** Executado pelo worker: envia de fato pela Evolution. */
export async function deliverMessage(messageId: string) {
  const { data: msg, error } = await db
    .from("messages")
    .select("id, body, status, conversation_id, conversations!inner(id, channel_id, contacts!inner(phone), channels!inner(instance_name, status))")
    .eq("id", messageId)
    .single();
  if (error || !msg) throw new Error(`Mensagem ${messageId} não encontrada`);
  if (msg.status !== "queued" && msg.status !== "failed") return; // já enviada

  const conv = msg.conversations as unknown as {
    contacts: { phone: string };
    channels: { instance_name: string; status: string };
  };
  if (conv.channels.status !== "connected") {
    throw new Error("WhatsApp desconectado. A mensagem será reenviada quando o número reconectar.");
  }

  try {
    const res = await evolution.sendText(conv.channels.instance_name, conv.contacts.phone, msg.body ?? "");
    await db
      .from("messages")
      .update({ status: "sent", external_id: res.key?.id ?? null, error: null })
      .eq("id", messageId);
  } catch (err) {
    await db
      .from("messages")
      .update({ status: "failed", error: err instanceof Error ? err.message.slice(0, 500) : "Falha no envio" })
      .eq("id", messageId);
    throw err;
  }
}
