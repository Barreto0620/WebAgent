"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizePhone } from "@webagent/shared";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";

export async function createContact(input: { name: string; phone: string; tags: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "Telefone inválido. Use DDD + número, ex.: (11) 99876-4321." };
  const name = z.string().trim().max(120).parse(input.name);
  const tags = input.tags.split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean).slice(0, 20);
  const { active } = await getSession();
  if (!active) return { ok: false, error: "Selecione um sistema." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("contacts").insert({ system_id: active.id, phone, name: name || null, tags }).select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? "Este número já está cadastrado neste sistema." : "Não foi possível salvar." };
  revalidatePath("/contatos");
  return { ok: true, id: data.id };
}

export async function startConversation(contactId: string, body: string): Promise<{ ok: true; conversationId: string } | { ok: false; error: string }> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Escreva a mensagem." };
  try {
    const r = await apiFetch<{ conversationId: string }>(`/contacts/${contactId}/conversations`, { method: "POST", body: { body: text } });
    return { ok: true, conversationId: r.conversationId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado." };
  }
}
