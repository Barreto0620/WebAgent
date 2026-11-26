import { db } from "../lib/supabase";

/**
 * Ping de manutenção: grava um registro no Supabase para o projeto do plano gratuito
 * não ser pausado por inatividade (o Supabase pausa após 7 dias sem uso).
 * Também apaga registros com mais de 30 dias.
 */
export async function runHeartbeat(source = "worker") {
  const { error } = await db.from("system_heartbeats").insert({ source });
  if (error) throw new Error(`Heartbeat falhou: ${error.message}`);
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  await db.from("system_heartbeats").delete().lt("created_at", cutoff);
  return { at: new Date().toISOString() };
}
