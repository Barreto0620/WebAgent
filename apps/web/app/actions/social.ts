"use server";
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { canManage, getSession } from "@/lib/session";

export async function socialProviders(): Promise<{ meta: boolean; tiktok: boolean }> {
  try {
    return await apiFetch<{ meta: boolean; tiktok: boolean }>("/social/providers");
  } catch {
    return { meta: false, tiktok: false };
  }
}

export async function socialAuthUrl(provider: "meta" | "tiktok"): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { active } = await getSession();
  if (!active) return { ok: false, error: "Selecione um sistema." };
  try {
    const r = await apiFetch<{ url: string }>(`/social/${provider}/auth-url`, { method: "POST", body: { systemId: active.id } });
    return { ok: true, url: r.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado." };
  }
}

export async function disconnectSocial(accountId: string): Promise<{ ok: boolean; error?: string }> {
  const { active, role } = await getSession();
  if (!active || !canManage(role, "admin")) return { ok: false, error: "Sem permissão." };
  const supabase = await createClient();
  const { error } = await supabase.from("social_accounts").delete().eq("id", accountId).eq("system_id", active.id);
  if (error) return { ok: false, error: "Não foi possível desconectar." };
  revalidatePath("/canais");
  return { ok: true };
}
