"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizePhone } from "@webagent/shared";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { canManage, getSession } from "@/lib/session";

type Result = { ok: true } | { ok: false; error: string };

const requestSchema = z.object({
  requester_name: z.string().trim().min(2, "Informe o nome do titular.").max(120),
  requester_contact: z.string().trim().min(5, "Informe telefone ou e-mail para resposta.").max(120),
  type: z.enum(["access", "correction", "deletion", "portability", "revocation"]),
  notes: z.string().trim().max(2000).optional(),
  phone: z.string().optional(),
});

export async function createDataRequest(input: unknown): Promise<Result> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { active, role, user } = await getSession();
  if (!active || !canManage(role, "supervisor")) return { ok: false, error: "Sem permissão." };
  const supabase = await createClient();
  let contactId: string | null = null;
  if (parsed.data.phone) {
    const phone = normalizePhone(parsed.data.phone);
    if (phone) {
      const { data } = await supabase.from("contacts").select("id").eq("system_id", active.id).eq("phone", phone).maybeSingle();
      contactId = data?.id ?? null;
    }
  }
  const { error } = await supabase.from("data_requests").insert({
    system_id: active.id,
    contact_id: contactId,
    requester_name: parsed.data.requester_name,
    requester_contact: parsed.data.requester_contact,
    type: parsed.data.type,
    notes: parsed.data.notes || null,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Não foi possível registrar o pedido." };
  revalidatePath("/privacidade-dados");
  return { ok: true };
}

export async function updateDataRequest(id: string, status: "open" | "in_progress" | "done" | "rejected"): Promise<Result> {
  const { active, role } = await getSession();
  if (!active || !canManage(role, "supervisor")) return { ok: false, error: "Sem permissão." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("data_requests")
    .update({ status, resolved_at: status === "done" || status === "rejected" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("system_id", active.id);
  if (error) return { ok: false, error: "Não foi possível atualizar." };
  revalidatePath("/privacidade-dados");
  return { ok: true };
}

export async function findContactByPhone(raw: string): Promise<{ ok: true; contact: { id: string; name: string | null; push_name: string | null; consent_status: string } | null } | { ok: false; error: string }> {
  const phone = normalizePhone(raw);
  if (!phone) return { ok: false, error: "Telefone inválido." };
  const { active } = await getSession();
  if (!active) return { ok: false, error: "Selecione um sistema." };
  const supabase = await createClient();
  const { data } = await supabase.from("contacts").select("id, name, push_name, consent_status").eq("system_id", active.id).eq("phone", phone).maybeSingle();
  return { ok: true, contact: data ?? null };
}

export async function anonymizeContact(contactId: string, confirmation: string): Promise<Result> {
  if (confirmation.trim().toUpperCase() !== "ANONIMIZAR") return { ok: false, error: "Digite ANONIMIZAR para confirmar." };
  try {
    await apiFetch(`/privacy/contacts/${contactId}/anonymize`, { method: "POST" });
    revalidatePath("/privacidade-dados");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado." };
  }
}

export async function saveRetention(days: number): Promise<Result> {
  if (!Number.isInteger(days) || days < 30 || days > 3650) return { ok: false, error: "Use entre 30 e 3.650 dias." };
  const { active, role } = await getSession();
  if (!active || !canManage(role, "admin")) return { ok: false, error: "Só administradores alteram a retenção." };
  const supabase = await createClient();
  const { error } = await supabase.from("system_settings").update({ retention_days: days }).eq("system_id", active.id);
  if (error) return { ok: false, error: "Não foi possível salvar." };
  await supabase.rpc("log_audit", { p_system: active.id, p_action: "privacy.retention_change", p_entity: "system_settings", p_entity_id: active.id, p_metadata: { days } });
  revalidatePath("/privacidade-dados");
  return { ok: true };
}
