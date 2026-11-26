import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Megaphone, Plus } from "lucide-react";
import { canManage, getSession } from "@/lib/session";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import { CAMPAIGN_STATUS } from "./status";

export const metadata: Metadata = { title: "Campanhas" };

export default async function CampanhasPage() {
  const { supabase, active, role } = await getSession();
  if (!active) redirect("/sistemas");
  if (!canManage(role, "supervisor")) redirect("/dashboard");
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, status, total, sent, failed, skipped, audience_tags, scheduled_at, created_at")
    .eq("system_id", active.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={active.name}
        title="Campanhas"
        description="Mensagens para listas de contatos. Só recebe quem aceitou (opt-in), com intervalo aleatório entre envios para proteger o número."
        action={
          <Link href="/campanhas/nova" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover">
            <Plus className="size-4" /> Nova campanha
          </Link>
        }
      />
      {(campaigns ?? []).length === 0 ? (
        <EmptyState title="Nenhuma campanha ainda" icon={<Megaphone className="size-6" />}>
          Para alguém entrar numa campanha, o contato precisa estar como “Aceita mensagens”. Marque isso na ficha do contato, com a evidência de como o consentimento foi dado.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {(campaigns ?? []).map((c) => {
            const st = CAMPAIGN_STATUS[c.status];
            const done = c.sent + c.failed + c.skipped;
            const pct = c.total ? Math.round((done / c.total) * 100) : 0;
            return (
              <li key={c.id}>
                <Link href={`/campanhas/${c.id}`} className="block">
                  <Card className="flex flex-col gap-3 p-4 transition-colors hover:border-primary/50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-bold">{c.name}</p>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="flex flex-wrap gap-x-3 text-xs text-muted tabular">
                      <span>{c.sent} de {c.total} enviadas</span>
                      {c.failed > 0 && <span className="text-danger">{c.failed} falhas</span>}
                      <span>{c.audience_tags.length ? c.audience_tags.map((t) => `#${t}`).join(" ") : "todos com opt-in"}</span>
                      <span className="ml-auto">{timeAgo(c.created_at)}</span>
                    </p>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
