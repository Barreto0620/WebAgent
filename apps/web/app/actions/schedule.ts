"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession, canManage } from "@/lib/session";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");

const daySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    enabled: z.boolean(),
    opens_at: time,
    closes_at: time,
    break_start: time.nullable(),
    break_end: time.nullable(),
  })
  .refine((d) => d.closes_at > d.opens_at, { message: "O fechamento precisa ser depois da abertura." })
  .refine((d) => (d.break_start === null) === (d.break_end === null), { message: "Informe início e fim da pausa." })
  .refine((d) => !d.break_start || (d.break_start >= d.opens_at && d.break_end! <= d.closes_at && d.break_end! > d.break_start), {
    message: "A pausa precisa estar dentro do horário de funcionamento.",
  });

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export async function saveBusinessHours(days: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = z.array(daySchema).length(7).safeParse(days);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const idx = typeof issue?.path[0] === "number" ? issue.path[0] : null;
    return { ok: false, error: `${idx !== null ? `${DAY_NAMES[(days as { weekday: number }[])[idx]?.weekday ?? 0]}: ` : ""}${issue?.message ?? "Dados inválidos."}` };
  }
  const { active, role } = await getSession();
  if (!active || !canManage(role, "supervisor")) return { ok: false, error: "Você não tem permissão para alterar horários." };

  const supabase = await createClient();
  for (const d of parsed.data) {
    const { error } = await supabase
      .from("business_hours")
      .update({ enabled: d.enabled, opens_at: d.opens_at, closes_at: d.closes_at, break_start: d.break_start, break_end: d.break_end })
      .eq("system_id", active.id)
      .eq("weekday", d.weekday);
    if (error) return { ok: false, error: `Não foi possível salvar ${DAY_NAMES[d.weekday]}.` };
  }
  await supabase.rpc("log_audit", { p_system: active.id, p_action: "hours.update", p_entity: "business_hours", p_entity_id: active.id });
  revalidatePath("/", "layout");
  return { ok: true };
}

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  name: z.string().trim().min(2, "Informe o nome do feriado.").max(80),
});

export async function addHoliday(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = holidaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const { active, role } = await getSession();
  if (!active || !canManage(role, "supervisor")) return { ok: false, error: "Sem permissão." };
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").insert({ system_id: active.id, ...parsed.data });
  if (error) return { ok: false, error: error.code === "23505" ? "Já existe um feriado nesta data." : "Não foi possível salvar." };
  revalidatePath("/horarios");
  return { ok: true };
}

export async function removeHoliday(id: string): Promise<{ ok: boolean; error?: string }> {
  const { active, role } = await getSession();
  if (!active || !canManage(role, "supervisor")) return { ok: false, error: "Sem permissão." };
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").delete().eq("id", id).eq("system_id", active.id);
  if (error) return { ok: false, error: "Não foi possível remover." };
  revalidatePath("/horarios");
  return { ok: true };
}

const settingsSchema = z.object({
  welcome_enabled: z.boolean(),
  welcome_message: z.string().trim().min(5).max(1000),
  away_enabled: z.boolean(),
  away_message: z.string().trim().min(5).max(1000),
  closing_enabled: z.boolean(),
  closing_message: z.string().trim().min(5).max(1000),
  opt_out_message: z.string().trim().min(5).max(500),
  csat_enabled: z.boolean(),
  csat_message: z.string().trim().min(5).max(500),
});

export async function saveAutomations(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Todas as mensagens precisam ter entre 5 e 1.000 caracteres." };
  const { active, role } = await getSession();
  if (!active || !canManage(role, "supervisor")) return { ok: false, error: "Sem permissão." };
  const supabase = await createClient();
  const { error } = await supabase.from("system_settings").update(parsed.data).eq("system_id", active.id);
  if (error) return { ok: false, error: "Não foi possível salvar." };
  await supabase.rpc("log_audit", { p_system: active.id, p_action: "automations.update", p_entity: "system_settings", p_entity_id: active.id });
  revalidatePath("/automacoes");
  return { ok: true };
}
