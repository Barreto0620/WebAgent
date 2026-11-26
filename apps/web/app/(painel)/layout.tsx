import { describeHours, evaluateBusinessHours, zonedParts } from "@webagent/shared";
import { AppShell, type ShellStatus } from "@/components/app-shell";
import { getSession } from "@/lib/session";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  // Uma única chamada ao banco: perfil, sistemas e status do sistema ativo
  const { user, profile, systems, active, role, status: st } = await getSession();

  let status: ShellStatus = { channel: "none", open: false, openLabel: "Sem sistema ativo" };
  let queued = 0;

  if (active && st) {
    const rules = st.hours;
    const state = evaluateBusinessHours(rules, st.holidays, new Date(), active.timezone);
    const today = rules.find((r) => r.weekday === zonedParts(new Date(), active.timezone).weekday);
    const label = state.open
      ? `Aberto até ${today?.closes_at ?? ""}`
      : state.reason === "holiday"
        ? `Fechado · ${state.holiday}`
        : state.reason === "break"
          ? "Em pausa"
          : `Fechado · ${describeHours(rules)}`;
    const ch = st.channels;
    const channel: ShellStatus["channel"] =
      ch.length === 0
        ? "none"
        : ch.includes("connected")
          ? "connected"
          : ch.includes("connecting")
            ? "connecting"
            : ch.includes("error")
              ? "error"
              : "disconnected";
    status = { channel, open: state.open, openLabel: label };
    queued = st.queued;
  }

  return (
    <AppShell
      systems={systems.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
      activeId={active?.id ?? null}
      role={role}
      queued={queued}
      status={status}
      user={{ name: profile?.full_name || user.email, email: user.email, avatar: profile?.avatar_url ?? null, theme: profile?.theme ?? "dark" }}
    >
      {children}
    </AppShell>
  );
}
