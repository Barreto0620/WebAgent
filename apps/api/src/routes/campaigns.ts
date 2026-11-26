import type { FastifyInstance } from "fastify";
import { db } from "../lib/supabase";
import { requireSystemRole, requireUser } from "../lib/auth";
import { badRequest, notFound } from "../lib/errors";
import { startCampaign } from "../services/campaigns";
import { scheduleCampaignTick } from "../queues";

async function load(id: string) {
  const { data } = await db.from("campaigns").select("id, system_id, status").eq("id", id).maybeSingle();
  if (!data) throw notFound("Campanha não encontrada.");
  return data;
}

export async function campaignRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>("/campaigns/:id/start", async (req) => {
    const user = await requireUser(req);
    const c = await load(req.params.id);
    await requireSystemRole(user.id, c.system_id, "supervisor");
    try {
      const r = await startCampaign(c.id);
      await db.from("audit_logs").insert({ system_id: c.system_id, actor_id: user.id, action: "campaign.start", entity: "campaign", entity_id: c.id, metadata: r });
      return r;
    } catch (e) {
      throw badRequest(e instanceof Error ? e.message : "Não foi possível iniciar.");
    }
  });

  app.post<{ Params: { id: string; action: string } }>("/campaigns/:id/:action", async (req) => {
    const user = await requireUser(req);
    const c = await load(req.params.id);
    await requireSystemRole(user.id, c.system_id, "supervisor");
    const action = req.params.action;
    if (action === "pause") {
      if (c.status !== "running" && c.status !== "scheduled") throw badRequest("Só campanhas em andamento podem ser pausadas.");
      await db.from("campaigns").update({ status: "paused" }).eq("id", c.id);
    } else if (action === "resume") {
      if (c.status !== "paused") throw badRequest("A campanha não está pausada.");
      await db.from("campaigns").update({ status: "running" }).eq("id", c.id);
      await scheduleCampaignTick(c.id, 0);
    } else if (action === "cancel") {
      if (c.status === "completed" || c.status === "canceled") throw badRequest("A campanha já terminou.");
      await db.from("campaigns").update({ status: "canceled", finished_at: new Date().toISOString() }).eq("id", c.id);
      await db.from("campaign_recipients").update({ status: "skipped", error: "Campanha cancelada" }).eq("campaign_id", c.id).eq("status", "pending");
    } else {
      throw notFound();
    }
    await db.from("audit_logs").insert({ system_id: c.system_id, actor_id: user.id, action: `campaign.${action}`, entity: "campaign", entity_id: c.id });
    return { ok: true };
  });
}
