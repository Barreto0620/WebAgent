import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Inbox } from "./inbox";

export const metadata: Metadata = { title: "Atendimento" };

export default async function AtendimentoPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { supabase, active, user, profile } = await getSession();
  if (!active) redirect("/sistemas");
  const { c } = await searchParams;

  const [{ data: members }, { data: quickReplies }] = await Promise.all([
    supabase.from("system_members").select("user_id, role").eq("system_id", active.id),
    supabase.from("quick_replies").select("id, shortcut, title, body").eq("system_id", active.id).order("shortcut"),
  ]);
  const ids = [...new Set([...(members ?? []).map((m) => m.user_id), user.id])];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids);

  const team = ids.map((id) => {
    const p = profiles?.find((x) => x.id === id);
    return { id, name: p?.full_name || "Usuário", avatar: p?.avatar_url ?? null };
  });

  return (
    <Inbox
      system={{ id: active.id, name: active.name, protocolPrefix: active.protocol_prefix }}
      me={{ id: user.id, name: profile?.full_name || user.email || "" }}
      team={team}
      quickReplies={quickReplies ?? []}
      initialConversationId={c ?? null}
    />
  );
}
