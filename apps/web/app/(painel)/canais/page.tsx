import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Camera, Globe, Music2 } from "lucide-react";
import { canManage, getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const soon = [
    { name: "Instagram", icon: Camera, note: "Direct e comentários · exige conta Business e aprovação da Meta" },
    { name: "Facebook", icon: Globe, note: "Messenger da Página · exige aprovação da Meta" },
    { name: "TikTok", icon: Music2, note: "Publicações de vídeo · exige auditoria do app no TikTok" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={active.name} title="Canais" description="Conecte o número de WhatsApp deste sistema. As outras redes entram aqui nas próximas etapas." />
      <WhatsAppChannels systemId={active.id} systemName={active.name} channels={channels ?? []} />

      <section aria-labelledby="soon-title" className="flex flex-col gap-3">
        <h2 id="soon-title" className="text-sm font-bold text-muted">Próximas redes</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {soon.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.name}>
                <Card className="flex h-full items-start gap-3 p-4 opacity-75">
                  <Icon className="mt-0.5 size-5 text-muted" aria-hidden />
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {s.name} <Badge>em breve</Badge>
                    </p>
                    <p className="mt-1 text-xs text-muted">{s.note}</p>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
