import "server-only";
import { API_URL } from "./env";
import { createClient } from "./supabase/server";

/** Chama a API interna repassando o token do usuário logado. */
export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    // Content-Type só quando há corpo: a API recusa JSON vazio
    headers: init.body === undefined ? { Authorization: `Bearer ${token}` } : { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Falha na API (${res.status})`);
  return json;
}
