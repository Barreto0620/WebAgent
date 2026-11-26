import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canManage, getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { CampaignForm } from "./campaign-form";

export const metadata: Metadata = { title: "Nova campanha" };

export default async function NovaCampanhaPage() {
  const { supabase, active, role } = await getSession();
  if (!active) redirect("/sistemas");
  if (!canManage(role, "supervisor")) redirect("/dashboard");
  const { data: rows } = await supabase.from("contacts").select("tags").eq("system_id", active.id).eq("consent_status", "opt_in").limit(5000);
  const counts = new Map<string, number>();
  for (const r of rows ?? []) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={active.name} title="Nova campanha" description="Revise com calma: depois de iniciada, a mensagem não pode ser editada." />
      <CampaignForm tags={tags} optInTotal={(rows ?? []).length} systemName={active.name} />
    </div>
  );
}
