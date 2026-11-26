import {
  OPT_OUT_KEYWORDS,
  describeHours,
  evaluateBusinessHours,
  firstName,
  renderTemplate,
  type BusinessHoursRule,
  type OpenState,
} from "@webagent/shared";
import { db } from "../lib/supabase";

const OPT_IN_KEYWORDS = ["voltar", "retornar", "aceito"];

function normalizeWord(text: string | null) {
  return (text ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function detectConsentKeyword(text: string | null): "opt_out" | "opt_in" | null {
  const w = normalizeWord(text);
  if (!w) return null;
  if (OPT_OUT_KEYWORDS.includes(w)) return "opt_out";
  if (OPT_IN_KEYWORDS.includes(w)) return "opt_in";
  return null;
}

export interface SystemContext {
  id: string;
  name: string;
  timezone: string;
  settings: {
    welcome_enabled: boolean;
    welcome_message: string;
    away_enabled: boolean;
    away_message: string;
    closing_enabled: boolean;
    closing_message: string;
    opt_out_message: string;
    welcome_cooldown_minutes: number;
  };
  hours: BusinessHoursRule[];
  holidays: { date: string; name: string }[];
}

const cache = new Map<string, { at: number; value: SystemContext }>();
const CACHE_MS = 30_000;

/** Carrega regras do sistema (cache de 30 s para não consultar o banco a cada mensagem). */
export async function loadSystemContext(systemId: string): Promise<SystemContext> {
  const hit = cache.get(systemId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const [{ data: system, error }, { data: settings }, { data: hours }, { data: holidays }] = await Promise.all([
    db.from("systems").select("id, name, timezone").eq("id", systemId).single(),
    db.from("system_settings").select("*").eq("system_id", systemId).single(),
    db.from("business_hours").select("weekday, enabled, opens_at, closes_at, break_start, break_end").eq("system_id", systemId),
    db.from("holidays").select("date, name").or(`system_id.is.null,system_id.eq.${systemId}`),
  ]);
  if (error || !system || !settings) throw new Error(`Configuração do sistema ${systemId} não encontrada`);

  const value: SystemContext = {
    id: system.id,
    name: system.name,
    timezone: system.timezone,
    settings,
    hours: (hours ?? []).map((h) => ({
      ...h,
      opens_at: h.opens_at.slice(0, 5),
      closes_at: h.closes_at.slice(0, 5),
      break_start: h.break_start?.slice(0, 5) ?? null,
      break_end: h.break_end?.slice(0, 5) ?? null,
    })),
    holidays: holidays ?? [],
  };
  cache.set(systemId, { at: Date.now(), value });
  return value;
}

export function invalidateSystemContext(systemId: string) {
  cache.delete(systemId);
}

export function openState(ctx: SystemContext, now = new Date()): OpenState {
  return evaluateBusinessHours(ctx.hours, ctx.holidays, now, ctx.timezone);
}

export function templateVars(ctx: SystemContext, contactName: string | null | undefined, protocol: string) {
  return {
    nome: contactName ?? "",
    primeiro_nome: firstName(contactName) || "tudo bem",
    protocolo: protocol,
    sistema: ctx.name,
    horario: describeHours(ctx.hours),
  };
}

/** Escolhe a mensagem automática para o primeiro contato (ou null se não deve enviar). */
export function pickGreeting(ctx: SystemContext, state: OpenState, vars: Record<string, string>): string | null {
  if (!state.open && ctx.settings.away_enabled) {
    const base = renderTemplate(ctx.settings.away_message, vars);
    return state.reason === "holiday" && state.holiday ? `${base}\n\nHoje é feriado (${state.holiday}).` : base;
  }
  if (state.open && ctx.settings.welcome_enabled) return renderTemplate(ctx.settings.welcome_message, vars);
  return null;
}
