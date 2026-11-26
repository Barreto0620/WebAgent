import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { config } from "../config";
import { db } from "../lib/supabase";
import { parseConnection, parseMessageStatus, parseMessagesUpsert } from "../evolution/parse";
import { handleInbound } from "../services/inbound";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const STATE_MAP = { open: "connected", close: "disconnected", connecting: "connecting" } as const;

export async function webhookRoutes(app: FastifyInstance) {
  app.post<{ Params: { secret: string; instance: string } }>(
    "/webhooks/evolution/:secret/:instance",
    { bodyLimit: 60 * 1024 * 1024, config: { rateLimit: false } },
    async (req, reply) => {
      if (!safeEqual(req.params.secret, config.WEBHOOK_SECRET)) return reply.code(404).send();

      const { data: channel } = await db
        .from("channels")
        .select("id, system_id, instance_name, status")
        .eq("instance_name", req.params.instance)
        .maybeSingle();
      if (!channel) return reply.code(202).send({ ignored: "instância desconhecida" });

      const body = req.body as { event?: string; data?: any };
      const event = String(body?.event ?? "").toLowerCase().replace(/_/g, ".");

      try {
        switch (event) {
          case "messages.upsert": {
            const items = Array.isArray(body.data) ? body.data : [body.data];
            for (const item of items) {
              const msg = parseMessagesUpsert(item);
              if (msg) await handleInbound(channel, msg, req.log);
            }
            break;
          }
          case "messages.update": {
            const items = Array.isArray(body.data) ? body.data : [body.data];
            for (const item of items) {
              const st = parseMessageStatus(item);
              if (!st) continue;
              await db
                .from("messages")
                .update({ status: st.status })
                .eq("system_id", channel.system_id)
                .eq("external_id", st.externalId)
                .eq("direction", "out");
            }
            break;
          }
          case "connection.update": {
            const c = parseConnection(body.data);
            if (!c) break;
            const status = STATE_MAP[c.state];
            await db
              .from("channels")
              .update({
                status,
                last_status_at: new Date().toISOString(),
                ...(status === "connected"
                  ? {
                      connected_at: new Date().toISOString(),
                      ...(c.phone ? { phone: c.phone } : {}),
                      ...(c.profileName ? { profile_name: c.profileName } : {}),
                      ...(c.picture ? { profile_picture_url: c.picture } : {}),
                    }
                  : {}),
              })
              .eq("id", channel.id);
            req.log.info({ instance: channel.instance_name, status }, "status do canal atualizado");
            break;
          }
          default:
            break;
        }
      } catch (err) {
        // Devolve 500 para a Evolution tentar de novo; a gravação é idempotente pelo external_id
        req.log.error({ err, event, instance: channel.instance_name }, "falha ao processar webhook");
        return reply.code(500).send({ error: "falha ao processar" });
      }
      return reply.code(200).send({ ok: true });
    },
  );
}
