"use server";
import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

async function run(fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado." };
  }
}

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sessão expirada. Entre novamente.");
  return { supabase, userId: data.user.id };
}

async function audit(systemId: string, action: string, entity: string, entityId: string, metadata: Record<string, unknown> = {}) {
  const supabase = await createClient();
  await supabase.rpc("log_audit", { p_system: systemId, p_action: action, p_entity: entity, p_entity_id: entityId, p_metadata: metadata as never });
}

const bodySchema = z.string().trim().min(1, "Mensagem vazia.").max(4096, "Mensagem muito longa (máx. 4.096).");

export async function sendMessage(conversationId: string, body: string): Promise<Result> {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  return run(() => apiFetch(`/conversations/${conversationId}/messages`, { method: "POST", body: { body: parsed.data } }));
}

export async function resolveConversation(conversationId: string): Promise<Result> {
  return run(() => apiFetch(`/conversations/${conversationId}/resolve`, { method: "POST" }));
}

export async function retryMessage(messageId: string): Promise<Result> {
  return run(() => apiFetch(`/messages/${messageId}/retry`, { method: "POST" }));
}

/** Assumir (assignee = eu) ou transferir para outro membro. */
export async function assignConversation(conversationId: string, assigneeId: string | null): Promise<Result> {
  return run(async () => {
    const { supabase, userId } = await me();
    const target = assigneeId ?? userId;
    const { data, error } = await supabase
      .from("conversations")
      .update({ assignee_id: target, status: "open" })
      .eq("id", conversationId)
      .select("system_id")
      .single();
    if (error) throw new Error("Não foi possível atribuir a conversa.");
    await audit(data.system_id, target === userId ? "conversation.assume" : "conversation.transfer", "conversation", conversationId, { to: target });
  });
}

export async function setConversationStatus(conversationId: string, status: "pending" | "open" | "queued"): Promise<Result> {
  return run(async () => {
    const { supabase } = await me();
    const { error } = await supabase.from("conversations").update({ status }).eq("id", conversationId);
    if (error) throw new Error("Não foi possível alterar o status.");
  });
}

/** Reabre uma conversa resolvida (se o contato não tiver outra aberta no mesmo canal). */
export async function reopenConversation(conversationId: string): Promise<Result> {
  return run(async () => {
    const { supabase, userId } = await me();
    const { error } = await supabase
      .from("conversations")
      .update({ status: "open", resolved_at: null, assignee_id: userId })
      .eq("id", conversationId);
    if (error) {
      if (error.code === "23505") throw new Error("Este contato já tem outra conversa aberta.");
      throw new Error("Não foi possível reabrir.");
    }
  });
}

export async function markRead(conversationId: string): Promise<void> {
  const { supabase } = await me();
  await supabase.from("conversations").update({ unread_count: 0 }).eq("id", conversationId).gt("unread_count", 0);
}

export async function addInternalNote(conversationId: string, systemId: string, body: string): Promise<Result> {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  return run(async () => {
    const { supabase, userId } = await me();
    const { error } = await supabase.from("messages").insert({
      system_id: systemId,
      conversation_id: conversationId,
      direction: "out",
      sender_type: "agent",
      sender_id: userId,
      type: "text",
      body: parsed.data,
      status: "sent",
      is_internal: true,
    });
    if (error) throw new Error("Não foi possível salvar a nota.");
  });
}

const contactSchema = z.object({
  name: z.string().trim().max(120).nullable(),
  email: z.union([z.email("E-mail inválido."), z.literal("")]).nullable(),
  notes: z.string().trim().max(2000).nullable(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(20),
});

export async function updateContact(contactId: string, input: unknown): Promise<Result> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  return run(async () => {
    const { supabase } = await me();
    const { error } = await supabase
      .from("contacts")
      .update({
        name: parsed.data.name || null,
        email: parsed.data.email || null,
        notes: parsed.data.notes || null,
        tags: [...new Set(parsed.data.tags)],
      })
      .eq("id", contactId);
    if (error) throw new Error("Não foi possível salvar o contato.");
  });
}

/** Registra consentimento informado pelo atendente (fica no histórico imutável). */
export async function setConsent(contactId: string, systemId: string, status: "opt_in" | "opt_out", evidence: string): Promise<Result> {
  const ev = evidence.trim();
  if (ev.length < 5) return { ok: false, error: "Descreva como o consentimento foi obtido (ex.: “pediu por mensagem em 26/11”)." };
  return run(async () => {
    const { supabase, userId } = await me();
    const { error: e1 } = await supabase.from("consent_events").insert({
      system_id: systemId,
      contact_id: contactId,
      status,
      source: "agent",
      evidence: ev.slice(0, 300),
      actor_id: userId,
    });
    if (e1) throw new Error("Não foi possível registrar o consentimento.");
    const { error: e2 } = await supabase
      .from("contacts")
      .update({ consent_status: status, consent_updated_at: new Date().toISOString() })
      .eq("id", contactId);
    if (e2) throw new Error("Não foi possível atualizar o contato.");
  });
}

/** Mostra o telefone completo e registra na auditoria quem viu (LGPD). */
export async function revealPhone(contactId: string): Promise<{ ok: true; phone: string } | { ok: false; error: string }> {
  try {
    const { supabase } = await me();
    const { data, error } = await supabase.from("contacts").select("phone, system_id").eq("id", contactId).single();
    if (error || !data) return { ok: false, error: "Contato não encontrado." };
    await audit(data.system_id, "contact.reveal_phone", "contact", contactId);
    return { ok: true, phone: data.phone };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado." };
  }
}
