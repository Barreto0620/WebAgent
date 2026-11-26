import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { normalizePhone } from "@webagent/shared";
import { db } from "../lib/supabase";
import { requireSystemRole, requireUser } from "../lib/auth";
import { badRequest, notFound } from "../lib/errors";
import { evolution, EvolutionError } from "../evolution/client";

const createSchema = z.object({
  systemId: z.uuid(),
  name: z.string().trim().min(2).max(60),
});

const connectSchema = z.object({
  /** Se informado, gera o código de pareamento (alternativa ao QR Code). */
  phone: z.string().optional(),
});

async function loadChannel(id: string) {
  const { data } = await db.from("channels").select("*").eq("id", id).maybeSingle();
  if (!data) throw notFound("Canal não encontrado.");
  return data;
}

export async function channelRoutes(app: FastifyInstance) {
  // Cria o canal WhatsApp do sistema e a instância exclusiva na Evolution do WebAgent
  app.post("/channels", async (req, reply) => {
    const user = await requireUser(req);
    const body = createSchema.parse(req.body);
    await requireSystemRole(user.id, body.systemId, "admin");

    const { data: system } = await db.from("systems").select("slug").eq("id", body.systemId).single();
    if (!system) throw notFound("Sistema não encontrado.");
    const instanceName = `wa-${system.slug}-${Date.now().toString(36)}`;

    const created = await evolution.createInstance(instanceName);
    const { data: channel, error } = await db
      .from("channels")
      .insert({ system_id: body.systemId, type: "whatsapp", name: body.name, instance_name: instanceName, status: "disconnected" })
      .select("*")
      .single();
    if (error) {
      await evolution.deleteInstance(instanceName).catch(() => undefined);
      throw error;
    }
    const token = typeof created.hash === "string" ? created.hash : created.hash?.apikey;
    if (token) await db.from("channel_secrets").insert({ channel_id: channel.id, data: { instanceToken: token } });

    await db.from("audit_logs").insert({
      system_id: body.systemId, actor_id: user.id, action: "channel.create", entity: "channel", entity_id: channel.id,
    });
    return reply.code(201).send(channel);
  });

  // Gera QR Code (e código de pareamento, se o telefone for informado)
  app.post<{ Params: { id: string } }>("/channels/:id/connect", async (req) => {
    const user = await requireUser(req);
    const channel = await loadChannel(req.params.id);
    await requireSystemRole(user.id, channel.system_id, "admin");
    const { phone } = connectSchema.parse(req.body ?? {});

    let number: string | undefined;
    if (phone) {
      const n = normalizePhone(phone);
      if (!n) throw badRequest("Telefone inválido. Use DDD + número, ex.: (11) 99876-4321.");
      number = n;
    }
    await evolution.setWebhook(channel.instance_name).catch(() => undefined);
    // A Evolution pode levar alguns segundos para gerar o QR depois de abrir a sessão
    let qr = await evolution.connect(channel.instance_name, number);
    for (let i = 0; i < 4 && !qr.base64 && !qr.pairingCode; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      qr = await evolution.connect(channel.instance_name, number);
    }
    await db.from("channels").update({ status: "connecting", last_status_at: new Date().toISOString() }).eq("id", channel.id);
    return { qrBase64: qr.base64 ?? null, pairingCode: qr.pairingCode ?? null };
  });

  // Consulta o estado direto na Evolution (o painel usa enquanto exibe o QR)
  app.get<{ Params: { id: string } }>("/channels/:id/status", async (req) => {
    const user = await requireUser(req);
    const channel = await loadChannel(req.params.id);
    await requireSystemRole(user.id, channel.system_id);
    try {
      const st = await evolution.connectionState(channel.instance_name);
      const map = { open: "connected", close: "disconnected", connecting: "connecting" } as const;
      const status = map[st.instance.state] ?? "error";
      if (status !== channel.status) {
        await db
          .from("channels")
          .update({ status, last_status_at: new Date().toISOString(), ...(status === "connected" ? { connected_at: new Date().toISOString() } : {}) })
          .eq("id", channel.id);
      }
      return { status };
    } catch (err) {
      if (err instanceof EvolutionError && err.status === 404) return { status: "error" };
      throw err;
    }
  });

  app.post<{ Params: { id: string } }>("/channels/:id/logout", async (req) => {
    const user = await requireUser(req);
    const channel = await loadChannel(req.params.id);
    await requireSystemRole(user.id, channel.system_id, "admin");
    await evolution.logout(channel.instance_name).catch(() => undefined);
    await db.from("channels").update({ status: "disconnected", last_status_at: new Date().toISOString() }).eq("id", channel.id);
    await db.from("audit_logs").insert({
      system_id: channel.system_id, actor_id: user.id, action: "channel.logout", entity: "channel", entity_id: channel.id,
    });
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/channels/:id", async (req) => {
    const user = await requireUser(req);
    const channel = await loadChannel(req.params.id);
    await requireSystemRole(user.id, channel.system_id, "admin");
    await evolution.logout(channel.instance_name).catch(() => undefined);
    await evolution.deleteInstance(channel.instance_name).catch(() => undefined);
    await db.from("channels").delete().eq("id", channel.id);
    await db.from("audit_logs").insert({
      system_id: channel.system_id, actor_id: user.id, action: "channel.delete", entity: "channel", entity_id: channel.id,
    });
    return { ok: true };
  });
}
