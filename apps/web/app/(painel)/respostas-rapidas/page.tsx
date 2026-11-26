import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canManage, getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { QuickRepliesEditor } from "./editor";

export const metadata: Metadata = { title: "Respostas rápidas" };

export default async function Page() {
  const { supabase, active, role } = await getSession();
  if (!active) redirect("/sistemas");
  if (!canManage(role, "supervisor")) redirect("/dashboard");
  const { data } = await supabase.from("quick_replies").select("id, shortcut, title, body").eq("system_id", active.id).order("shortcut");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={active.name}
        title="Respostas rápidas"
        description="Textos prontos para a equipe. No atendimento, digite / e o atalho. Aceitam as variáveis {{primeiro_nome}}, {{protocolo}} e {{sistema}}."
      />
      <QuickRepliesEditor items={data ?? []} />
    </div>
  );
}
