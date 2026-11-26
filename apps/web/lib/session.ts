import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_SYSTEM_COOKIE, type Tables } from "@webagent/shared";
import { createClient } from "./supabase/server";

export type SystemRow = Pick<Tables<"systems">, "id" | "slug" | "name" | "color" | "protocol_prefix" | "timezone" | "description" | "is_active">;

export interface PanelStatus {
  channels: string[];
  hours: { weekday: number; enabled: boolean; opens_at: string; closes_at: string; break_start: string | null; break_end: string | null }[];
  holidays: { date: string; name: string }[];
  queued: number;
}

interface PanelContext {
  profile: { id: string; full_name: string; avatar_url: string | null; theme: string; is_platform_admin: boolean } | null;
  systems: SystemRow[];
  members: { system_id: string; role: "admin" | "supervisor" | "agent" }[];
  active_id: string | null;
  status: PanelStatus | null;
}

/**
 * Sessão do painel, cacheada por requisição.
 *
 * Desempenho: o usuário vem do cookie (sem ida ao servidor de autenticação) e todo o contexto
 * (perfil, sistemas, papéis, status) chega numa única chamada ao banco (panel_context).
 * Segurança: o proxy renova a sessão a cada requisição e o banco valida o JWT em toda
 * consulta (RLS). Ações que alteram dados usam getUser() ou passam pela API, que também valida.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const [{ data: auth }, cookieStore] = await Promise.all([supabase.auth.getSession(), cookies()]);
  const claims = decodeJwt(auth.session?.access_token);
  if (!claims?.sub) redirect("/login");
  const sessionUser = { id: claims.sub, email: claims.email };

  const wanted = cookieStore.get(ACTIVE_SYSTEM_COOKIE)?.value ?? null;
  const { data, error } = await supabase.rpc("panel_context", { p_active: wanted });
  // Token rejeitado pelo banco: limpa a sessão (evita ciclo entre /login e o painel)
  if (error || !data) redirect("/auth/expirada");
  const ctx = data as unknown as PanelContext;

  const systems = ctx.systems ?? [];
  const active = systems.find((s) => s.id === ctx.active_id) ?? null;
  const isPlatformAdmin = Boolean(ctx.profile?.is_platform_admin);
  const roleIn = (systemId: string) => (isPlatformAdmin ? "admin" : (ctx.members.find((m) => m.system_id === systemId)?.role ?? null));

  return {
    supabase,
    user: { id: sessionUser.id, email: sessionUser.email ?? "" },
    profile: ctx.profile,
    systems,
    active,
    status: ctx.status,
    isPlatformAdmin,
    role: active ? roleIn(active.id) : null,
    roleIn,
  };
});

/** Lê o conteúdo do JWT (sem validar: quem valida é o banco/API a cada consulta). */
function decodeJwt(token: string | undefined): { sub: string; email?: string } | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub: string; email?: string };
  } catch {
    return null;
  }
}

export function canManage(role: string | null, min: "supervisor" | "admin") {
  const rank: Record<string, number> = { agent: 1, supervisor: 2, admin: 3 };
  return (rank[role ?? ""] ?? 0) >= rank[min]!;
}
