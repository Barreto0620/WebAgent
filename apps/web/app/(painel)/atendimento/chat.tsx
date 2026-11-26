"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  FileText,
  Hand,
  Lock,
  PanelRightOpen,
  PauseCircle,
  RotateCcw,
  Send,
  StickyNote,
  UserRoundCheck,
} from "lucide-react";
import { firstName, maskPhone, renderTemplate } from "@webagent/shared";
import { getBrowserClient } from "@/lib/supabase/client";
import { cn, initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  addInternalNote,
  assignConversation,
  markRead,
  reopenConversation,
  resolveConversation,
  retryMessage,
  sendMessage,
  setConversationStatus,
} from "@/app/actions/inbox";
import { ContactPanel } from "./contact-panel";
import { MESSAGE_SELECT, STATUS_LABEL, contactName, type InboxConversation, type InboxMessage, type QuickReply, type TeamMember } from "./types";

const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

export function Chat({
  conversation,
  system,
  me,
  team,
  quickReplies,
  onBack,
  onChanged,
}: {
  conversation: InboxConversation;
  system: { id: string; name: string };
  me: { id: string; name: string };
  team: TeamMember[];
  quickReplies: QuickReply[];
  onBack: () => void;
  onChanged: () => void;
}) {
  const supabase = getBrowserClient();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState(false);
  const [pending, start] = useTransition();
  const [transferOpen, setTransferOpen] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const c = conversation;
  const name = contactName(c.contact);
  const resolved = c.status === "resolved";
  const mine = c.assignee_id === me.id;

  // Mensagens + tempo real da conversa
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("messages").select(MESSAGE_SELECT).eq("conversation_id", c.id).order("created_at", { ascending: true }).limit(500);
      if (!active) return;
      setMessages((data ?? []) as InboxMessage[]);
      setLoading(false);
    })();
    const channel = supabase
      .channel(`conv-${c.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${c.id}` }, (payload) => {
        const row = payload.new as InboxMessage;
        if (!row?.id) return;
        setMessages((prev) => {
          const i = prev.findIndex((m) => m.id === row.id);
          if (i === -1) return [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
          const next = [...prev];
          next[i] = { ...next[i]!, ...row };
          return next;
        });
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, c.id]);

  // Roteiro da planilha de leads (respostas prontas da linha deste contato)
  const [scripts, setScripts] = useState<{ label: string; text: string }[]>([]);
  useEffect(() => {
    let alive = true;
    supabase
      .from("campaign_recipients")
      .select("row_data, campaigns!inner(mapping, kind)")
      .eq("contact_id", c.contact.id)
      .gte("step", 1)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        const camp = data.campaigns as unknown as { mapping: { script?: string[] }; kind: string };
        const row = data.row_data as Record<string, string>;
        setScripts((camp.mapping?.script ?? []).map((label) => ({ label, text: (row[label] ?? "").trim() })).filter((x) => x.text));
      });
    return () => {
      alive = false;
    };
  }, [supabase, c.contact.id]);

  // Zera não lidas ao abrir
  useEffect(() => {
    if (c.unread_count > 0) void markRead(c.id);
  }, [c.id, c.unread_count]);

  useLayoutEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length, loading]);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else {
        if (success) toast.success(success);
        onChanged();
      }
    });
  }

  const grouped = useMemo(() => {
    const out: { day: string; items: InboxMessage[] }[] = [];
    for (const m of messages) {
      const day = dayFmt.format(new Date(m.created_at));
      const last = out.at(-1);
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [messages]);

  const st = STATUS_LABEL[c.status];
  const memberName = (id: string | null) => team.find((t) => t.id === id)?.name ?? null;

  return (
    <div className="flex h-full min-w-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabeçalho */}
        <header className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2.5 sm:px-4">
          <button onClick={onBack} className="grid size-9 place-items-center rounded-lg hover:bg-surface-2 md:hidden" aria-label="Voltar para a lista">
            <ArrowLeft className="size-5" />
          </button>
          <button onClick={() => setPanel((p) => !p)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Ver dados do contato">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-bold text-primary">{initials(name)}</span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold">{name}</span>
              <span className="flex items-center gap-2 text-xs text-muted">
                <span className="tabular">{maskPhone(c.contact.phone)}</span>
                <span className="font-mono">{c.protocol}</span>
              </span>
            </span>
          </button>
          <Badge tone={st.tone} className="hidden sm:inline-flex">
            {st.label}
            {c.assignee_id && !resolved ? ` · ${(memberName(c.assignee_id) ?? "").split(" ")[0]}` : ""}
          </Badge>
          <button onClick={() => setPanel((p) => !p)} className="hidden size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 xl:grid" aria-label="Mostrar ou ocultar ficha do contato">
            <PanelRightOpen className="size-5" />
          </button>
        </header>

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface/60 px-3 py-2 sm:px-4">
          {resolved ? (
            <Button size="sm" variant="secondary" loading={pending} onClick={() => act(() => reopenConversation(c.id), "Conversa reaberta.")}>
              <RotateCcw className="size-4" /> Reabrir
            </Button>
          ) : (
            <>
              {!mine && (
                <Button size="sm" loading={pending} onClick={() => act(() => assignConversation(c.id, null), "Conversa assumida.")}>
                  <Hand className="size-4" /> Assumir
                </Button>
              )}
              <div className="relative">
                <Button size="sm" variant="secondary" onClick={() => setTransferOpen((o) => !o)} aria-expanded={transferOpen}>
                  <UserRoundCheck className="size-4" /> Transferir <ChevronDown className="size-3.5" />
                </Button>
                {transferOpen && (
                  <ul className="absolute top-full left-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl">
                    {team.filter((t) => t.id !== c.assignee_id).map((t) => (
                      <li key={t.id}>
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-2"
                          onClick={() => {
                            setTransferOpen(false);
                            act(() => assignConversation(c.id, t.id), `Transferida para ${t.name.split(" ")[0]}.`);
                          }}
                        >
                          <span className="grid size-6 place-items-center rounded-full bg-surface-3 text-[10px] font-bold text-primary">{initials(t.name)}</span>
                          <span className="truncate">{t.name}{t.id === me.id ? " (você)" : ""}</span>
                        </button>
                      </li>
                    ))}
                    {team.length <= 1 && <li className="px-2.5 py-2 text-xs text-muted">Só você neste sistema. Adicione pessoas em Equipe.</li>}
                  </ul>
                )}
              </div>
              {c.status !== "pending" ? (
                <Button size="sm" variant="ghost" loading={pending} onClick={() => act(() => setConversationStatus(c.id, "pending"), "Marcada como pendente.")} title="Aguardando retorno do cliente">
                  <PauseCircle className="size-4" /> Pendente
                </Button>
              ) : (
                <Button size="sm" variant="ghost" loading={pending} onClick={() => act(() => setConversationStatus(c.id, "open"))}>
                  Retomar
                </Button>
              )}
              <div className="ml-auto">
                {confirmResolve ? (
                  <span className="flex items-center gap-2">
                    <span className="hidden text-xs text-muted sm:inline">Envia a mensagem de encerramento.</span>
                    <Button size="sm" loading={pending} onClick={() => { setConfirmResolve(false); act(() => resolveConversation(c.id), "Atendimento encerrado."); }}>
                      Confirmar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmResolve(false)}>Cancelar</Button>
                  </span>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setConfirmResolve(true)}>
                    <Check className="size-4" /> Resolver
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Mensagens */}
        <div className="grid-bg flex-1 overflow-y-auto bg-bg px-3 py-4 sm:px-6" aria-live="polite">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted">Carregando mensagens…</p>
          ) : (
            grouped.map((g) => (
              <div key={g.day} className="flex flex-col gap-1.5">
                <p className="my-3 self-center rounded-full bg-surface px-3 py-1 text-[11px] text-muted capitalize shadow-sm">{g.day}</p>
                {g.items.map((m) => (
                  <Bubble key={m.id} m={m} author={m.sender_id ? memberName(m.sender_id) : null} onRetry={() => act(() => retryMessage(m.id), "Reenviando…")} />
                ))}
              </div>
            ))
          )}
          <div ref={bottom} />
        </div>

        <Composer
          disabled={resolved}
          conversation={c}
          systemId={system.id}
          systemName={system.name}
          quickReplies={quickReplies}
          scripts={scripts}
          onSent={onChanged}
        />
      </div>

      {panel && (
        <aside className="fixed inset-0 z-40 bg-bg xl:static xl:z-auto xl:w-[320px] xl:shrink-0 xl:border-l xl:border-line">
          <ContactPanel contact={c.contact} systemId={system.id} currentConversationId={c.id} onClose={() => setPanel(false)} onSaved={onChanged} />
        </aside>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: InboxMessage["status"] }) {
  if (status === "queued") return <Clock3 className="size-3.5" aria-label="Na fila de envio" />;
  if (status === "sent") return <Check className="size-3.5" aria-label="Enviada" />;
  if (status === "delivered") return <CheckCheck className="size-3.5" aria-label="Entregue" />;
  if (status === "read") return <CheckCheck className="size-3.5 text-sky-500" aria-label="Lida" />;
  if (status === "failed") return <AlertCircle className="size-3.5 text-danger" aria-label="Falhou" />;
  return null;
}

function Bubble({ m, author, onRetry }: { m: InboxMessage; author: string | null; onRetry: () => void }) {
  if (m.is_internal) {
    return (
      <div className="my-1 flex max-w-[92%] gap-2 self-center rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-[13px]">
        <StickyNote className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-gold">Nota interna · {author ?? "Equipe"} · {timeFmt.format(new Date(m.created_at))}</p>
          <p className="break-words whitespace-pre-wrap">{m.body}</p>
        </div>
      </div>
    );
  }
  const inbound = m.direction === "in";
  const auto = m.sender_type === "bot" || m.sender_type === "system";
  return (
    <div className={cn("flex max-w-[85%] flex-col sm:max-w-[70%]", inbound ? "self-start" : "self-end")}>
      <div
        className={cn(
          "rounded-2xl px-3 py-2 text-[14px] shadow-sm",
          inbound ? "rounded-tl-sm border border-line bg-[var(--bubble-in)]" : "rounded-tr-sm bg-[var(--bubble-out)]",
          auto && "border border-dashed border-primary/40",
          m.status === "failed" && "border border-danger/60",
        )}
      >
        {m.media_path && <Media path={m.media_path} mime={m.media_mime} type={m.type} />}
        {m.body ? <p className="break-words whitespace-pre-wrap">{m.body}</p> : !m.media_path && <p className="text-muted italic">{labelFor(m.type)}</p>}
        <p className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-muted">
          {auto && <span>automática ·</span>}
          {!inbound && !auto && author && <span>{author.split(" ")[0]} ·</span>}
          {timeFmt.format(new Date(m.created_at))}
          {!inbound && <StatusIcon status={m.status} />}
        </p>
      </div>
      {m.status === "failed" && (
        <p className="mt-1 flex items-center justify-end gap-2 text-[11px] text-danger">
          {m.error ?? "Não enviada"}
          <button onClick={onRetry} className="font-semibold underline underline-offset-2">Reenviar</button>
        </p>
      )}
    </div>
  );
}

function labelFor(type: InboxMessage["type"]) {
  return { image: "Imagem", video: "Vídeo", audio: "Áudio", document: "Documento", sticker: "Figurinha", location: "Localização", contact: "Contato", other: "Mensagem não suportada", text: "" }[type];
}

function Media({ path, mime, type }: { path: string; mime: string | null; type: InboxMessage["type"] }) {
  const supabase = getBrowserClient();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.storage.from("media").createSignedUrl(path, 3600).then(({ data }) => alive && setUrl(data?.signedUrl ?? null));
    return () => {
      alive = false;
    };
  }, [supabase, path]);
  if (!url) return <div className="mb-1 h-24 w-48 animate-pulse rounded-lg bg-surface-3" />;
  if (type === "image" || type === "sticker")
    return (
      <a href={url} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Imagem recebida" className="mb-1 max-h-72 rounded-lg object-contain" />
      </a>
    );
  if (type === "audio") return <audio controls src={url} className="mb-1 w-64 max-w-full" />;
  if (type === "video") return <video controls src={url} className="mb-1 max-h-72 rounded-lg" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 rounded-lg bg-surface-3 px-3 py-2 text-sm">
      <FileText className="size-4 text-primary" /> Abrir documento {mime ? `(${mime.split("/")[1]})` : ""}
    </a>
  );
}

function Composer({
  disabled,
  conversation,
  systemId,
  systemName,
  quickReplies,
  scripts,
  onSent,
}: {
  disabled: boolean;
  conversation: InboxConversation;
  systemId: string;
  systemName: string;
  quickReplies: QuickReply[];
  scripts: { label: string; text: string }[];
  onSent: () => void;
}) {
  const [text, setText] = useState("");
  const [note, setNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [qrIndex, setQrIndex] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const draftKey = `wa-draft-${conversation.id}`;

  // Rascunho por conversa (só neste navegador)
  useEffect(() => {
    try {
      setText(sessionStorage.getItem(draftKey) ?? "");
    } catch {
      /* armazenamento indisponível */
    }
  }, [draftKey]);
  useEffect(() => {
    try {
      if (text) sessionStorage.setItem(draftKey, text);
      else sessionStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, [text, draftKey]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  const slash = !note && text.startsWith("/") && !text.includes("\n") ? text.slice(1).toLowerCase() : null;
  const matches = slash !== null ? quickReplies.filter((q) => q.shortcut.includes(slash) || q.title.toLowerCase().includes(slash)).slice(0, 6) : [];

  function applyQuickReply(q: QuickReply) {
    const vars = {
      nome: contactName(conversation.contact),
      primeiro_nome: firstName(conversation.contact.name ?? conversation.contact.push_name) || "",
      protocolo: conversation.protocol,
      sistema: systemName,
      horario: "",
    };
    setText(renderTemplate(q.body, vars));
    setQrIndex(0);
    requestAnimationFrame(() => ref.current?.focus());
  }

  async function submit() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const r = note ? await addInternalNote(conversation.id, systemId, body) : await sendMessage(conversation.id, body);
    setSending(false);
    if (!r.ok) return toast.error(r.error);
    setText("");
    onSent();
  }

  if (disabled) {
    return (
      <div className="flex items-center justify-center gap-2 border-t border-line bg-surface px-4 py-4 text-sm text-muted">
        <Lock className="size-4" /> Conversa encerrada. Reabra para responder; se o cliente escrever de novo, uma nova conversa é criada.
      </div>
    );
  }

  return (
    <div className="relative border-t border-line bg-surface px-3 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] sm:px-4">
      {matches.length > 0 && (
        <ul role="listbox" aria-label="Respostas rápidas" className="absolute bottom-full left-3 z-20 mb-2 w-[min(420px,calc(100%-24px))] overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          {matches.map((q, i) => (
            <li key={q.id}>
              <button
                role="option"
                aria-selected={i === qrIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyQuickReply(q);
                }}
                className={cn("flex w-full flex-col px-3 py-2 text-left hover:bg-surface-2", i === qrIndex && "bg-surface-2")}
              >
                <span className="text-sm font-semibold">
                  <span className="font-mono text-primary">/{q.shortcut}</span> · {q.title}
                </span>
                <span className="truncate text-xs text-muted">{q.body}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {scripts.length > 0 && !note && (
        <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[12px]" aria-label="Roteiro do lead">
          <span className="shrink-0 font-semibold text-muted">Roteiro:</span>
          {scripts.map((sc) => (
            <button
              key={sc.label}
              type="button"
              title={sc.text}
              onClick={() => {
                setText(sc.text);
                requestAnimationFrame(() => ref.current?.focus());
              }}
              className="shrink-0 rounded-full border border-primary/40 bg-primary/8 px-2.5 py-1 font-medium text-primary hover:bg-primary/15"
            >
              {sc.label}
            </button>
          ))}
        </div>
      )}
      <div className="mb-2 flex gap-1 text-[12px]">
        <button onClick={() => setNote(false)} className={cn("rounded-md px-2.5 py-1 font-semibold", !note ? "bg-primary/15 text-primary" : "text-muted hover:text-fg")}>
          Responder
        </button>
        <button onClick={() => setNote(true)} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold", note ? "bg-gold/15 text-gold" : "text-muted hover:text-fg")}>
          <StickyNote className="size-3.5" /> Nota interna
        </button>
        {quickReplies.length > 0 && !note && <span className="ml-auto self-center text-muted">Digite <kbd className="rounded border border-line px-1 font-mono">/</kbd> para respostas rápidas</span>}
      </div>
      <div className={cn("flex items-end gap-2 rounded-xl border bg-bg p-1.5", note ? "border-gold/50" : "border-line focus-within:border-primary")}>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setQrIndex(0);
          }}
          onKeyDown={(e) => {
            if (matches.length > 0) {
              if (e.key === "ArrowDown") return e.preventDefault(), setQrIndex((i) => (i + 1) % matches.length);
              if (e.key === "ArrowUp") return e.preventDefault(), setQrIndex((i) => (i - 1 + matches.length) % matches.length);
              if (e.key === "Enter" || e.key === "Tab") return e.preventDefault(), applyQuickReply(matches[qrIndex]!);
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={1}
          maxLength={4096}
          placeholder={note ? "Nota visível só para a equipe" : "Mensagem para o cliente (Enter envia, Shift+Enter quebra linha)"}
          aria-label={note ? "Nota interna" : "Mensagem"}
          className="max-h-[180px] min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] leading-relaxed placeholder:text-muted/70 focus:outline-none"
        />
        <Button size="icon" onClick={() => void submit()} loading={sending} disabled={!text.trim()} aria-label={note ? "Salvar nota" : "Enviar mensagem"} className={cn("shrink-0", note && "bg-gold text-black hover:bg-gold/90")}>
          {!sending && (note ? <StickyNote className="size-4" /> : <Send className="size-4" />)}
        </Button>
      </div>
    </div>
  );
}
