import type { FastifyInstance } from "fastify";
import { db } from "../lib/supabase";
import { requireSystemRole, requireUser } from "../lib/auth";
import { badRequest, notFound } from "../lib/errors";
import { z } from "zod";
import { startCampaign } from "../services/campaigns";
import { addLeads, leadSchema } from "../services/lead-import";
import { scheduleCampaignTick } from "../queues";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const leadsCampaignSchema = z.object({
  systemId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  sourceName: z.string().max(200).nullable(),
  sourceUrl: z.url().nullable(),
  mapping: z.record(z.string(), z.unknown()),
  respectDay: z.boolean(),
  followupsEnabled: z.boolean(),
  appendOptout: z.boolean(),
  minIntervalS: z.number().int().min(5).max(600),
  maxIntervalS: z.number().int().min(5).max(900),
  dailyLimit: z.number().int().min(1).max(2000),
  windowStart: time,
  windowEnd: time,
  scheduledAt: z.iso.datetime({ offset: true }).nullable(),
  start: z.boolean(),
  leads: z.array(leadSchema).min(1).max(5000),
});

function slugTag(name: string) {
  return (
    "campanha-" +
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20)
  );
}

async function load(id: string) {
  const { data } = await db.from("campaigns").select("id, system_id, status").eq("id", id).maybeSingle();
  if (!data) throw notFound("Campanha não encontrada.");
  return data;
}

export async function campaignRoutes(app: FastifyInstance) {
  // Cria campanha de leads a partir das linhas da planilha (já mapeadas no painel)
  app.post("/campaigns/leads", { bodyLimit: 20 * 1024 * 1024 }, async (req, reply) => {
    const user = await requireUser(req);
    const b = leadsCampaignSchema.parse(req.body);
    await requireSystemRole(user.id, b.systemId, "supervisor");
    if (b.maxIntervalS < b.minIntervalS) throw badRequest("Intervalo máximo menor que o mínimo.");
    if (b.windowEnd <= b.windowStart) throw badRequest("A janela de envio termina antes de começar.");

    const { data: c, error } = await db
      .from("campaigns")
      .insert({
        system_id: b.systemId,
        kind: "leads",
        name: b.name,
        message: "",
        source_name: b.sourceName,
        source_url: b.sourceUrl,
        mapping: b.mapping as never,
        respect_day: b.respectDay,
        followups_enabled: b.followupsEnabled,
        append_optout: b.appendOptout,
        min_interval_s: b.minIntervalS,
        max_interval_s: b.maxIntervalS,
        daily_limit: b.dailyLimit,
        window_start: b.windowStart,
        window_end: b.windowEnd,
        scheduled_at: b.scheduledAt,
        created_by: user.id,
        status: "draft",
      })
      .select("id, system_id")
      .single();
    if (error) throw error;

    const result = await addLeads(c, b.leads, slugTag(b.name));
    await db.from("audit_logs").insert({ system_id: b.systemId, actor_id: user.id, action: "campaign.import_leads", entity: "campaign", entity_id: c.id, metadata: result });
    let started = false;
    if (b.start) {
      try {
        await startCampaign(c.id);
        started = true;
      } catch (e) {
        return reply.code(201).send({ id: c.id, ...result, started, startError: e instanceof Error ? e.message : "Não iniciou" });
      }
    }
    return reply.code(201).send({ id: c.id, ...result, started });
  });

  // Acrescenta linhas novas (ex.: planilha do link foi atualizada)
  app.post<{ Params: { id: string } }>("/campaigns/:id/leads", { bodyLimit: 20 * 1024 * 1024 }, async (req) => {
    const user = await requireUser(req);
    const c = await load(req.params.id);
    await requireSystemRole(user.id, c.system_id, "supervisor");
    const { leads } = z.object({ leads: z.array(leadSchema).min(1).max(5000) }).parse(req.body);
    const { data: full } = await db.from("campaigns").select("kind, name, status").eq("id", c.id).single();
    if (full?.kind !== "leads") throw badRequest("Esta campanha não é de planilha.");
    if (full.status === "canceled") throw badRequest("Campanha cancelada.");
    const result = await addLeads(c, leads, slugTag(full.name));
    // Se já tinha terminado e entraram novos leads, volta a rodar
    if (result.added > 0 && full.status === "completed") {
      await db.from("campaigns").update({ status: "running", finished_at: null }).eq("id", c.id);
      await scheduleCampaignTick(c.id, 0);
    }
    return result;
  });

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
