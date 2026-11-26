import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { describeHours } from "@webagent/shared";
import { canManage, getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { AutomationsEditor } from "./automations-editor";

export const metadata: Metadata = { title: "Mensagens automáticas" };

export default async function AutomacoesPage() {
  const { supabase, active, role } = await getSession();
  if (!active) redirect("/sistemas");
  if (!canManage(role, "supervisor")) redirect("/dashboard");

  const [{ data: settings }, { data: hours }] = await Promise.all([
    supabase.from("system_settings").select("*").eq("system_id", active.id).single(),
    supabase.from("business_hours").select("weekday, enabled, opens_at, closes_at").eq("system_id", active.id),
  ]);
  if (!settings) redirect("/dashboard");

  const horario = describeHours((hours ?? []).map((h) => ({ ...h, opens_at: h.opens_at.slice(0, 5), closes_at: h.closes_at.slice(0, 5) })));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={active.name}
        title="Mensagens automáticas"
        description="O que o WhatsApp responde sozinho. Toda conversa nova ganha um número de protocolo, que você pode incluir nas mensagens."
      />
      <AutomationsEditor
        initial={{
          welcome_enabled: settings.welcome_enabled,
          welcome_message: settings.welcome_message,
          away_enabled: settings.away_enabled,
          away_message: settings.away_message,
          closing_enabled: settings.closing_enabled,
          closing_message: settings.closing_message,
          opt_out_message: settings.opt_out_message,
          csat_enabled: settings.csat_enabled,
          csat_message: settings.csat_message,
        }}
        sample={{ sistema: active.name, horario, protocolo: `${active.protocol_prefix}-261126-0042`, nome: "Marina Souza", primeiro_nome: "Marina" }}
      />
    </div>
  );
}
