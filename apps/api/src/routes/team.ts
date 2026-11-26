import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../lib/supabase";
import { requireSystemRole, requireUser } from "../lib/auth";
import { badRequest, forbidden, notFound } from "../lib/errors";

const addSchema = z.object({
  systemId: z.uuid(),
  email: z.email().transform((e) => e.toLowerCase()),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(["admin", "supervisor", "agent"]),
  /** Senha provisória (só para usuários novos). A pessoa troca em Configurações. */
  password: z
    .string()
    .min(10, "A senha provisória precisa de pelo menos 10 caracteres.")
    .regex(/[A-Za-z]/, "Use letras e números na senha.")
    .regex(/[0-9]/, "Use letras e números na senha.")
    .optional(),
});

async function findUserByEmail(email: string) {
  // A API admin não filtra por e-mail: percorre as páginas (equipe pequena, poucas páginas)
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

export async function teamRoutes(app: FastifyInstance) {
  // Lista a equipe do sistema com e-mail (só admins do sistema)
  app.get<{ Querystring: { systemId: string } }>("/team", async (req) => {
    const user = await requireUser(req);
    const systemId = z.uuid().parse(req.query.systemId);
    await requireSystemRole(user.id, systemId, "admin");

    const { data: members } = await db.from("system_members").select("user_id, role, created_at").eq("system_id", systemId);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length ? await db.from("profiles").select("id, full_name, is_platform_admin").in("id", ids) : { data: [] };
    const users = await Promise.all(ids.map((id) => db.auth.admin.getUserById(id).then((r) => r.data.user)));
    return (members ?? []).map((m) => {
      const p = profiles?.find((x) => x.id === m.user_id);
      const u = users.find((x) => x?.id === m.user_id);
      return {
        userId: m.user_id,
        role: m.role,
        fullName: p?.full_name ?? "",
        isPlatformAdmin: p?.is_platform_admin ?? false,
        email: u?.email ?? "",
        lastSignInAt: u?.last_sign_in_at ?? null,
        addedAt: m.created_at,
      };
    });
  });

  // Adiciona alguém ao sistema. Se o e-mail ainda não tem conta, cria com senha provisória.
  app.post("/team", async (req, reply) => {
    const user = await requireUser(req);
    const body = addSchema.parse(req.body);
    await requireSystemRole(user.id, body.systemId, "admin");

    let target = await findUserByEmail(body.email);
    let created = false;
    if (!target) {
      if (!body.password) throw badRequest("Este e-mail ainda não tem conta. Defina uma senha provisória.");
      const { data, error } = await db.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { full_name: body.fullName },
      });
      if (error || !data.user) throw badRequest(error?.message.includes("already") ? "E-mail já cadastrado." : "Não foi possível criar a conta.");
      target = data.user;
      created = true;
    }

    const { error } = await db
      .from("system_members")
      .upsert({ system_id: body.systemId, user_id: target.id, role: body.role }, { onConflict: "system_id,user_id" });
    if (error) throw error;
    await db.from("audit_logs").insert({
      system_id: body.systemId,
      actor_id: user.id,
      action: created ? "team.create_user" : "team.add_member",
      entity: "user",
      entity_id: target.id,
      metadata: { role: body.role },
    });
    return reply.code(201).send({ userId: target.id, created });
  });

  app.patch<{ Params: { userId: string } }>("/team/:userId", async (req) => {
    const user = await requireUser(req);
    const body = z.object({ systemId: z.uuid(), role: z.enum(["admin", "supervisor", "agent"]) }).parse(req.body);
    await requireSystemRole(user.id, body.systemId, "admin");
    if (req.params.userId === user.id && body.role !== "admin") {
      const { count } = await db.from("system_members").select("user_id", { count: "exact", head: true }).eq("system_id", body.systemId).eq("role", "admin");
      if ((count ?? 0) <= 1) throw forbidden("Você é o único administrador deste sistema. Promova outra pessoa antes.");
    }
    const { error, count } = await db
      .from("system_members")
      .update({ role: body.role }, { count: "exact" })
      .eq("system_id", body.systemId)
      .eq("user_id", req.params.userId);
    if (error) throw error;
    if (!count) throw notFound("Pessoa não encontrada neste sistema.");
    await db.from("audit_logs").insert({ system_id: body.systemId, actor_id: user.id, action: "team.change_role", entity: "user", entity_id: req.params.userId, metadata: { role: body.role } });
    return { ok: true };
  });

  app.delete<{ Params: { userId: string }; Querystring: { systemId: string } }>("/team/:userId", async (req) => {
    const user = await requireUser(req);
    const systemId = z.uuid().parse(req.query.systemId);
    await requireSystemRole(user.id, systemId, "admin");
    if (req.params.userId === user.id) throw forbidden("Você não pode remover a si mesmo.");
    await db.from("conversations").update({ assignee_id: null, status: "queued" }).eq("system_id", systemId).eq("assignee_id", req.params.userId).in("status", ["open", "pending"]);
    await db.from("system_members").delete().eq("system_id", systemId).eq("user_id", req.params.userId);
    await db.from("audit_logs").insert({ system_id: systemId, actor_id: user.id, action: "team.remove_member", entity: "user", entity_id: req.params.userId });
    return { ok: true };
  });
}
