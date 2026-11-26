/**
 * Tradução dos eventos de webhook da Evolution para um formato interno.
 * Funções puras: testadas em parse.test.ts.
 */
import { phoneFromJid } from "@webagent/shared";
import type { Enums } from "@webagent/shared";

export interface InboundMessage {
  externalId: string;
  phone: string;
  fromMe: boolean;
  pushName?: string;
  type: Enums<"message_type">;
  body: string | null;
  mimetype?: string;
  base64?: string;
  timestamp: Date;
}

type AnyRecord = Record<string, any>;

/** Ignora grupos, status, canais e transmissões. */
export function isDirectChat(jid: string | undefined): boolean {
  if (!jid) return false;
  return jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid") || jid.endsWith("@c.us");
}

/**
 * Descobre o telefone real. Com o endereçamento LID do WhatsApp, o remoteJid pode vir
 * como "<id>@lid"; nesse caso o número está em remoteJidAlt / senderPn.
 */
export function resolvePhone(key: AnyRecord, data: AnyRecord): string | null {
  const candidates = [key.remoteJid, key.remoteJidAlt, key.senderPn, data.senderPn, key.participantAlt];
  for (const c of candidates) {
    if (typeof c === "string" && c.endsWith("@s.whatsapp.net")) return phoneFromJid(c);
  }
  if (typeof key.remoteJid === "string" && key.remoteJid.endsWith("@c.us")) return phoneFromJid(key.remoteJid);
  return null;
}

export function extractContent(message: AnyRecord | undefined): { type: InboundMessage["type"]; body: string | null; mimetype?: string } {
  if (!message) return { type: "other", body: null };
  if (typeof message.conversation === "string") return { type: "text", body: message.conversation };
  if (message.extendedTextMessage) return { type: "text", body: message.extendedTextMessage.text ?? null };
  if (message.imageMessage) return { type: "image", body: message.imageMessage.caption ?? null, mimetype: message.imageMessage.mimetype };
  if (message.videoMessage) return { type: "video", body: message.videoMessage.caption ?? null, mimetype: message.videoMessage.mimetype };
  if (message.audioMessage) return { type: "audio", body: null, mimetype: message.audioMessage.mimetype };
  if (message.documentMessage)
    return {
      type: "document",
      body: message.documentMessage.caption ?? message.documentMessage.fileName ?? null,
      mimetype: message.documentMessage.mimetype,
    };
  if (message.documentWithCaptionMessage?.message?.documentMessage) {
    const d = message.documentWithCaptionMessage.message.documentMessage;
    return { type: "document", body: d.caption ?? d.fileName ?? null, mimetype: d.mimetype };
  }
  if (message.stickerMessage) return { type: "sticker", body: null, mimetype: message.stickerMessage.mimetype };
  if (message.locationMessage) {
    const l = message.locationMessage;
    return { type: "location", body: `${l.degreesLatitude},${l.degreesLongitude}` };
  }
  if (message.contactMessage) return { type: "contact", body: message.contactMessage.displayName ?? null };
  if (message.buttonsResponseMessage) return { type: "text", body: message.buttonsResponseMessage.selectedDisplayText ?? null };
  if (message.listResponseMessage) return { type: "text", body: message.listResponseMessage.title ?? null };
  return { type: "other", body: null };
}

export function parseMessagesUpsert(data: AnyRecord): InboundMessage | null {
  const key = data?.key;
  if (!key?.id || !isDirectChat(key.remoteJid)) return null;
  if (data.message?.protocolMessage || data.message?.reactionMessage) return null;
  const phone = resolvePhone(key, data);
  if (!phone) return null;
  const content = extractContent(data.message);
  const ts = Number(data.messageTimestamp);
  return {
    externalId: String(key.id),
    phone,
    fromMe: Boolean(key.fromMe),
    pushName: typeof data.pushName === "string" && data.pushName.trim() ? data.pushName.trim() : undefined,
    type: content.type,
    body: content.body,
    mimetype: content.mimetype,
    base64: typeof data.message?.base64 === "string" ? data.message.base64 : undefined,
    timestamp: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : new Date(),
  };
}

const STATUS_MAP: Record<string, Enums<"message_status">> = {
  PENDING: "queued",
  SERVER_ACK: "sent",
  DELIVERY_ACK: "delivered",
  READ: "read",
  PLAYED: "read",
  ERROR: "failed",
};

export function parseMessageStatus(data: AnyRecord): { externalId: string; status: Enums<"message_status"> } | null {
  const id = data?.keyId ?? data?.key?.id ?? data?.messageId;
  const raw = String(data?.status ?? "").toUpperCase();
  const status = STATUS_MAP[raw];
  if (!id || !status) return null;
  return { externalId: String(id), status };
}

export function parseConnection(data: AnyRecord): { state: "open" | "close" | "connecting"; phone?: string; profileName?: string; picture?: string } | null {
  const state = data?.state;
  if (state !== "open" && state !== "close" && state !== "connecting") return null;
  return {
    state,
    phone: typeof data.wuid === "string" ? phoneFromJid(data.wuid) : undefined,
    profileName: typeof data.profileName === "string" ? data.profileName : undefined,
    picture: typeof data.profilePictureUrl === "string" ? data.profilePictureUrl : undefined,
  };
}

/** Texto curto para a lista de conversas. */
export function previewFor(type: InboundMessage["type"], body: string | null): string {
  const labels: Record<string, string> = {
    image: "📷 Imagem",
    video: "🎬 Vídeo",
    audio: "🎤 Áudio",
    document: "📄 Documento",
    sticker: "Figurinha",
    location: "📍 Localização",
    contact: "👤 Contato",
    other: "Mensagem",
  };
  const text = body?.trim();
  if (type === "text") return (text ?? "").slice(0, 140);
  return text ? `${labels[type]} · ${text.slice(0, 100)}` : (labels[type] ?? "Mensagem");
}
