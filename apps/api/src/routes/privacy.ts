import type { FastifyInstance } from "fastify";
import { randomInt } from "node:crypto";
import { db } from "../lib/supabase";
import { requireSystemRole, requireUser } from "../lib/auth";
import { notFound } from "../lib/errors";
import { removeConversationMedia } from "../jobs/retention";

async function loadContact(id: string) {
  const { data } = await db.from("contacts").select("*").eq("id", id).maybeSingle();
  if (!data) throw notFound("Contato não encontrado.");
  return data;
}

export async function privacyRoutes(app: FastifyInstance) {
  // Portabilidade / acesso (art. 18, II e V): todos os dados do titular em JSON
  app.get<{ Params: { id: string } }>("/privacy/contacts/:id/export", async (req) => {
    const user = await requireUser(req);
    const contact = await loadContact(req.params.id);
    await requireSystemRole(user.id, contact.system_id, "supervisor");

    const [{ data: consents }, { data: conversations }] = await Promise.all([
      db.from("consent_events").select("status, source, evidence, created_at").eq("contact_id", contact.id).order("created_at"),
      db.from("conversations").select("id, protocol, status, created_at, resolved_at, csat_score").eq("contact_id", contact.id).order("created_at"),
    ]);
    const ids = (conversations ?? []).map((c) => c.id);
    const { data: messages } = ids.length
      ? await db.from("messages").select("conversation_id, direction, type, body, created_at").in("conversation_id", ids).eq("is_internal", false).order("created_at")
      : { data: [] };

    await db.from("audit_logs").insert({ system_id: contact.system_id, actor_id: user.id, action: "privacy.export", entity: "contact", entity_id: contact.id });

    return {
      generated_at: new Date().toISOString(),
      controller: "WebCash Company",
      titular: {
        telefone: contact.phone,
        nome: contact.name,
        nome_whatsapp: contact.push_name,
        email: contact.email,
        etiquetas: contact.tags,
        consentimento_atual: contact.consent_status,
        criado_em: contact.created_at,
      },
      consentimentos: consents ?? [],
      atendimentos: (conversations ?? []).map((c) => ({
        protocolo: c.protocol,
        status: c.status,
        aberto_em: c.created_at,
        encerrado_em: c.resolved_at,
        nota: c.csat_score,
        mensagens: (messages ?? [])
          .filter((m) => m.conversation_id === c.id)
          .map((m) => ({ quem: m.direction === "in" ? "titular" : "empresa", tipo: m.type, texto: m.body, em: m.created_at })),
      })),
    };
  });

  // Eliminação / anonimização (art. 18, IV e VI)
  app.post<{ Params: { id: string } }>("/privacy/contacts/:id/anonymize", async (req) => {
    const user = await requireUser(req);
    const contact = await loadContact(req.params.id);
    await requireSystemRole(user.id, contact.system_id, "admin");

    const { data: convs } = await db.from("conversations").select("id").eq("contact_id", contact.id);
    for (const c of convs ?? []) await removeConversationMedia(contact.system_id, c.id);
    const ids = (convs ?? []).map((c) => c.id);
    if (ids.length) {
      await db
        .from("messages")
        .update({ body: "[removido a pedido do titular]", media_path: null, media_mime: null })
        .in("conversation_id", ids);
      await db.from("conversations").update({ last_message_preview: "[removido]" }).in("id", ids);
    }
    // Telefone substituído por um identificador aleatório que não é número válido de WhatsApp
    const fake = `000${Array.from({ length: 12 }, () => randomInt(10)).join("")}`;
    await db
      .from("contacts")
      .update({ phone: fake, name: "Titular anonimizado", push_name: null, email: null, notes: null, avatar_url: null, tags: [] })
      .eq("id", contact.id);
    await db.from("audit_logs").insert({ system_id: contact.system_id, actor_id: user.id, action: "privacy.anonymize", entity: "contact", entity_id: contact.id });
    return { ok: true };
  });
}
