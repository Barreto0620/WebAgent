/**
 * Avalia se um sistema está dentro do horário de funcionamento.
 * Funciona igual no painel e na API (mesma regra nos dois lados).
 */
export interface BusinessHoursRule {
  /** 0 = domingo ... 6 = sábado */
  weekday: number;
  enabled: boolean;
  /** "HH:MM" */
  opens_at: string;
  /** "HH:MM" */
  closes_at: string;
  /** Pausa opcional (ex.: almoço) */
  break_start?: string | null;
  break_end?: string | null;
}

export interface Holiday {
  /** "YYYY-MM-DD" */
  date: string;
  name: string;
}

export interface OpenState {
  open: boolean;
  reason: "open" | "closed_day" | "before_open" | "after_close" | "break" | "holiday";
  holiday?: string;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Retorna data/hora "de parede" no fuso informado. */
export function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: weekdayMap[parts.weekday as string] ?? 0,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function evaluateBusinessHours(
  rules: BusinessHoursRule[],
  holidays: Holiday[],
  now: Date,
  timeZone: string,
): OpenState {
  const { isoDate, weekday, minutes } = zonedParts(now, timeZone);
  const holiday = holidays.find((h) => h.date === isoDate);
  if (holiday) return { open: false, reason: "holiday", holiday: holiday.name };

  const rule = rules.find((r) => r.weekday === weekday);
  if (!rule || !rule.enabled) return { open: false, reason: "closed_day" };

  const opens = toMinutes(rule.opens_at);
  const closes = toMinutes(rule.closes_at);
  if (minutes < opens) return { open: false, reason: "before_open" };
  if (minutes >= closes) return { open: false, reason: "after_close" };

  if (rule.break_start && rule.break_end) {
    const bs = toMinutes(rule.break_start);
    const be = toMinutes(rule.break_end);
    if (minutes >= bs && minutes < be) return { open: false, reason: "break" };
  }
  return { open: true, reason: "open" };
}

/** Texto curto para exibir no painel, ex.: "seg. a sex., 08:00–18:00". */
export function describeHours(rules: BusinessHoursRule[]): string {
  const names = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
  const enabled = rules.filter((r) => r.enabled).sort((a, b) => a.weekday - b.weekday);
  if (enabled.length === 0) return "Sem horário definido";
  const first = enabled[0]!;
  const same = enabled.every((r) => r.opens_at === first.opens_at && r.closes_at === first.closes_at);
  const contiguous = enabled.every((r, i) => i === 0 || r.weekday === enabled[i - 1]!.weekday + 1);
  if (same && contiguous && enabled.length > 1) {
    return `${names[first.weekday]} a ${names[enabled.at(-1)!.weekday]}, ${first.opens_at}–${first.closes_at}`;
  }
  return enabled.map((r) => `${names[r.weekday]} ${r.opens_at}–${r.closes_at}`).join(" · ");
}
