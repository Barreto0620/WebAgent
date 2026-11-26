import type { Enums } from "@webagent/shared";

export interface InboxContact {
  id: string;
  name: string | null;
  push_name: string | null;
  phone: string;
  email: string | null;
  notes: string | null;
  tags: string[];
  consent_status: Enums<"consent_status">;
}

export interface InboxConversation {
  id: string;
  protocol: string;
  status: Enums<"conversation_status">;
  assignee_id: string | null;
  unread_count: number;
  last_message_at: string;
  last_message_preview: string | null;
  created_at: string;
  opened_outside_hours: boolean;
  contact: InboxContact;
}

export interface InboxMessage {
  id: string;
  direction: Enums<"message_direction">;
  sender_type: Enums<"sender_type">;
  sender_id: string | null;
  type: Enums<"message_type">;
  body: string | null;
  media_path: string | null;
  media_mime: string | null;
  status: Enums<"message_status">;
  error: string | null;
  is_internal: boolean;
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  avatar: string | null;
}

export interface QuickReply {
  id: string;
  shortcut: string;
  title: string;
  body: string;
}

export const CONVERSATION_SELECT =
  "id, protocol, status, assignee_id, unread_count, last_message_at, last_message_preview, created_at, opened_outside_hours, contact:contacts!inner(id, name, push_name, phone, email, notes, tags, consent_status)";

export const MESSAGE_SELECT = "id, direction, sender_type, sender_id, type, body, media_path, media_mime, status, error, is_internal, created_at";

export const STATUS_LABEL: Record<Enums<"conversation_status">, { label: string; tone: "warning" | "success" | "info" | "neutral" }> = {
  bot: { label: "Bot", tone: "info" },
  queued: { label: "Na fila", tone: "warning" },
  open: { label: "Em atendimento", tone: "success" },
  pending: { label: "Pendente", tone: "info" },
  resolved: { label: "Resolvida", tone: "neutral" },
};

export function contactName(c: Pick<InboxContact, "name" | "push_name">) {
  return c.name || c.push_name || "Sem nome";
}
