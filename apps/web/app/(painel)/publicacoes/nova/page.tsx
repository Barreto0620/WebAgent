import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { canManage, getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Composer } from "../composer";

export const metadata: Metadata = { title: "Nova publicação" };

export default async function NovaPublicacaoPage() {
  const { supabase, active, role } = await getSession();
  if (!active) redirect("/sistemas");
  if (!canManage(role, "supervisor")) redirect("/publicacoes");
  const { data: accounts } = await supabase.from("social_accounts").select("id, provider, name, avatar_url, status").eq("system_id", active.id).order("provider");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={active.name} title="Nova publicação" />
      <Composer systemId={active.id} postId={randomUUID()} initial={{ caption: "", hashtags: [], media: [], accountIds: [] }} accounts={accounts ?? []} />
    </div>
  );
}
