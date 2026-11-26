import { describeHours, evaluateBusinessHours, zonedParts } from "@webagent/shared";
import { AppShell, type ShellStatus } from "@/components/app-shell";
import { getSession } from "@/lib/session";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile, systems, active, role } = await getSession();

  let status: ShellStatus = { channel: "none", open: false, openLabel: "Sem sistema ativo" };
  let queued = 0;

  if (active) {
    const [{ data: channels }, { data: hours }, { data: holidays }, { count }] = await Promise.all([
      supabase.from("channels").select("status").eq("system_id", active.id),
      supabase.from("business_hours").select("weekday, enabled, opens_at, closes_at, break_start, break_end").eq("system_id", active.id),
      supabase.from("holidays").select("date, name").or(`system_id.is.null,system_id.eq.${active.id}`),
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("system_id", active.id).eq("status", "queued"),
    ]);
    const rules = (hours ?? []).map((h) => ({ ...h, opens_at: h.opens_at.slice(0, 5), closes_at: h.closes_at.slice(0, 5), break_start: h.break_start?.slice(0, 5), break_end: h.break_end?.slice(0, 5) }));
    const st = evaluateBusinessHours(rules, holidays ?? [], new Date(), active.timezone);
    const today = rules.find((r) => r.weekday === zonedParts(new Date(), active.timezone).weekday);
    const label = st.open
      ? `Aberto até ${today?.closes_at ?? ""}`
      : st.reason === "holiday"
        ? `Fechado · ${st.holiday}`
        : st.reason === "break"
          ? "Em pausa"
          : `Fechado · ${describeHours(rules)}`;
    const ch = channels ?? [];
    const channel: ShellStatus["channel"] = ch.length === 0
      ? "none"
      : ch.some((c) => c.status === "connected")
        ? "connected"
        : ch.some((c) => c.status === "connecting")
          ? "connecting"
          : ch.some((c) => c.status === "error")
            ? "error"
            : "disconnected";
    status = { channel, open: st.open, openLabel: label };
    queued = count ?? 0;
  }

  return (
    <AppShell
      systems={systems.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
      activeId={active?.id ?? null}
      role={role}
      queued={queued}
      status={status}
      user={{ name: profile?.full_name || user.email || "", email: user.email ?? "", avatar: profile?.avatar_url ?? null, theme: profile?.theme ?? "dark" }}
    >
      {children}
    </AppShell>
  );
}
