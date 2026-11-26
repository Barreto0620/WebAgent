"use server";
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/session";

export interface TeamRow {
  userId: string;
  role: "admin" | "supervisor" | "agent";
  fullName: string;
  email: string;
  isPlatformAdmin: boolean;
  lastSignInAt: string | null;
  addedAt: string;
}

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function wrap(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const message = await fn();
    revalidatePath("/equipe");
    return { ok: true, message: message ?? undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado." };
  }
}

export async function addMember(input: { email: string; fullName: string; role: string; password?: string }): Promise<Result> {
  const { active } = await getSession();
  if (!active) return { ok: false, error: "Selecione um sistema." };
  return wrap(async () => {
    const r = await apiFetch<{ created: boolean }>("/team", {
      method: "POST",
      body: { systemId: active.id, ...input, password: input.password || undefined },
    });
    return r.created ? "Conta criada. Passe o e-mail e a senha provisória para a pessoa." : "Pessoa adicionada ao sistema.";
  });
}

export async function changeRole(userId: string, role: string): Promise<Result> {
  const { active } = await getSession();
  if (!active) return { ok: false, error: "Selecione um sistema." };
  return wrap(async () => {
    await apiFetch(`/team/${userId}`, { method: "PATCH", body: { systemId: active.id, role } });
  });
}

export async function removeMember(userId: string): Promise<Result> {
  const { active } = await getSession();
  if (!active) return { ok: false, error: "Selecione um sistema." };
  return wrap(async () => {
    await apiFetch(`/team/${userId}?systemId=${active.id}`, { method: "DELETE" });
  });
}
