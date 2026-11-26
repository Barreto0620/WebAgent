import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_SYSTEM_COOKIE, type Tables } from "@webagent/shared";
import { createClient } from "./supabase/server";

export type SystemRow = Pick<Tables<"systems">, "id" | "slug" | "name" | "color" | "protocol_prefix" | "timezone" | "description" | "is_active">;

/** Usuário, perfil, sistemas que ele acessa e o sistema ativo (cookie). Cacheado por requisição. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [{ data: profile }, { data: systems }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", auth.user.id).single(),
    supabase.from("systems").select("id, slug, name, color, protocol_prefix, timezone, description, is_active").order("name"),
    supabase.from("system_members").select("system_id, role").eq("user_id", auth.user.id),
  ]);

  const list = (systems ?? []) as SystemRow[];
  const cookieStore = await cookies();
  const wanted = cookieStore.get(ACTIVE_SYSTEM_COOKIE)?.value;
  const active = list.find((s) => s.id === wanted) ?? list.find((s) => s.is_active) ?? list[0] ?? null;
  const isPlatformAdmin = Boolean(profile?.is_platform_admin);
  const roleIn = (systemId: string) =>
    isPlatformAdmin ? "admin" : (memberships?.find((m) => m.system_id === systemId)?.role ?? null);

  return {
    supabase,
    user: auth.user,
    profile,
    systems: list,
    active,
    isPlatformAdmin,
    role: active ? roleIn(active.id) : null,
    roleIn,
  };
});

export function canManage(role: string | null, min: "supervisor" | "admin") {
  const rank: Record<string, number> = { agent: 1, supervisor: 2, admin: 3 };
  return (rank[role ?? ""] ?? 0) >= rank[min]!;
}
