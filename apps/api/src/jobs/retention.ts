import { db } from "../lib/supabase";

/**
 * Retenção (LGPD, art. 15 e 16): apaga conversas encerradas há mais tempo que o prazo
 * do sistema (system_settings.retention_days), junto com mensagens e arquivos.
 * O contato e o histórico de consentimento ficam (prova de opt-in/opt-out).
 */
export async function runRetention() {
  const { data: systems } = await db.from("system_settings").select("system_id, retention_days");
  let removed = 0;
  for (const s of systems ?? []) {
    const cutoff = new Date(Date.now() - s.retention_days * 86_400_000).toISOString();
    for (let round = 0; round < 20; round++) {
      const { data: convs } = await db
        .from("conversations")
        .select("id")
        .eq("system_id", s.system_id)
        .eq("status", "resolved")
        .lt("resolved_at", cutoff)
        .limit(100);
      if (!convs?.length) break;
      for (const c of convs) {
        await removeConversationMedia(s.system_id, c.id);
      }
      await db.from("conversations").delete().in("id", convs.map((c) => c.id));
      removed += convs.length;
    }
  }
  return { removed };
}

export async function removeConversationMedia(systemId: string, conversationId: string) {
  const prefix = `${systemId}/${conversationId}`;
  const { data: files } = await db.storage.from("media").list(prefix, { limit: 1000 });
  if (files?.length) await db.storage.from("media").remove(files.map((f) => `${prefix}/${f.name}`));
}
