import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { renderTemplate } from "@webagent/shared";
import { db } from "../lib/supabase";
import { requireSystemRole, requireUser } from "../lib/auth";
import { badRequest, notFound } from "../lib/errors";
import { queueText } from "../services/outbound";
import { outboundQueue } from "../queues";
import { loadSystemContext, templateVars } from "../services/automations";

const sendSchema = z.object({ body: z.string().trim().min(1).max(4096) });

async function loadConversation(id: string) {
  const { data } = await db
    .from("conversations")
    .select("id, system_id, status, protocol, assignee_id, first_response_at, contacts!inner(name, push_name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw notFound("Conversa não encontrada.");
  return data;
}

export async function conversationRoutes(app: FastifyInstance) {
  // Atendente envia mensagem ao cliente
  app.post<{ Params: { id: string } }>("/conversations/:id/messages", async (req, reply) => {
    const user = await requireUser(req);
    const conv = await loadConversation(req.params.id);
    await requireSystemRole(user.id, conv.system_id);
    const { body } = sendSchema.parse(req.body);
    if (conv.status === "resolved") throw badRequest("Esta conversa já foi encerrada.");

    const now = new Date().toISOString();
    await db
      .from("conversations")
      .update({
        status: "open",
        assignee_id: conv.assignee_id ?? user.id,
        unread_count: 0,
        ...(conv.first_response_at ? {} : { first_response_at: now }),
      })
      .eq("id", conv.id);

    const id = await queueText({ systemId: conv.system_id, conversationId: conv.id, body, senderType: "agent", senderId: user.id });
    return reply.code(202).send({ id });
  });

  // Encerra o atendimento e envia a mensagem de encerramento
  app.post<{ Params: { id: string } }>("/conversations/:id/resolve", async (req) => {
    const user = await requireUser(req);
    const conv = await loadConversation(req.params.id);
    await requireSystemRole(user.id, conv.system_id);
    if (conv.status === "resolved") return { ok: true };

    const ctx = await loadSystemContext(conv.system_id);
    if (ctx.settings.closing_enabled) {
      const contact = conv.contacts as unknown as { name: string | null; push_name: string | null };
      const text = renderTemplate(ctx.settings.closing_message, templateVars(ctx, contact.name ?? contact.push_name, conv.protocol));
      await queueText({ systemId: conv.system_id, conversationId: conv.id, body: text, senderType: "system" });
    }
    const csat = ctx.settings.csat_enabled && ctx.settings.csat_message.trim().length > 0;
    if (csat) {
      await queueText({ systemId: conv.system_id, conversationId: conv.id, body: ctx.settings.csat_message, senderType: "system" });
    }
    await db
      .from("conversations")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        unread_count: 0,
        ...(csat ? { csat_requested_at: new Date().toISOString() } : {}),
      })
      .eq("id", conv.id);
    await db.from("audit_logs").insert({
      system_id: conv.system_id, actor_id: user.id, action: "conversation.resolve", entity: "conversation", entity_id: conv.id,
    });
    return { ok: true };
  });

  // Reenvia uma mensagem que falhou
  app.post<{ Params: { id: string } }>("/messages/:id/retry", async (req) => {
    const user = await requireUser(req);
    const { data: msg } = await db.from("messages").select("id, system_id, status, direction").eq("id", req.params.id).maybeSingle();
    if (!msg || msg.direction !== "out") throw notFound("Mensagem não encontrada.");
    await requireSystemRole(user.id, msg.system_id);
    if (msg.status !== "failed") throw badRequest("Só mensagens com falha podem ser reenviadas.");
    await db.from("messages").update({ status: "queued", error: null }).eq("id", msg.id);
    // jobId novo: o BullMQ ignora silenciosamente um jobId que já existe (falhas ficam guardadas)
    await outboundQueue.add("send", { messageId: msg.id }, { jobId: `msg-${msg.id}-r${Date.now()}` });
    return { ok: true };
  });
}
