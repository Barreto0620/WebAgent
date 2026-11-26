import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "../lib/supabase";
import { connection, schedulePublish } from "../queues";
import { requireSystemRole, requireUser } from "../lib/auth";
import { badRequest, notFound } from "../lib/errors";
import { metaAuthUrl, metaConfigured, metaExchange } from "../social/meta";
import { tiktokAuthUrl, tiktokConfigured, tiktokExchange } from "../social/tiktok";
import { loadPost, validatePost } from "../services/publishing";

const STATE_TTL = 600;

export async function socialRoutes(app: FastifyInstance) {
  app.get("/social/providers", async (req) => {
    await requireUser(req);
    return { meta: metaConfigured(), tiktok: tiktokConfigured() };
  });

  // Gera a URL de login da rede (state guardado 10 min, ligado ao usuário e ao sistema)
  app.post<{ Params: { provider: string } }>("/social/:provider/auth-url", async (req) => {
    const user = await requireUser(req);
    const { systemId } = z.object({ systemId: z.uuid() }).parse(req.body);
    await requireSystemRole(user.id, systemId, "admin");
    const provider = req.params.provider;
    if (provider !== "meta" && provider !== "tiktok") throw notFound();
    if (provider === "meta" && !metaConfigured()) throw badRequest("App da Meta não configurado no servidor (META_APP_ID e META_APP_SECRET).");
    if (provider === "tiktok" && !tiktokConfigured()) throw badRequest("App do TikTok não configurado no servidor (TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET).");
    const state = randomBytes(24).toString("hex");
    await connection.set(`oauth:${state}`, JSON.stringify({ userId: user.id, systemId, provider }), "EX", STATE_TTL);
    return { url: provider === "meta" ? metaAuthUrl(state) : tiktokAuthUrl(state) };
  });

  // Retorno do login: troca o código por token e salva as contas
  app.post<{ Params: { provider: string } }>("/social/:provider/callback", async (req) => {
    const user = await requireUser(req);
    const { code, state } = z.object({ code: z.string().min(4), state: z.string().min(16) }).parse(req.body);
    const raw = await connection.getdel(`oauth:${state}`);
    if (!raw) throw badRequest("O login expirou ou já foi usado. Tente conectar de novo.");
    const st = JSON.parse(raw) as { userId: string; systemId: string; provider: string };
    if (st.userId !== user.id || st.provider !== req.params.provider) throw badRequest("Login não corresponde a esta sessão.");

    const saved: string[] = [];
    if (st.provider === "meta") {
      const accounts = await metaExchange(code);
      for (const a of accounts) {
        const { data, error } = await db
          .from("social_accounts")
          .upsert(
            { system_id: st.systemId, provider: a.provider, external_id: a.externalId, name: a.name, username: a.username ?? null, avatar_url: a.avatar ?? null, status: "active", status_detail: null, token_expires_at: null, connected_by: user.id },
            { onConflict: "system_id,provider,external_id" },
          )
          .select("id")
          .single();
        if (error) throw error;
        await db.from("social_account_secrets").upsert({ account_id: data.id, access_token: a.token, extra: { page_id: a.pageId }, updated_at: new Date().toISOString() });
        saved.push(`${a.provider === "instagram" ? "Instagram" : "Facebook"} ${a.name}`);
      }
    } else {
      const { token, user: tt } = await tiktokExchange(code);
      const { data, error } = await db
        .from("social_accounts")
        .upsert(
          {
            system_id: st.systemId,
            provider: "tiktok",
            external_id: tt.open_id,
            name: tt.display_name ?? "TikTok",
            avatar_url: tt.avatar_url ?? null,
            status: "active",
            status_detail: null,
            token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
            connected_by: user.id,
          },
          { onConflict: "system_id,provider,external_id" },
        )
        .select("id")
        .single();
      if (error) throw error;
      await db.from("social_account_secrets").upsert({
        account_id: data.id,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        refresh_expires_at: new Date(Date.now() + token.refresh_expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      });
      saved.push(`TikTok ${tt.display_name ?? ""}`.trim());
    }
    await db.from("audit_logs").insert({ system_id: st.systemId, actor_id: user.id, action: "social.connect", entity: "social_account", entity_id: st.provider, metadata: { accounts: saved } });
    return { accounts: saved };
  });

  // Agendar ou publicar agora
  app.post<{ Params: { id: string } }>("/posts/:id/schedule", async (req) => {
    const user = await requireUser(req);
    const { scheduledAt } = z.object({ scheduledAt: z.iso.datetime({ offset: true }).nullable() }).parse(req.body ?? {});
    const loaded = await loadPost(req.params.id);
    if (!loaded) throw notFound("Publicação não encontrada.");
    await requireSystemRole(user.id, loaded.post.system_id, "supervisor");
    if (loaded.post.status !== "draft") throw badRequest("Só rascunhos podem ser agendados.");
    const errors = validatePost(loaded.post, loaded.targets);
    if (errors.length) throw badRequest(errors.join(" "));
    const inactive = loaded.targets.find((t) => t.social_accounts.status !== "active");
    if (inactive) throw badRequest(`A conta ${inactive.social_accounts.name} precisa ser conectada de novo.`);
    const when = scheduledAt ? new Date(scheduledAt) : new Date();
    if (when.getTime() < Date.now() - 60_000) throw badRequest("A data escolhida já passou.");
    await db.from("posts").update({ status: "scheduled", scheduled_at: when.toISOString() }).eq("id", loaded.post.id);
    await schedulePublish(loaded.post.id, when.getTime() - Date.now());
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/posts/:id/cancel", async (req) => {
    const user = await requireUser(req);
    const loaded = await loadPost(req.params.id);
    if (!loaded) throw notFound("Publicação não encontrada.");
    await requireSystemRole(user.id, loaded.post.system_id, "supervisor");
    if (loaded.post.status !== "scheduled") throw badRequest("Só publicações agendadas podem ser canceladas.");
    // Volta para rascunho: dá para editar e agendar de novo
    await db.from("posts").update({ status: "draft", scheduled_at: null }).eq("id", loaded.post.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/posts/:id/retry", async (req) => {
    const user = await requireUser(req);
    const loaded = await loadPost(req.params.id);
    if (!loaded) throw notFound("Publicação não encontrada.");
    await requireSystemRole(user.id, loaded.post.system_id, "supervisor");
    if (loaded.post.status !== "failed" && loaded.post.status !== "partial") throw badRequest("Nada para tentar de novo.");
    await db.from("posts").update({ status: "scheduled" }).eq("id", loaded.post.id);
    await schedulePublish(loaded.post.id, 0);
    return { ok: true };
  });
}
