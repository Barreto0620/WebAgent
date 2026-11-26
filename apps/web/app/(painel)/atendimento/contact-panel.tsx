"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, Plus, ShieldCheck, ShieldOff, X } from "lucide-react";
import { maskPhone } from "@webagent/shared";
import { getBrowserClient } from "@/lib/supabase/client";
import { revealPhone, setConsent, updateContact } from "@/app/actions/inbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Textarea } from "@/components/ui/input";
import { initials, timeAgo } from "@/lib/utils";
import { STATUS_LABEL, contactName, type InboxContact } from "./types";

const CONSENT = {
  opt_in: { tone: "success" as const, label: "Aceita mensagens" },
  opt_out: { tone: "danger" as const, label: "Descadastrado" },
  unknown: { tone: "neutral" as const, label: "Sem registro" },
};

export function ContactPanel({
  contact,
  systemId,
  currentConversationId,
  onClose,
  onSaved,
}: {
  contact: InboxContact;
  systemId: string;
  currentConversationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = getBrowserClient();
  const [form, setForm] = useState({ name: contact.name ?? "", email: contact.email ?? "", notes: contact.notes ?? "", tags: contact.tags });
  const [tag, setTag] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [consentMode, setConsentMode] = useState<null | "opt_in" | "opt_out">(null);
  const [evidence, setEvidence] = useState("");
  const [history, setHistory] = useState<{ id: string; protocol: string; status: keyof typeof STATUS_LABEL; created_at: string }[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    setForm({ name: contact.name ?? "", email: contact.email ?? "", notes: contact.notes ?? "", tags: contact.tags });
    setPhone(null);
  }, [contact]);

  useEffect(() => {
    supabase
      .from("conversations")
      .select("id, protocol, status, created_at")
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setHistory((data ?? []) as typeof history));
  }, [supabase, contact.id]);

  const dirty =
    form.name !== (contact.name ?? "") ||
    form.email !== (contact.email ?? "") ||
    form.notes !== (contact.notes ?? "") ||
    form.tags.join(",") !== contact.tags.join(",");

  function addTag() {
    const t = tag.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 30);
    if (t && !form.tags.includes(t)) setForm({ ...form, tags: [...form.tags, t] });
    setTag("");
  }

  const consent = CONSENT[contact.consent_status];
  const name = contactName(contact);

  return (
    <div className="flex h-full flex-col pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-bold">Ficha do contato</h2>
        <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2" aria-label="Fechar ficha">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-surface-3 text-lg font-bold text-primary">{initials(name)}</span>
          <p className="font-display text-base font-bold">{name}</p>
          <p className="flex items-center gap-2 text-sm text-muted tabular">
            {phone ? `+${phone}` : maskPhone(contact.phone)}
            {!phone && (
              <button
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                onClick={() =>
                  start(async () => {
                    const r = await revealPhone(contact.id);
                    if (r.ok) setPhone(r.phone);
                    else toast.error(r.error);
                  })
                }
                title="Mostra o número completo. O acesso fica registrado na auditoria (LGPD)."
              >
                <Eye className="size-3.5" /> mostrar
              </button>
            )}
          </p>
          <Badge tone={consent.tone}>{consent.label}</Badge>
        </div>

        <div className="space-y-3">
          <Field label="Nome" htmlFor="cp-name" hint={contact.push_name ? `No WhatsApp: ${contact.push_name}` : undefined}>
            <Input id="cp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
          </Field>
          <Field label="E-mail" htmlFor="cp-email">
            <Input id="cp-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-muted">Etiquetas</span>
            <div className="flex flex-wrap gap-1.5">
              {form.tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-xs">
                  {t}
                  <button onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== t) })} aria-label={`Remover ${t}`} className="text-muted hover:text-danger">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                addTag();
              }}
            >
              <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="ex.: financeiro" aria-label="Nova etiqueta" className="h-8" />
              <Button size="sm" variant="secondary" type="submit" aria-label="Adicionar etiqueta">
                <Plus className="size-4" />
              </Button>
            </form>
          </div>
          <Field label="Observações" htmlFor="cp-notes">
            <Textarea id="cp-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} maxLength={2000} />
          </Field>
          <Button
            className="w-full justify-center"
            disabled={!dirty}
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await updateContact(contact.id, { name: form.name || null, email: form.email || null, notes: form.notes || null, tags: form.tags });
                if (r.ok) {
                  toast.success("Contato salvo.");
                  onSaved();
                } else toast.error(r.error);
              })
            }
          >
            Salvar contato
          </Button>
        </div>

        <div className="space-y-2 rounded-xl border border-line p-3">
          <p className="text-[13px] font-semibold">Consentimento (LGPD)</p>
          <p className="text-xs text-muted">Define se o contato pode receber campanhas. O cliente também pode mudar enviando SAIR ou VOLTAR.</p>
          {consentMode ? (
            <div className="space-y-2">
              <Textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={2} placeholder="Como foi obtido? Ex.: cliente pediu para receber ofertas em 26/11" aria-label="Evidência do consentimento" />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  loading={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await setConsent(contact.id, systemId, consentMode, evidence);
                      if (r.ok) {
                        toast.success("Consentimento registrado.");
                        setConsentMode(null);
                        setEvidence("");
                        onSaved();
                      } else toast.error(r.error);
                    })
                  }
                >
                  Registrar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConsentMode(null)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {contact.consent_status !== "opt_in" && (
                <Button size="sm" variant="secondary" onClick={() => setConsentMode("opt_in")}>
                  <ShieldCheck className="size-4" /> Aceita
                </Button>
              )}
              {contact.consent_status !== "opt_out" && (
                <Button size="sm" variant="secondary" onClick={() => setConsentMode("opt_out")}>
                  <ShieldOff className="size-4" /> Descadastrar
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[13px] font-semibold">Atendimentos</p>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {history.map((h) => (
              <li key={h.id}>
                <Link href={`/atendimento?c=${h.id}`} className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-surface-2">
                  <span className="font-mono">{h.protocol}</span>
                  <span className="flex items-center gap-2 text-muted">
                    {h.id === currentConversationId ? <Badge tone="success">atual</Badge> : <Badge tone={STATUS_LABEL[h.status].tone}>{STATUS_LABEL[h.status].label}</Badge>}
                    {timeAgo(h.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
