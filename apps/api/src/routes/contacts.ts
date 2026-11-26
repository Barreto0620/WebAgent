import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../lib/supabase";
import { requireSystemRole, requireUser } from "../lib/auth";
import { badRequest, notFound } from "../lib/errors";
import { queueText } from "../services/outbound";

const startSchema = z.object({ body: z.string().trim().min(1).max(4096) });

export async function contactRoutes(app: FastifyInstance) {
  // Atendente inicia (ou continua) uma conversa com um contato
  app.post<{ Params: { id: string } }>("/contacts/:id/conversations", async (req, reply) => {
    const user = await requireUser(req);
    const { body } = startSchema.parse(req.body);
    const { data: contact } = await db.from("contacts").select("id, system_id, consent_status").eq("id", req.params.id).maybeSingle();
    if (!contact) throw notFound("Contato não encontrado.");
    await requireSystemRole(user.id, contact.system_id);

    const { data: channels } = await db.from("channels").select("id, status").eq("system_id", contact.system_id).eq("type", "whatsapp");
    const channel = (channels ?? []).find((c) => c.status === "connected");
    if (!channels?.length) throw badRequest("Este sistema ainda não tem WhatsApp conectado.");
    if (!channel) throw badRequest("O WhatsApp deste sistema está desconectado. Reconecte em Canais.");

    let { data: conv } = await db
      .from("conversations")
      .select("id")
      .eq("channel_id", channel.id)
      .eq("contact_id", contact.id)
      .neq("status", "resolved")
      .maybeSingle();

    if (!conv) {
      const { data: protocol, error: pErr } = await db.rpc("next_protocol", { p_system: contact.system_id });
      if (pErr || !protocol) throw pErr ?? new Error("Falha ao gerar protocolo");
      const now = new Date().toISOString();
      const { data, error } = await db
        .from("conversations")
        .insert({
          system_id: contact.system_id,
          channel_id: channel.id,
          contact_id: contact.id,
          protocol,
          status: "open",
          assignee_id: user.id,
          first_response_at: now,
        })
        .select("id")
        .single();
      if (error) throw error;
      conv = data;
    } else {
      await db.from("conversations").update({ status: "open", assignee_id: user.id }).eq("id", conv.id);
    }

    await queueText({ systemId: contact.system_id, conversationId: conv.id, body, senderType: "agent", senderId: user.id });
    return reply.code(201).send({ conversationId: conv.id });
  });
}
