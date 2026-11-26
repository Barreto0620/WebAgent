import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { maskPhone } from "@webagent/shared";
import { canManage, getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import { DataRequests, RetentionForm, TitularTools } from "./privacy-client";

export const metadata: Metadata = { title: "Privacidade (LGPD)" };

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

const ACTION_LABEL: Record<string, string> = {
  "channel.create": "criou canal",
  "channel.logout": "desconectou número",
  "channel.delete": "removeu canal",
  "conversation.resolve": "encerrou conversa",
  "conversation.assume": "assumiu conversa",
  "conversation.transfer": "transferiu conversa",
  "contact.reveal_phone": "viu telefone completo",
  "hours.update": "alterou horário",
  "automations.update": "alterou mensagens automáticas",
  "team.create_user": "criou conta",
  "team.add_member": "adicionou pessoa",
  "team.change_role": "mudou papel",
  "team.remove_member": "removeu acesso",
  "privacy.export": "exportou dados de titular",
  "privacy.anonymize": "anonimizou titular",
  "privacy.retention_change": "alterou retenção",
  "profile.password_change": "trocou a senha",
  "campaign.start": "iniciou campanha",
};

export default async function PrivacidadeDadosPage() {
  const { supabase, active, role } = await getSession();
  if (!active) redirect("/sistemas");
  if (!canManage(role, "supervisor")) redirect("/dashboard");
  const isAdmin = canManage(role, "admin");

  const [{ data: requests }, { data: consents }, { data: settings }, { data: audit }] = await Promise.all([
    supabase.from("data_requests").select("id, requester_name, requester_contact, type, status, notes, due_at, created_at, contact_id").eq("system_id", active.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("consent_events").select("id, status, source, evidence, created_at, contacts!inner(name, push_name, phone)").eq("system_id", active.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("system_settings").select("retention_days").eq("system_id", active.id).single(),
    isAdmin ? supabase.from("audit_logs").select("id, action, entity, actor_id, created_at").eq("system_id", active.id).order("created_at", { ascending: false }).limit(60) : Promise.resolve({ data: [] as { id: number; action: string; entity: string; actor_id: string | null; created_at: string }[] }),
  ]);
  const actorIds = [...new Set((audit ?? []).map((a) => a.actor_id).filter(Boolean) as string[])];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, full_name").in("id", actorIds) : { data: [] };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={active.name}
        title="Privacidade (LGPD)"
        description="Pedidos dos titulares, exportação e anonimização de dados, prazo de guarda e trilha de auditoria."
      />

      <DataRequests requests={requests ?? []} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <TitularTools isAdmin={isAdmin} />
        <RetentionForm days={settings?.retention_days ?? 730} isAdmin={isAdmin} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Histórico de consentimento" description="Registro imutável de opt-in e opt-out (palavras SAIR/VOLTAR ou registro do atendente)." />
        <ul className="divide-y divide-line text-sm">
          {(consents ?? []).length === 0 && <li className="px-5 py-6 text-center text-muted">Nenhum registro ainda.</li>}
          {(consents ?? []).map((c) => {
            const ct = c.contacts as unknown as { name: string | null; push_name: string | null; phone: string };
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5">
                <Badge tone={c.status === "opt_in" ? "success" : c.status === "opt_out" ? "danger" : "neutral"}>{c.status === "opt_in" ? "Aceitou" : c.status === "opt_out" ? "Descadastrou" : "—"}</Badge>
                <span className="font-medium">{ct.name ?? ct.push_name ?? "Sem nome"}</span>
                <span className="text-muted tabular">{maskPhone(ct.phone)}</span>
                <span className="text-xs text-muted">via {c.source === "keyword" ? "palavra-chave" : c.source === "agent" ? "atendente" : c.source}</span>
                <span className="ml-auto text-xs text-muted">{timeAgo(c.created_at)}</span>
                {c.evidence && <span className="w-full truncate text-xs text-muted">{c.evidence}</span>}
              </li>
            );
          })}
        </ul>
      </Card>

      {isAdmin && (
        <Card className="overflow-hidden">
          <CardHeader title="Auditoria" description="Ações sensíveis feitas no sistema. Somente administradores veem." />
          <ul className="divide-y divide-line text-sm">
            {(audit ?? []).length === 0 && <li className="px-5 py-6 text-center text-muted">Nenhuma ação registrada.</li>}
            {(audit ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 px-5 py-2.5">
                <span className="w-32 shrink-0 text-xs text-muted tabular">{dt.format(new Date(a.created_at))}</span>
                <span className="font-medium">{actors?.find((x) => x.id === a.actor_id)?.full_name ?? "Sistema"}</span>
                <span className="text-muted">{ACTION_LABEL[a.action] ?? a.action}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
