import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { getSession } from "@/lib/session";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UseSystemButton } from "./use-system-button";
import { NewSystemForm } from "./new-system-form";

export const metadata: Metadata = { title: "Sistemas" };

export default async function SistemasPage() {
  const { supabase, systems, active, isPlatformAdmin, roleIn } = await getSession();

  const ids = systems.map((s) => s.id);
  const [{ data: convs }, { data: channels }] = await Promise.all([
    ids.length
      ? supabase.from("conversations").select("system_id, status").in("system_id", ids).neq("status", "resolved")
      : Promise.resolve({ data: [] as { system_id: string; status: string }[] }),
    ids.length ? supabase.from("channels").select("system_id, status").in("system_id", ids) : Promise.resolve({ data: [] as { system_id: string; status: string }[] }),
  ]);

  const roleLabel: Record<string, string> = { admin: "Administrador", supervisor: "Supervisor", agent: "Atendente" };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Gestão"
        title="Sistemas"
        description="Cada sistema da WebCash tem seu próprio número, horários, mensagens automáticas e equipe. Ao trocar de sistema, todas as abas passam a mostrar os dados dele."
      />

      {systems.length === 0 ? (
        <EmptyState title="Nenhum sistema liberado" icon={<Boxes className="size-6" />}>
          Peça a um administrador para incluir você em um sistema.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {systems.map((s) => {
            const open = (convs ?? []).filter((c) => c.system_id === s.id);
            const queued = open.filter((c) => c.status === "queued").length;
            const ch = (channels ?? []).filter((c) => c.system_id === s.id);
            const connected = ch.some((c) => c.status === "connected");
            const isActive = active?.id === s.id;
            const role = roleIn(s.id);
            return (
              <li key={s.id}>
                <Card className={isActive ? "glow-neon flex h-full flex-col" : "flex h-full flex-col"}>
                  <div className="flex items-start gap-3 p-5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl font-display text-sm font-extrabold text-black" style={{ background: s.color }}>
                      {s.protocol_prefix}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-bold">{s.name}</h2>
                        {isActive && <Badge tone="success">Ativo</Badge>}
                        {!s.is_active && <Badge>Pausado</Badge>}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{s.description ?? "Sem descrição"}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 border-y border-line text-center">
                    <div className="px-2 py-3">
                      <dt className="text-[11px] text-muted">Em aberto</dt>
                      <dd className="font-display text-lg font-bold tabular">{open.length}</dd>
                    </div>
                    <div className="border-x border-line px-2 py-3">
                      <dt className="text-[11px] text-muted">Na fila</dt>
                      <dd className={`font-display text-lg font-bold tabular ${queued ? "text-gold" : ""}`}>{queued}</dd>
                    </div>
                    <div className="px-2 py-3">
                      <dt className="text-[11px] text-muted">WhatsApp</dt>
                      <dd className="mt-1.5 flex items-center justify-center gap-1.5 text-xs">
                        <StatusDot tone={ch.length === 0 ? "neutral" : connected ? "success" : "danger"} />
                        {ch.length === 0 ? "sem número" : connected ? "online" : "offline"}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-auto flex items-center justify-between gap-2 px-5 py-3">
                    <span className="text-xs text-muted">{role ? roleLabel[role] : ""} · protocolo {s.protocol_prefix}-AAMMDD-0001</span>
                    {!isActive && <UseSystemButton id={s.id} />}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {isPlatformAdmin && <NewSystemForm />}
    </div>
  );
}
