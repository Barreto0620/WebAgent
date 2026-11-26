import { config } from "./config";
import { buildApp } from "./app";
import { startWorkers } from "./workers";
import { campaignsQueue, connection, maintenanceQueue, outboundQueue } from "./queues";

const app = await buildApp();
const stopWorkers = await startWorkers(app.log);

await app.listen({ host: "0.0.0.0", port: config.PORT });
app.log.info(`WebAgent API ouvindo na porta ${config.PORT} · heartbeat a cada ${config.HEARTBEAT_INTERVAL_HOURS}h`);

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, "encerrando com segurança");
  await app.close();
  await stopWorkers();
  await Promise.all([outboundQueue.close(), maintenanceQueue.close(), campaignsQueue.close()]);
  connection.disconnect();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
