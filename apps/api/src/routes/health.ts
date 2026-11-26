import type { FastifyInstance } from "fastify";
import { connection } from "../queues";
import { evolution } from "../evolution/client";
import { db } from "../lib/supabase";

export async function healthRoutes(app: FastifyInstance) {
  // Liveness: usado pelo healthcheck do Docker
  app.get("/health", { logLevel: "silent", config: { rateLimit: false } }, async () => ({ ok: true }));

  // Readiness detalhado (interno)
  app.get("/health/deep", async (_req, reply) => {
    const [redis, evo, supa] = await Promise.all([
      connection.ping().then(() => true).catch(() => false),
      evolution.ping(),
      db.from("systems").select("id", { head: true, count: "exact" }).then((r) => !r.error),
    ]);
    const ok = redis && evo && supa;
    return reply.code(ok ? 200 : 503).send({ ok, redis, evolution: evo, supabase: supa });
  });
}
