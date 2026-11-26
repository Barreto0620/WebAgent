import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { zonedParts } from "@webagent/shared";
import { canManage, getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { POST_STATUS, type PostStatus } from "./shared";

export const metadata: Metadata = { title: "Publicações" };

const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const dayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });

export default async function PublicacoesPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { supabase, active, role } = await getSession();
  if (!active) redirect("/sistemas");
  const manage = canManage(role, "supervisor");

  const today = zonedParts(new Date(), active.timezone).isoDate;
  const m = (await searchParams).m;
  const [y, mo] = (m && /^\d{4}-\d{2}$/.test(m) ? m : today.slice(0, 7)).split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const from = new Date(Date.UTC(y, mo - 1, 1) - 86_400_000).toISOString();
  const to = new Date(Date.UTC(y, mo, 1) + 86_400_000).toISOString();
  const prev = `${mo === 1 ? y - 1 : y}-${String(mo === 1 ? 12 : mo - 1).padStart(2, "0")}`;
  const next = `${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, "0")}`;

  const [{ data: monthPosts }, { data: drafts }, { data: accounts }] = await Promise.all([
    supabase.from("posts").select("id, caption, status, scheduled_at, published_at, post_targets(social_accounts(provider))").eq("system_id", active.id).or(`and(scheduled_at.gte.${from},scheduled_at.lt.${to}),and(published_at.gte.${from},published_at.lt.${to})`).limit(500),
    supabase.from("posts").select("id, caption, status, updated_at").eq("system_id", active.id).in("status", ["draft", "failed", "partial"]).order("updated_at", { ascending: false }).limit(20),
    supabase.from("social_accounts").select("id").eq("system_id", active.id),
  ]);

  const byDay = new Map<string, NonNullable<typeof monthPosts>>();
  for (const p of monthPosts ?? []) {
    const when = p.scheduled_at ?? p.published_at;
    if (!when) continue;
    const key = zonedParts(new Date(when), active.timezone).isoDate;
    byDay.set(key, [...(byDay.get(key) ?? []), p]);
  }
  const upcoming = (monthPosts ?? [])
    .filter((p) => p.status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at) > new Date())
    .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))
    .slice(0, 8);

  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={active.name}
        title="Publicações"
        description="Foto, vídeo, legenda e hashtags no Instagram, Facebook e TikTok, de uma vez só."
        action={
          manage ? (
            <Link href="/publicacoes/nova" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover">
              <Plus className="size-4" /> Nova publicação
            </Link>
          ) : undefined
        }
      />

      {(accounts ?? []).length === 0 && (
        <p className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
          Nenhuma rede social conectada neste sistema. Conecte em <Link href="/canais" className="font-semibold underline">Canais</Link> antes de agendar.
        </p>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_320px]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-display text-base font-bold capitalize">{monthFmt.format(first)}</h2>
            <div className="flex gap-1">
              <Link href={`/publicacoes?m=${prev}`} className="grid size-8 place-items-center rounded-lg hover:bg-surface-2" aria-label="Mês anterior"><ChevronLeft className="size-4" /></Link>
              <Link href="/publicacoes" className="rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-2">Hoje</Link>
              <Link href={`/publicacoes?m=${next}`} className="grid size-8 place-items-center rounded-lg hover:bg-surface-2" aria-label="Próximo mês"><ChevronRight className="size-4" /></Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="grid min-w-[560px] grid-cols-7 text-xs">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                <div key={d} className="border-b border-line px-2 py-2 text-center font-semibold text-muted">{d}</div>
              ))}
              {cells.map((d, i) => {
                const key = d ? `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` : `x${i}`;
                const items = d ? (byDay.get(key) ?? []) : [];
                return (
                  <div key={key} className={cn("min-h-24 border-r border-b border-line p-1.5", !d && "bg-surface-2/40", (i + 1) % 7 === 0 && "border-r-0")}>
                    {d && (
                      <>
                        <span className={cn("mb-1 inline-grid size-6 place-items-center rounded-full text-[11px] tabular", key === today ? "bg-primary font-bold text-on-primary" : "text-muted")}>{d}</span>
                        <ul className="flex flex-col gap-1">
                          {items.slice(0, 3).map((p) => {
                            const st = POST_STATUS[p.status as PostStatus];
                            return (
                              <li key={p.id}>
                                <Link href={`/publicacoes/${p.id}`} className="flex items-center gap-1 truncate rounded bg-surface-2 px-1.5 py-0.5 text-[11px] hover:bg-surface-3" title={p.caption}>
                                  <span className={cn("size-1.5 shrink-0 rounded-full", st.dot)} />
                                  <span className="truncate">{p.scheduled_at ? timeFmt.format(new Date(p.scheduled_at)) : ""} {p.caption || "Sem legenda"}</span>
                                </Link>
                              </li>
                            );
                          })}
                          {items.length > 3 && <li className="px-1 text-[10px] text-muted">+{items.length - 3}</li>}
                        </ul>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Próximas" />
            <ul className="divide-y divide-line">
              {upcoming.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">Nada agendado neste mês.</li>}
              {upcoming.map((p) => (
                <li key={p.id}>
                  <Link href={`/publicacoes/${p.id}`} className="flex flex-col gap-0.5 px-5 py-2.5 hover:bg-surface-2">
                    <span className="text-xs font-semibold text-primary capitalize">{dayFmt.format(new Date(p.scheduled_at!))} · {timeFmt.format(new Date(p.scheduled_at!))}</span>
                    <span className="truncate text-sm">{p.caption || "Sem legenda"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Rascunhos e pendências" />
            <ul className="divide-y divide-line">
              {(drafts ?? []).length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">Nenhum.</li>}
              {(drafts ?? []).map((p) => (
                <li key={p.id}>
                  <Link href={`/publicacoes/${p.id}`} className="flex items-center gap-2 px-5 py-2.5 hover:bg-surface-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{p.caption || "Sem legenda"}</span>
                    <Badge tone={POST_STATUS[p.status as PostStatus].tone}>{POST_STATUS[p.status as PostStatus].label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
