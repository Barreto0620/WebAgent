import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { maskPhone } from "@webagent/shared";
import { canManage, getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import { CAMPAIGN_STATUS } from "../status";
import { CampaignControls, AutoRefresh, SyncButton } from "./controls";

export const metadata: Metadata = { title: "Campanha" };

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

export default async function CampanhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, active, role } = await getSession();
  if (!active) redirect("/sistemas");
  if (!canManage(role, "supervisor")) redirect("/dashboard");

  const { data: c } = await supabase.from("campaigns").select("*").eq("id", id).eq("system_id", active.id).maybeSingle();
  if (!c) notFound();

  const { data: recipients } = await supabase
    .from("campaign_recipients")
    .select("id, status, error, sent_at, step, replied_at, send_after, next_at, lead_name, contacts!inner(name, push_name, phone, consent_status), messages(status)")
    .eq("campaign_id", c.id)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(300);

  const delivery = { delivered: 0, read: 0, failed: 0 };
  for (const r of recipients ?? []) {
    const ms = (r.messages as unknown as { status: string } | null)?.status;
    if (ms === "delivered") delivery.delivered++;
    if (ms === "read") {
      delivery.read++;
      delivery.delivered++;
    }
    if (ms === "failed") delivery.failed++;
  }
  const st = CAMPAIGN_STATUS[c.status];
  const done = c.sent + c.failed + c.skipped;
  const pct = c.total ? Math.round((done / c.total) * 100) : 0;
  const live = c.status === "running" || c.status === "scheduled";

  const isLeads = c.kind === "leads";
  const stats = [
    { label: isLeads ? "Leads" : "Destinatários", value: c.total },
    { label: "Enviadas", value: c.sent },
    { label: "Entregues", value: delivery.delivered },
    { label: "Lidas", value: delivery.read },
    { label: "Falhas", value: c.failed + delivery.failed, warn: c.failed + delivery.failed > 0 },
    { label: "Puladas", value: c.skipped },
    ...(isLeads ? [{ label: "Responderam", value: c.replied }, { label: "Sem interesse", value: c.opted_out }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      {live && <AutoRefresh />}
      <Link href="/campanhas" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Campanhas
      </Link>
      <PageHeader
        eyebrow={active.name}
        title={c.name}
        description={c.scheduled_at && c.status === "scheduled" ? `Agendada para ${dt.format(new Date(c.scheduled_at))}` : c.started_at ? `Iniciada ${timeAgo(c.started_at)}` : "Ainda não iniciada"}
        action={<CampaignControls id={c.id} status={c.status} />}
      />

      {c.status === "paused" && (
        <p className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
          Campanha pausada. Se foi automático, o WhatsApp deste sistema caiu: reconecte em Canais e clique em Retomar.
        </p>
      )}

      <Card className="p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <Badge tone={st.tone}>{st.label}</Badge>
          <span className="font-semibold tabular">{pct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-xs text-muted">{s.label}</dt>
              <dd className={`font-display text-xl font-extrabold tabular ${s.warn ? "text-danger" : ""}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader
            title={isLeads ? "Planilha" : "Mensagem"}
            action={isLeads && c.source_url && !["canceled"].includes(c.status) ? <SyncButton id={c.id} /> : undefined}
          />
          <div className="space-y-3 p-5 text-sm">
            {isLeads ? (
              <div className="space-y-1 rounded-xl bg-surface-2 p-3">
                <p className="font-semibold">{c.source_name ?? "Planilha"}</p>
                {c.source_url && <p className="truncate text-xs text-muted" title={c.source_url}>{c.source_url}</p>}
                <p className="text-xs text-muted">Mensagem de cada linha{c.followups_enabled ? " · acompanhamento automático ativo" : ""}{c.respect_day ? " · respeita a coluna de dia" : ""}</p>
              </div>
            ) : (
              <p className="rounded-xl bg-surface-2 p-3 whitespace-pre-wrap">{c.message}</p>
            )}
            <ul className="space-y-1 text-xs text-muted">
              {!isLeads && <li>Público: {c.audience_tags.length ? c.audience_tags.map((t) => `#${t}`).join(", ") : "todos com opt-in"}</li>}
              <li>Intervalo: {c.min_interval_s}–{c.max_interval_s} s · limite {c.daily_limit}/dia</li>
              <li>Janela: {c.window_start.slice(0, 5)} às {c.window_end.slice(0, 5)}</li>
            </ul>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="Destinatários" description={recipients && recipients.length >= 300 ? "Mostrando 300" : undefined} />
          <ul className="max-h-[480px] divide-y divide-line overflow-y-auto text-sm">
            {(recipients ?? []).length === 0 && <li className="px-5 py-8 text-center text-muted">A lista é montada quando a campanha é iniciada.</li>}
            {(recipients ?? []).map((r) => {
              const ct = r.contacts as unknown as { name: string | null; push_name: string | null; phone: string; consent_status: string };
              const ms = (r.messages as unknown as { status: string } | null)?.status;
              let label = r.status === "pending" ? "Na fila" : r.status === "skipped" ? "Pulado" : r.status === "failed" ? "Falhou" : ms === "read" ? "Lida" : ms === "delivered" ? "Entregue" : ms === "failed" ? "Falhou" : "Enviada";
              if (r.replied_at) label = ct.consent_status === "opt_out" ? "Sem interesse" : "Respondeu";
              const tone = label === "Falhou" || label === "Sem interesse" ? "danger" : label === "Respondeu" || label === "Lida" || label === "Entregue" ? "success" : label === "Na fila" ? "neutral" : label === "Pulado" ? "warning" : "info";
              const stepLabel = isLeads && r.step > 1 ? `+${r.step - 1} acomp.` : null;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 px-5 py-2.5">
                  <span className="min-w-0 flex-1 truncate font-medium">{r.lead_name ?? ct.name ?? ct.push_name ?? "Sem nome"}</span>
                  <span className="text-xs text-muted tabular">{maskPhone(ct.phone)}</span>
                  {r.status === "pending" && r.send_after && <span className="text-xs text-muted">dia {dayFmt.format(new Date(r.send_after))}</span>}
                  {stepLabel && <span className="text-xs text-muted">{stepLabel}</span>}
                  {r.next_at && !r.replied_at && <span className="text-xs text-muted">próximo {dayFmt.format(new Date(r.next_at))}</span>}
                  <Badge tone={tone}>{label}</Badge>
                  {r.error && r.status !== "sent" && <span className="w-full truncate text-xs text-danger">{r.error}</span>}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
