import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { config } from "./config";
import { HttpError } from "./lib/errors";
import { EvolutionError } from "./evolution/client";
import { healthRoutes } from "./routes/health";
import { webhookRoutes } from "./routes/webhooks";
import { channelRoutes } from "./routes/channels";
import { conversationRoutes } from "./routes/conversations";
import { teamRoutes } from "./routes/team";
import { contactRoutes } from "./routes/contacts";
import { privacyRoutes } from "./routes/privacy";
import { campaignRoutes } from "./routes/campaigns";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // LGPD: não registrar conteúdo de mensagens nem tokens
      redact: ["req.headers.authorization", "req.headers.apikey", "*.body", "*.text"],
      serializers: {
        // Não registrar o segredo que vai no caminho do webhook
        req: (req: { method: string; url: string }) => ({
          method: req.method,
          url: req.url.replace(/(\/webhooks\/evolution\/)[^/]+/, "$1***"),
        }),
      },
      ...(config.NODE_ENV === "development" ? { transport: { target: "pino-pretty" } } : {}),
    },
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: "Dados inválidos.", issues: err.issues.map((i) => ({ path: i.path, message: i.message })) });
    }
    if (err instanceof HttpError) return reply.code(err.statusCode).send({ error: err.message });
    if (err instanceof EvolutionError) {
      req.log.error({ err: err.message, status: err.status }, "erro na Evolution");
      return reply.code(502).send({ error: "O serviço do WhatsApp não respondeu. Tente de novo em instantes." });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: (err as Error).message });
    req.log.error({ err }, "erro inesperado");
    return reply.code(500).send({ error: "Erro interno. Já registramos o problema." });
  });

  await app.register(healthRoutes);
  await app.register(webhookRoutes);
  await app.register(channelRoutes);
  await app.register(conversationRoutes);
  await app.register(teamRoutes);
  await app.register(contactRoutes);
  await app.register(privacyRoutes);
  await app.register(campaignRoutes);
  return app;
}
