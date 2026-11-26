import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { startOfDayInZone, zonedParts } from "@webagent/shared";
import { canManage, getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, formatDuration } from "@/lib/utils";
import { DailyChart } from "./daily-chart";
import { ExportCsv } from "./export-csv";

export const metadata: Metadata = { title: "Relatórios" };

const PERIODS = [7, 30, 90] as const;

function median(v: number[]) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { supabase, active, role } = await getSession();
  if (!active) redirect("/sistemas");
  if (!canManage(role, "supervisor")) redirect("/dashboard");

  const d = Number((await searchParams).d);
  const days = (PERIODS as readonly number[]).includes(d) ? d : 30;
  const now = new Date();
  const since = new Date(new Date(startOfDayInZone(now, active.timezone)).getTime() - (days - 1) * 86_400_000).toISOString();

  const [{ data: convs }, { data: members }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, created_at, first_response_at, resolved_at, status, assignee_id, csat_score, opened_outside_hours")
      .eq("system_id", active.id)
      .gte("created_at", since)
      .limit(10000),
    supabase.from("system_members").select("user_id").eq("system_id", active.id),
  ]);
  const rows = convs ?? [];
  const ids = [...new Set([...(members ?? []).map((m) => m.user_id), ...rows.map((r) => r.assignee_id).filter(Boolean) as string[]])];
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };

  const secs = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 1000;
  const firstResp = rows.filter((r) => r.first_response_at).map((r) => secs(r.created_at, r.first_response_at!));
  const resolution = rows.filter((r) => r.resolved_at).map((r) => secs(r.created_at, r.resolved_at!));
  const csat = rows.filter((r) => r.csat_score !== null).map((r) => r.csat_score!);
  const csatAvg = csat.length ? csat.reduce((a, b) => a + b, 0) / csat.length : null;
  const satisfied = csat.filter((s) => s >= 4).length;
  const outside = rows.filter((r) => r.opened_outside_hours).length;
  const resolved = rows.filter((r) => r.status === "resolved").length;

  // Série diária no fuso do sistema
  const series = Array.from({ length: days }, (_, i) => {
    const day = new Date(new Date(since).getTime() + i * 86_400_000 + 12 * 3_600_000);
    return { key: zonedParts(day, active.timezone).isoDate, opened: 0, resolved: 0 };
  });
  const idx = new Map(series.map((s, i) => [s.key, i]));
  for (const r of rows) {
    const k = zonedParts(new Date(r.created_at), active.timezone).isoDate;
    const i = idx.get(k);
    if (i !== undefined) series[i]!.opened++;
    if (r.resolved_at) {
      const kr = zonedParts(new Date(r.resolved_at), active.timezone).isoDate;
      const j = idx.get(kr);
      if (j !== undefined) series[j]!.resolved++;
    }
  }

  const agents = ids
    .map((id) => {
      const mine = rows.filter((r) => r.assignee_id === id);
      const fr = mine.filter((r) => r.first_response_at).map((r) => secs(r.created_at, r.first_response_at!));
      const sc = mine.filter((r) => r.csat_score !== null).map((r) => r.csat_score!);
      return {
        id,
        name: profiles?.find((p) => p.id === id)?.full_name || "Usuário",
        handled: mine.length,
        resolved: mine.filter((r) => r.status === "resolved").length,
        firstResponse: median(fr),
        csat: sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null,
        csatCount: sc.length,
      };
    })
    .filter((a) => a.handled > 0)
    .sort((a, b) => b.handled - a.handled);

  const kpis = [
    { label: "Conversas", value: String(rows.length), hint: `${resolved} resolvidas` },
    { label: "1ª resposta (mediana)", value: formatDuration(median(firstResp)), hint: `${firstResp.length} respondidas` },
    { label: "Tempo até resolver (mediana)", value: formatDuration(median(resolution)), hint: `${resolution.length} resolvidas` },
    { label: "Satisfação (CSAT)", value: csatAvg === null ? "—" : `${csatAvg.toFixed(1)}/5`, hint: csat.length ? `${Math.round((satisfied / csat.length) * 100)}% notas 4 e 5 · ${csat.length} respostas` : "sem respostas ainda" },
    { label: "Fora do horário", value: rows.length ? `${Math.round((outside / rows.length) * 100)}%` : "—", hint: `${outside} conversas` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={active.name}
        title="Relatórios"
        description="Desempenho do atendimento no período. Tempos medidos desde a abertura da conversa."
        action={
          <div className="flex items-center gap-2">
            <nav aria-label="Período" className="flex rounded-lg bg-surface-2 p-1">
              {PERIODS.map((p) => (
                <Link key={p} href={`/relatorios?d=${p}`} aria-current={p === days ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-[13px] font-semibold", p === days ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg")}>
                  {p} dias
                </Link>
              ))}
            </nav>
            <ExportCsv
              filename={`webagent-${active.slug}-${days}d.csv`}
              rows={agents.map((a) => ({ atendente: a.name, conversas: a.handled, resolvidas: a.resolved, primeira_resposta_mediana_s: a.firstResponse === null ? "" : Math.round(a.firstResponse), csat_media: a.csat === null ? "" : a.csat.toFixed(2), csat_respostas: a.csatCount }))}
            />
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label} className="flex flex-col gap-1 p-4">
            <span className="text-[12.5px] text-muted">{k.label}</span>
            <span className="font-display text-[24px] font-extrabold tabular">{k.value}</span>
            <span className="text-xs text-muted">{k.hint}</span>
          </Card>
        ))}
      </section>

      <Card className="min-w-0">
        <CardHeader title="Conversas por dia" description="Abertas e resolvidas" />
        <div className="p-4">
          <DailyChart data={series} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Por atendente" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Atendente</th>
                <th className="px-3 py-3 text-right font-medium">Conversas</th>
                <th className="px-3 py-3 text-right font-medium">Resolvidas</th>
                <th className="px-3 py-3 text-right font-medium">1ª resposta</th>
                <th className="px-5 py-3 text-right font-medium">CSAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular">
              {agents.map((a) => (
                <tr key={a.id}>
                  <td className="px-5 py-3 font-medium">{a.name}</td>
                  <td className="px-3 py-3 text-right">{a.handled}</td>
                  <td className="px-3 py-3 text-right">{a.resolved}</td>
                  <td className="px-3 py-3 text-right">{formatDuration(a.firstResponse)}</td>
                  <td className="px-5 py-3 text-right">{a.csat === null ? "—" : `${a.csat.toFixed(1)} (${a.csatCount})`}</td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">Nenhuma conversa atribuída no período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
