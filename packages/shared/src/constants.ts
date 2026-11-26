export const SYSTEM_ROLES = ["admin", "supervisor", "agent"] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const CHANNEL_TYPES = ["whatsapp", "instagram", "facebook", "tiktok"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const CHANNEL_STATUS = ["disconnected", "connecting", "connected", "error"] as const;
export type ChannelStatus = (typeof CHANNEL_STATUS)[number];

export const CONVERSATION_STATUS = ["bot", "queued", "open", "pending", "resolved"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUS)[number];

export const CONSENT_STATUS = ["unknown", "opt_in", "opt_out"] as const;
export type ConsentStatus = (typeof CONSENT_STATUS)[number];

/** Palavras que, recebidas sozinhas, registram opt-out (LGPD). */
export const OPT_OUT_KEYWORDS = ["sair", "parar", "stop", "cancelar", "descadastrar"];

export const COOKIE_CONSENT_VERSION = "2026-11";
export const ACTIVE_SYSTEM_COOKIE = "wa_system";
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";
