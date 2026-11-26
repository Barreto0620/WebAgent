import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canManage, getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { HoursEditor } from "./hours-editor";
import { HolidaysCard } from "./holidays-card";

export const metadata: Metadata = { title: "Horários" };

export default async function HorariosPage() {
  const { supabase, active, role } = await getSession();
  if (!active) redirect("/sistemas");
  if (!canManage(role, "supervisor")) redirect("/dashboard");

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: hours }, { data: holidays }] = await Promise.all([
    supabase.from("business_hours").select("weekday, enabled, opens_at, closes_at, break_start, break_end").eq("system_id", active.id).order("weekday"),
    supabase.from("holidays").select("id, date, name, system_id").or(`system_id.is.null,system_id.eq.${active.id}`).gte("date", today).order("date").limit(40),
  ]);

  const days = (hours ?? []).map((h) => ({
    weekday: h.weekday,
    enabled: h.enabled,
    opens_at: h.opens_at.slice(0, 5),
    closes_at: h.closes_at.slice(0, 5),
    break_start: h.break_start?.slice(0, 5) ?? null,
    break_end: h.break_end?.slice(0, 5) ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={active.name}
        title="Horário de funcionamento"
        description={`Fora deste horário, quem chamar recebe automaticamente a mensagem de ausência com o protocolo. Fuso: ${active.timezone.replace("_", " ")}.`}
      />
      <div className="grid items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
        <HoursEditor initial={days} />
        <HolidaysCard holidays={holidays ?? []} />
      </div>
    </div>
  );
}
