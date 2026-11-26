"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Inbox as InboxIcon, Search } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { cn, initials, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Chat } from "./chat";
import { CONVERSATION_SELECT, STATUS_LABEL, contactName, type InboxConversation, type QuickReply, type TeamMember } from "./types";

type Filter = "queue" | "mine" | "open" | "resolved";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "queue", label: "Fila" },
  { id: "mine", label: "Meus" },
  { id: "open", label: "Todos abertos" },
  { id: "resolved", label: "Resolvidas" },
];

export function Inbox({
  system,
  me,
  team,
  quickReplies,
  initialConversationId,
}: {
  system: { id: string; name: string; protocolPrefix: string };
  me: { id: string; name: string };
  team: TeamMember[];
  quickReplies: QuickReply[];
  initialConversationId: string | null;
}) {
  const supabase = getBrowserClient();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(initialConversationId ? "open" : "queue");
  const [items, setItems] = useState<InboxConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId);
  const [selected, setSelected] = useState<InboxConversation | null>(null);
  const [counts, setCounts] = useState({ queue: 0, mine: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    let query = supabase.from("conversations").select(CONVERSATION_SELECT).eq("system_id", system.id);
    if (filter === "queue") query = query.in("status", ["queued", "bot"]).order("created_at", { ascending: true });
    else if (filter === "mine") query = query.eq("assignee_id", me.id).neq("status", "resolved").order("last_message_at", { ascending: false });
    else if (filter === "open") query = query.neq("status", "resolved").order("last_message_at", { ascending: false });
    else query = query.eq("status", "resolved").order("resolved_at", { ascending: false });
    const { data } = await query.limit(200);
    setItems((data ?? []) as unknown as InboxConversation[]);
    setLoading(false);

    const [qc, mc] = await Promise.all([
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("system_id", system.id).in("status", ["queued", "bot"]),
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("system_id", system.id).eq("assignee_id", me.id).neq("status", "resolved"),
    ]);
    setCounts({ queue: qc.count ?? 0, mine: mc.count ?? 0 });
  }, [supabase, system.id, filter, me.id]);

  // Conversa selecionada sempre atualizada (mesmo fora do filtro atual)
  const loadSelected = useCallback(async () => {
    if (!selectedId) return setSelected(null);
    const { data } = await supabase.from("conversations").select(CONVERSATION_SELECT).eq("id", selectedId).maybeSingle();
    setSelected((data as unknown as InboxConversation) ?? null);
  }, [supabase, selectedId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    void loadSelected();
  }, [loadSelected]);

  // Tempo real: qualquer mudança nas conversas do sistema recarrega a lista
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`inbox-${system.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `system_id=eq.${system.id}` }, (payload) => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            void load();
            void loadSelected();
          }, 250);
          const row = payload.new as { status?: string; id?: string } | undefined;
          if (payload.eventType === "INSERT" && row?.status && ["queued", "bot"].includes(row.status)) notifyNew();
        })
        .subscribe();
    })();
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, system.id, load, loadSelected]);

  // Contador no título da aba
  useEffect(() => {
    const base = "Atendimento · WebAgent";
    document.title = counts.queue > 0 ? `(${counts.queue}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [counts.queue]);

  function select(id: string | null) {
    setSelectedId(id);
    const url = id ? `/atendimento?c=${id}` : "/atendimento";
    router.replace(url, { scroll: false });
  }

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    const digits = term.replace(/\D/g, "");
    return items.filter(
      (c) =>
        contactName(c.contact).toLowerCase().includes(term) ||
        c.protocol.toLowerCase().includes(term) ||
        (digits.length >= 3 && c.contact.phone.includes(digits)),
    );
  }, [items, q]);

  const memberName = (id: string | null) => team.find((t) => t.id === id)?.name ?? null;

  return (
    <div className="-mx-4 -mt-5 -mb-28 flex h-[calc(100dvh-3.5rem-4.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:-mx-6 lg:-mb-10 lg:h-[calc(100dvh-3.5rem-env(safe-area-inset-top))]">
      {/* Lista */}
      <section aria-label="Conversas" className={cn("flex w-full flex-col border-r border-line md:w-[340px] md:shrink-0", selectedId && "hidden md:flex")}>
        <div className="flex flex-col gap-3 border-b border-line p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome, telefone ou protocolo"
              aria-label="Buscar conversas"
              className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div role="tablist" aria-label="Filtro" className="grid grid-cols-4 gap-1 rounded-lg bg-surface-2 p-1">
            {FILTERS.map((f) => {
              const count = f.id === "queue" ? counts.queue : f.id === "mine" ? counts.mine : 0;
              return (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "relative truncate rounded-md px-1 py-1.5 text-[12px] font-semibold",
                    filter === f.id ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
                  )}
                >
                  {f.label}
                  {count > 0 && (
                    <span className={cn("ml-1 rounded-full px-1.5 text-[10px] tabular", f.id === "queue" ? "bg-gold text-black" : "bg-primary/20 text-primary")}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto" aria-busy={loading}>
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex gap-3 border-b border-line px-4 py-3">
                <span className="size-10 animate-pulse rounded-full bg-surface-2" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3 w-1/2 animate-pulse rounded bg-surface-2" />
                  <span className="block h-3 w-3/4 animate-pulse rounded bg-surface-2" />
                </span>
              </li>
            ))}
          {!loading && visible.length === 0 && (
            <li className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-muted">
              <InboxIcon className="size-8" aria-hidden />
              {q ? "Nada encontrado." : filter === "queue" ? "Ninguém na fila." : filter === "mine" ? "Nenhuma conversa com você." : "Nenhuma conversa aqui."}
            </li>
          )}
          {!loading &&
            visible.map((c) => {
              const name = contactName(c.contact);
              const st = STATUS_LABEL[c.status];
              const assignee = memberName(c.assignee_id);
              const waitMin = (Date.now() - new Date(c.created_at).getTime()) / 60000;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => select(c.id)}
                    aria-current={selectedId === c.id ? "true" : undefined}
                    className={cn(
                      "flex w-full gap-3 border-b border-line px-4 py-3 text-left transition-colors hover:bg-surface-2",
                      selectedId === c.id && "bg-surface-2 shadow-[inset_2px_0_0_var(--primary)]",
                    )}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-bold text-primary">{initials(name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-sm", c.unread_count > 0 ? "font-bold" : "font-semibold")}>{name}</span>
                        <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.last_message_at)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className={cn("truncate text-[13px]", c.unread_count > 0 ? "text-fg" : "text-muted")}>{c.last_message_preview ?? "—"}</span>
                        {c.unread_count > 0 && (
                          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-on-primary tabular">{c.unread_count}</span>
                        )}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone={c.status === "queued" && waitMin > 10 ? "danger" : st.tone}>{st.label}</Badge>
                        <span className="font-mono text-[10.5px] text-muted">{c.protocol}</span>
                        {assignee && <span className="truncate text-[11px] text-muted">· {assignee.split(" ")[0]}</span>}
                        {c.opened_outside_hours && c.status !== "resolved" && <span className="text-[11px] text-gold">· fora do horário</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
        </ul>
        <NotificationToggle />
      </section>

      {/* Conversa */}
      <section aria-label="Conversa" className={cn("min-w-0 flex-1", !selectedId && "hidden md:flex")}>
        {selected ? (
          <Chat key={selected.id} conversation={selected} system={system} me={me} team={team} quickReplies={quickReplies} onBack={() => select(null)} onChanged={() => { void load(); void loadSelected(); }} />
        ) : (
          <div className="hidden h-full w-full flex-col items-center justify-center gap-3 text-center md:flex">
            <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-primary">
              <InboxIcon className="size-6" aria-hidden />
            </span>
            <p className="font-display text-lg font-bold">Selecione uma conversa</p>
            <p className="max-w-xs text-sm text-muted">As mensagens chegam aqui em tempo real. Assuma uma conversa da fila para responder.</p>
          </div>
        )}
      </section>
    </div>
  );
}

let audioCtx: AudioContext | null = null;
/** Aviso discreto de nova conversa na fila: bipe curto e notificação se a aba estiver em segundo plano. */
function notifyNew() {
  try {
    audioCtx ??= new AudioContext();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.06, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.25);
  } catch {
    /* navegador bloqueou áudio antes de interação */
  }
  if (document.hidden && "Notification" in window && Notification.permission === "granted") {
    new Notification("Nova conversa na fila", { body: "Um cliente está aguardando atendimento.", icon: "/icon-192.png" });
  }
}

function NotificationToggle() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("granted");
  useEffect(() => {
    setPerm("Notification" in window ? Notification.permission : "unsupported");
  }, []);
  if (perm !== "default") return null;
  return (
    <button
      onClick={async () => setPerm(await Notification.requestPermission())}
      className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-left text-xs text-muted hover:bg-surface-2 hover:text-fg"
    >
      <Bell className="size-3.5" aria-hidden /> Ativar avisos de nova conversa neste navegador
    </button>
  );
}
