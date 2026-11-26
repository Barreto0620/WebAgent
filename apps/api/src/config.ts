import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().default(3001),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  REDIS_URL: z.string().default("redis://webagent-redis:6379/0"),

  EVOLUTION_URL: z.url().default("http://webagent-evolution:8080"),
  EVOLUTION_API_KEY: z.string().min(16),

  /** Endereço interno pelo qual a Evolution chama esta API. */
  PUBLIC_WEBHOOK_BASE: z.url().default("http://webagent-api:3001"),
  /** Segredo que vai no caminho do webhook. Gere com: openssl rand -hex 32 */
  WEBHOOK_SECRET: z.string().min(32),

  /** Intervalo do ping de manutenção no Supabase (horas). Padrão: 24h. */
  HEARTBEAT_INTERVAL_HOURS: z.coerce.number().min(1).max(144).default(24),

  /** Endereço público do painel (usado no retorno do login das redes sociais). */
  PUBLIC_APP_URL: z.url().default("https://webagent.bookweb.tech"),
  /** App da Meta (Facebook/Instagram). Opcional: sem ele, a conexão fica indisponível no painel. */
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_GRAPH_VERSION: z.string().default("v23.0"),
  /** App do TikTok (Content Posting API). Opcional. */
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),

  /** Intervalo mínimo entre envios do mesmo worker (ms) para proteger o número. */
  SEND_MIN_INTERVAL_MS: z.coerce.number().int().min(300).default(1200),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  return parsed.data;
}

export const config = loadConfig();
