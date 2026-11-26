import type { FastifyRequest } from "fastify";
import type { SystemRole } from "@webagent/shared";
import { db } from "./supabase";
import { forbidden, unauthorized } from "./errors";

const RANK: Record<SystemRole, number> = { agent: 1, supervisor: 2, admin: 3 };

export interface AuthUser {
  id: string;
  email?: string;
}

/** Valida o token do Supabase enviado pelo painel (Authorization: Bearer <jwt>). */
export async function requireUser(req: FastifyRequest): Promise<AuthUser> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw unauthorized();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw unauthorized();
  return { id: data.user.id, email: data.user.email };
}

/** Confere se o usuário tem o papel mínimo no sistema (ou é admin da plataforma). */
export async function requireSystemRole(userId: string, systemId: string, min: SystemRole = "agent") {
  const [{ data: profile }, { data: member }] = await Promise.all([
    db.from("profiles").select("is_platform_admin").eq("id", userId).maybeSingle(),
    db.from("system_members").select("role").eq("system_id", systemId).eq("user_id", userId).maybeSingle(),
  ]);
  if (profile?.is_platform_admin) return;
  if (!member || RANK[member.role] < RANK[min]) throw forbidden();
}
