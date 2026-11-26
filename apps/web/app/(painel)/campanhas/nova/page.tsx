import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canManage, getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { CampaignForm } from "./campaign-form";
import { LeadCampaignForm } from "./lead-campaign-form";
import { SourceTabs } from "./source-tabs";

export const metadata: Metadata = { title: "Nova campanha" };

export default async function NovaCampanhaPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { supabase, active, role } = await getSession();
  if (!active) redirect("/sistemas");
  if (!canManage(role, "supervisor")) redirect("/dashboard");
  const tipo = (await searchParams).tipo === "optin" ? "optin" : "leads";

  let tags: { tag: string; count: number }[] = [];
  let optInTotal = 0;
  if (tipo === "optin") {
    const { data: rows } = await supabase.from("contacts").select("tags").eq("system_id", active.id).eq("consent_status", "opt_in").limit(5000);
    const counts = new Map<string, number>();
    for (const r of rows ?? []) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    tags = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
    optInTotal = (rows ?? []).length;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={active.name} title="Nova campanha" description="Revise com calma: depois de iniciada, as mensagens não podem ser editadas." />
      <SourceTabs current={tipo} />
      {tipo === "leads" ? <LeadCampaignForm timezone={active.timezone} /> : <CampaignForm tags={tags} optInTotal={optInTotal} systemName={active.name} />}
    </div>
  );
}
