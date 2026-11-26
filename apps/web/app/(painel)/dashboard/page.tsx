import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, MessageCircle, MessagesSquare, PlugZap, Timer, CheckCheck } from "lucide-react";
import { hourInZone, startOfDayInZone } from "@webagent/shared";
import { getSession } from "@/lib/session";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { formatDuration, initials, timeAgo } from "@/lib/utils";
import { HourlyChart } from "./hourly-chart";

export const metadata: Metadata = { title: "Dashboard" };

function median(values: number[]) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export default async function DashboardPage() {
  const { supabase, active, profile } = await getSession();
  if (!active) {
    return (
      <EmptyState title="Nenhum sistema liberado para você" icon={<MessagesSquare className="size-6" />}>
        Peça a um administrador para incluir você em um sistema (Bookweb, Promoforia…).
      </EmptyState>
    );
  }

  const now = new Date();
  const since = startOfDayInZone(now, active.timezone);
  const yesterday = new Date(new Date(since).getTime() - 86_400_000).toISOString();

  const [convsToday, convsYesterday, queue, resolvedToday, msgsToday, channels] = await Promise.all([
    supabase.from("conversations").select("id, created_at, first_response_at, opened_outside_hours").eq("system_id", active.id).gte("created_at", since),
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("system_id", active.id).gte("created_at", yesterday).lt("created_at", since),
    supabase
      .from("conversations")
      .select("id, protocol, last_message_at, last_message_preview, created_at, contacts!inner(name, push_name)")
      .eq("system_id", active.id)
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(6),
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("system_id", active.id).eq("status", "resolved").gte("resolved_at", since),
    supabase.from("messages").select("direction, created_at").eq("system_id", active.id).eq("is_internal", false).gte("created_at", since).limit(5000),
    supabase.from("channels").select("id").eq("system_id", active.id),
  ]);

  const today = convsToday.data ?? [];
  const firstResp = today
    .filter((c) => c.first_response_at)
    .map((c) => (new Date(c.first_response_at!).getTime() - new Date(c.created_at).getTime()) / 1000);
  const med = median(firstResp);
  const outside = today.filter((c) => c.opened_outside_hours).length;
  const y = convsYesterday.count ?? 0;
  const delta = y > 0 ? Math.round(((today.length - y) / y) * 100) : null;

  const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, in: 0, out: 0 }));
  for (const m of msgsToday.data ?? []) {
    const h = hourInZone(new Date(m.created_at), active.timezone);
    buckets[h]![m.direction === "in" ? "in" : "out"]++;
  }

  const queueRows = queue.data ?? [];
  const firstName = (profile?.full_name ?? "").split(" ")[0];

  const kpis = [
    { label: "Conversas hoje", value: String(today.length), hint: delta === null ? "sem dados de ontem" : `${delta >= 0 ? "+" : ""}${delta}% vs ontem`, icon: MessageCircle },
    { label: "Na fila agora", value: String(queueRows.length), hint: queueRows.length ? "aguardando atendente" : "fila vazia", icon: Clock, warn: queueRows.length > 0 },
    { label: "1ª resposta (mediana)", value: formatDuration(med), hint: `${firstResp.length} conversa(s) respondida(s)`, icon: Timer },
    { label: "Resolvidas hoje", value: String(resolvedToday.count ?? 0), hint: `${outside} chegaram fora do horário`, icon: CheckCheck },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={active.name} title={firstName ? `Olá, ${firstName}` : "Dashboard"} description="Resumo do atendimento de hoje neste sistema." />

      {(channels.data ?? []).length === 0 && (
        <Card className="glow-neon flex flex-wrap items-center gap-4 p-5">
          <div className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
            <PlugZap className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">Conecte o WhatsApp do {active.name}</h2>
            <p className="text-sm text-muted">Leia o QR Code ou use o código de pareamento para começar a receber mensagens.</p>
          </div>
          <Link href="/canais" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover">
            Conectar número <ArrowRight className="size-4" />
          </Link>
        </Card>
      )}

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="flex flex-col gap-1 p-4">
              <div className="flex items-center justify-between text-muted">
                <span className="text-[12.5px]">{k.label}</span>
                <Icon className="size-4" aria-hidden />
              </div>
              <span className="font-display text-[26px] font-extrabold tabular">{k.value}</span>
              <span className={k.warn ? "text-xs text-gold" : "text-xs text-muted"}>{k.hint}</span>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="min-w-0">
          <CardHeader title="Mensagens por hora" description="Recebidas e enviadas hoje" />
          <div className="p-4">
            <HourlyChart data={buckets} currentHour={hourInZone(now, active.timezone)} />
          </div>
        </Card>

        <Card className="min-w-0">
          <CardHeader
            title="Aguardando atendente"
            action={
              <Link href="/atendimento" className="text-[13px] font-medium text-primary hover:underline">
                Abrir fila
              </Link>
            }
          />
          {queueRows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Ninguém esperando. Bom trabalho!</p>
          ) : (
            <ul className="divide-y divide-line">
              {queueRows.map((c) => {
                const contact = c.contacts as unknown as { name: string | null; push_name: string | null };
                const name = contact.name ?? contact.push_name ?? "Sem nome";
                const waitMin = (Date.now() - new Date(c.created_at).getTime()) / 60000;
                return (
                  <li key={c.id}>
                    <Link href={`/atendimento?c=${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-primary">{initials(name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{name}</span>
                        <span className="block truncate text-xs text-muted">{c.last_message_preview ?? c.protocol}</span>
                      </span>
                      <Badge tone={waitMin > 10 ? "danger" : waitMin > 3 ? "warning" : "success"}>{timeAgo(c.created_at)}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
