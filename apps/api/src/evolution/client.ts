import { config } from "../config";

/**
 * Cliente da Evolution API v2 (instância exclusiva do WebAgent).
 * Documentação: https://doc.evolution-api.com/v2
 */
export class EvolutionError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

export const WEBHOOK_EVENTS = [
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "CONNECTION_UPDATE",
  "QRCODE_UPDATED",
] as const;

async function call<T>(method: string, path: string, body?: unknown, timeoutMs = 20_000): Promise<T> {
  const res = await fetch(`${config.EVOLUTION_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", apikey: config.EVOLUTION_API_KEY },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json: unknown = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const msg =
      (json as { response?: { message?: unknown } })?.response?.message ??
      (json as { message?: unknown })?.message ??
      res.statusText;
    throw new EvolutionError(res.status, `Evolution ${method} ${path}: ${JSON.stringify(msg)}`, json);
  }
  return json as T;
}

export interface QrPayload {
  base64?: string;
  code?: string;
  pairingCode?: string | null;
  count?: number;
}

export function webhookUrl(instanceName: string) {
  return `${config.PUBLIC_WEBHOOK_BASE}/webhooks/evolution/${config.WEBHOOK_SECRET}/${instanceName}`;
}

export const evolution = {
  createInstance(instanceName: string) {
    return call<{ instance: { instanceName: string; instanceId?: string }; hash?: string | { apikey?: string }; qrcode?: QrPayload }>(
      "POST",
      "/instance/create",
      {
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: false,
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
        webhook: {
          url: webhookUrl(instanceName),
          byEvents: false,
          base64: true,
          events: WEBHOOK_EVENTS,
        },
      },
    );
  },

  /** Gera QR Code; com `number` gera também o código de pareamento de 8 dígitos. */
  connect(instanceName: string, number?: string) {
    const qs = number ? `?number=${encodeURIComponent(number)}` : "";
    return call<QrPayload>("GET", `/instance/connect/${instanceName}${qs}`);
  },

  connectionState(instanceName: string) {
    return call<{ instance: { instanceName: string; state: "open" | "close" | "connecting" } }>(
      "GET",
      `/instance/connectionState/${instanceName}`,
    );
  },

  setWebhook(instanceName: string) {
    return call("POST", `/webhook/set/${instanceName}`, {
      webhook: {
        enabled: true,
        url: webhookUrl(instanceName),
        byEvents: false,
        base64: true,
        events: WEBHOOK_EVENTS,
      },
    });
  },

  logout(instanceName: string) {
    return call("DELETE", `/instance/logout/${instanceName}`);
  },

  deleteInstance(instanceName: string) {
    return call("DELETE", `/instance/delete/${instanceName}`);
  },

  sendText(instanceName: string, number: string, text: string, delayMs = 800) {
    return call<{ key?: { id?: string; remoteJid?: string }; status?: string }>(
      "POST",
      `/message/sendText/${instanceName}`,
      { number, text, delay: delayMs, linkPreview: true },
      30_000,
    );
  },

  async ping(): Promise<boolean> {
    try {
      await call("GET", "/", undefined, 5_000);
      return true;
    } catch {
      return false;
    }
  },
};
