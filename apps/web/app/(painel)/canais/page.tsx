import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { canManage, getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { socialProviders } from "@/app/actions/social";
import { SocialAccounts } from "./social-accounts";
import { WhatsAppChannels } from "./whatsapp-channels";

export const metadata: Metadata = { title: "Canais" };

export default async function CanaisPage() {
  const { supabase, active, role } = await getSession();
  if (!active) redirect("/sistemas");
  if (!canManage(role, "admin")) redirect("/dashboard");

  const { data: channels } = await supabase
    .from("channels")
    .select("id, name, status, phone, profile_name, profile_picture_url, connected_at, last_status_at")
    .eq("system_id", active.id)
    .eq("type", "whatsapp")
    .order("created_at");
  const [{ data: social }, configured] = await Promise.all([
    supabase.from("social_accounts").select("id, provider, name, avatar_url, status, status_detail, created_at").eq("system_id", active.id).order("provider"),
    socialProviders(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={active.name} title="Canais" description="O número de WhatsApp do atendimento e as redes sociais usadas em Publicações." />
      <WhatsAppChannels systemId={active.id} systemName={active.name} channels={channels ?? []} />

      <Suspense>
        <SocialAccounts accounts={social ?? []} configured={configured} />
      </Suspense>
    </div>
  );
}
