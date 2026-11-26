import { Worker, type Job } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import { config } from "./config";
import { createRedis } from "./lib/redis";
import { maintenanceQueue, type OutboundJob } from "./queues";
import { deliverMessage } from "./services/outbound";
import { runHeartbeat } from "./jobs/heartbeat";
import { runRetention } from "./jobs/retention";
import { campaignTick } from "./services/campaigns";

export async function startWorkers(log: FastifyBaseLogger) {
  // Envio: 1 mensagem por vez, com intervalo mínimo entre envios (protege o número contra bloqueio)
  const outbound = new Worker<OutboundJob>(
    "outbound",
    async (job: Job<OutboundJob>) => deliverMessage(job.data.messageId),
    {
      connection: createRedis(),
      concurrency: 1,
      limiter: { max: 1, duration: config.SEND_MIN_INTERVAL_MS },
    },
  );
  outbound.on("failed", (job, err) =>
    log.warn({ messageId: job?.data.messageId, attempt: job?.attemptsMade, err: err.message }, "envio falhou"),
  );

  const maintenance = new Worker(
    "maintenance",
    async (job) => {
      if (job.name === "heartbeat") return runHeartbeat("worker");
      if (job.name === "retention") return runRetention();
    },
    { connection: createRedis(), concurrency: 1 },
  );
  maintenance.on("completed", (job) => job.name === "heartbeat" && log.info("heartbeat do Supabase registrado"));
  maintenance.on("failed", (job, err) => log.error({ job: job?.name, err: err.message }, "tarefa de manutenção falhou"));

  // Campanhas: um passo por vez (cada passo agenda o próximo com intervalo aleatório)
  const campaigns = new Worker<{ campaignId: string }>("campaigns", async (job) => campaignTick(job.data.campaignId), {
    connection: createRedis(),
    concurrency: 1,
  });
  campaigns.on("failed", (job, err) => log.error({ campaign: job?.data.campaignId, err: err.message }, "passo de campanha falhou"));

  // Agenda repetida (idempotente: o BullMQ substitui o agendador com o mesmo id)
  await maintenanceQueue.upsertJobScheduler(
    "heartbeat",
    { every: config.HEARTBEAT_INTERVAL_HOURS * 3_600_000 },
    { name: "heartbeat" },
  );
  // Retenção LGPD: todo dia às 03:30 (horário de Brasília)
  await maintenanceQueue.upsertJobScheduler("retention", { pattern: "30 3 * * *", tz: "America/Sao_Paulo" }, { name: "retention" });
  maintenance.on("completed", (job, result) => job.name === "retention" && log.info({ result }, "retenção executada"));

  // Um ping logo ao iniciar, para não depender do primeiro ciclo
  await maintenanceQueue.add("heartbeat", {}, { jobId: `heartbeat-boot-${new Date().toISOString().slice(0, 13)}` });

  return async () => {
    await Promise.all([outbound.close(), maintenance.close(), campaigns.close()]);
  };
}
