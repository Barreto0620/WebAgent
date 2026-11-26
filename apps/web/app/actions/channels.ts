"use server";
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado." };
  }
}

export async function createChannel(systemId: string, name: string) {
  const r = await wrap(() => apiFetch<{ id: string }>("/channels", { method: "POST", body: { systemId, name } }));
  revalidatePath("/canais");
  return r;
}

export async function connectChannel(channelId: string, phone?: string) {
  return wrap(() =>
    apiFetch<{ qrBase64: string | null; pairingCode: string | null }>(`/channels/${channelId}/connect`, {
      method: "POST",
      body: phone ? { phone } : {},
    }),
  );
}

export async function channelStatus(channelId: string) {
  return wrap(() => apiFetch<{ status: "connected" | "connecting" | "disconnected" | "error" }>(`/channels/${channelId}/status`));
}

export async function logoutChannel(channelId: string) {
  const r = await wrap(() => apiFetch(`/channels/${channelId}/logout`, { method: "POST" }));
  revalidatePath("/canais");
  return r;
}

export async function deleteChannel(channelId: string) {
  const r = await wrap(() => apiFetch(`/channels/${channelId}`, { method: "DELETE" }));
  revalidatePath("/canais");
  return r;
}
