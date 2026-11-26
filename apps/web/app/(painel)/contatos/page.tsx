import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Search, Users } from "lucide-react";
import { maskPhone } from "@webagent/shared";
import { getSession } from "@/lib/session";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { initials, timeAgo } from "@/lib/utils";
import { NewContactButton, StartConversationButton } from "./contact-actions";

export const metadata: Metadata = { title: "Contatos" };

const CONSENT = {
  opt_in: { tone: "success" as const, label: "Aceita mensagens" },
  opt_out: { tone: "danger" as const, label: "Descadastrado" },
  unknown: { tone: "neutral" as const, label: "Sem registro" },
};

export default async function ContatosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase, active } = await getSession();
  if (!active) redirect("/sistemas");
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);

  let query = supabase
    .from("contacts")
    .select("id, name, push_name, phone, tags, consent_status, last_inbound_at", { count: "exact" })
    .eq("system_id", active.id)
    .order("last_inbound_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (q) {
    const digits = q.replace(/\D/g, "");
    const safe = q.replace(/[%,()]/g, " ");
    query = digits.length >= 4 ? query.ilike("phone", `%${digits}%`) : query.or(`name.ilike.%${safe}%,push_name.ilike.%${safe}%`);
  }
  const { data: contacts, count } = await query;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={active.name} title="Contatos" description="Quem já falou com este sistema pelo WhatsApp. O contato é criado sozinho na primeira mensagem." />
      <div className="flex flex-wrap items-start gap-3">
      <form className="relative min-w-0 flex-1 basis-64 sm:max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input name="q" defaultValue={q} placeholder="Buscar por nome ou telefone" aria-label="Buscar contatos" className="h-10 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm focus:border-primary focus:outline-none" />
      </form>
      <NewContactButton />
      </div>

      {(contacts ?? []).length === 0 ? (
        <EmptyState title={q ? "Nenhum contato encontrado" : "Nenhum contato ainda"} icon={<Users className="size-6" />}>
          {q ? "Tente outro nome ou parte do número." : "Assim que alguém mandar mensagem para o número conectado, aparece aqui."}
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-line text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Contato</th>
                  <th className="px-3 py-3 font-medium">Telefone</th>
                  <th className="px-3 py-3 font-medium">Consentimento</th>
                  <th className="px-3 py-3 font-medium">Etiquetas</th>
                  <th className="px-3 py-3 text-right font-medium">Última mensagem</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(contacts ?? []).map((c) => {
                  const name = c.name ?? c.push_name ?? "Sem nome";
                  const consent = CONSENT[c.consent_status];
                  return (
                    <tr key={c.id} className="hover:bg-surface-2">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-primary">{initials(name)}</span>
                          <span className="truncate font-medium">{name}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted tabular">{maskPhone(c.phone)}</td>
                      <td className="px-3 py-3"><Badge tone={consent.tone}>{consent.label}</Badge></td>
                      <td className="px-3 py-3">
                        <span className="flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t}>{t}</Badge>)}</span>
                      </td>
                      <td className="px-3 py-3 text-right text-muted">{timeAgo(c.last_inbound_at) || "—"}</td>
                      <td className="px-5 py-2 text-right"><StartConversationButton contactId={c.id} name={name} optedOut={c.consent_status === "opt_out"} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-2.5 text-xs text-muted">{count ?? 0} contato(s){(count ?? 0) > 100 ? " · mostrando os 100 mais recentes" : ""}. Telefones parcialmente ocultos (LGPD).</p>
        </Card>
      )}
    </div>
  );
}
