"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCirclePlus, UserPlus, X } from "lucide-react";
import { createContact, startConversation } from "@/app/actions/contacts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";

export function NewContactButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", tags: "" });
  const [pending, start] = useTransition();
  if (!open)
    return (
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Novo contato
      </Button>
    );
  return (
    <Card className="w-full p-5">
      <form
        className="grid gap-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await createContact(form);
            if (r.ok) {
              toast.success("Contato salvo.");
              setForm({ name: "", phone: "", tags: "" });
              setOpen(false);
            } else toast.error(r.error);
          });
        }}
      >
        <Field label="Nome" htmlFor="nc-name">
          <Input id="nc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
        </Field>
        <Field label="WhatsApp com DDD" htmlFor="nc-phone">
          <Input id="nc-phone" inputMode="tel" placeholder="(11) 99876-4321" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        </Field>
        <Field label="Etiquetas (separadas por vírgula)" htmlFor="nc-tags">
          <Input id="nc-tags" placeholder="cliente, financeiro" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-3">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="submit" loading={pending}>Salvar contato</Button>
        </div>
      </form>
    </Card>
  );
}

export function StartConversationButton({ contactId, name, optedOut }: { contactId: string; name: string; optedOut: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`Conversar com ${name}`}>
        <MessageCirclePlus className="size-4" /> <span className="hidden sm:inline">Conversar</span>
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby={`sc-${contactId}`}>
          <Card className="w-full max-w-md p-5 text-left">
            <div className="mb-3 flex items-center justify-between">
              <h2 id={`sc-${contactId}`} className="font-bold">Mensagem para {name}</h2>
              <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2" aria-label="Fechar">
                <X className="size-4" />
              </button>
            </div>
            {optedOut && (
              <p className="mb-3 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold">
                Este contato pediu para não receber mensagens automáticas. Envie só se for resposta a um pedido dele (suporte).
              </p>
            )}
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={4096} autoFocus placeholder="Escreva a mensagem" aria-label="Mensagem" />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                loading={pending}
                disabled={!text.trim()}
                onClick={() =>
                  start(async () => {
                    const r = await startConversation(contactId, text);
                    if (r.ok) {
                      toast.success("Mensagem enviada.");
                      router.push(`/atendimento?c=${r.conversationId}`);
                    } else toast.error(r.error);
                  })
                }
              >
                Enviar e abrir conversa
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
