"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Zap } from "lucide-react";
import { deleteQuickReply, saveQuickReply } from "@/app/actions/quick-replies";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page-header";
import { Field, Input, Textarea } from "@/components/ui/input";

interface Item {
  id: string;
  shortcut: string;
  title: string;
  body: string;
}

const EXAMPLES = [
  { shortcut: "ola", title: "Saudação", body: "Olá, {{primeiro_nome}}! Aqui é do suporte {{sistema}}. Como posso ajudar?" },
  { shortcut: "aguarde", title: "Pedir para aguardar", body: "Um momento, {{primeiro_nome}}, estou verificando para você." },
  { shortcut: "protocolo", title: "Informar protocolo", body: "Seu protocolo de atendimento é {{protocolo}}. Guarde para consultas futuras." },
];

export function QuickRepliesEditor({ items }: { items: Item[] }) {
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [form, setForm] = useState({ shortcut: "", title: "", body: "" });
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function open(item: Item | "new", preset?: Omit<Item, "id">) {
    setEditing(item);
    setForm(item === "new" ? (preset ?? { shortcut: "", title: "", body: "" }) : { shortcut: item.shortcut, title: item.title, body: item.body });
  }

  const form_ = editing && (
    <Card className="p-5">
      <form
        className="grid gap-4 sm:grid-cols-[200px_1fr]"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveQuickReply(editing === "new" ? null : editing.id, form);
            if (r.ok) {
              toast.success("Resposta salva.");
              setEditing(null);
            } else toast.error(r.error);
          });
        }}
      >
        <Field label="Atalho" htmlFor="qr-shortcut" hint="Sem espaços. Ex.: boleto">
          <div className="flex items-center rounded-lg border border-line bg-bg focus-within:border-primary">
            <span className="pl-3 font-mono text-primary">/</span>
            <input id="qr-shortcut" value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value.toLowerCase().replace(/\s/g, "") })} required maxLength={30} className="h-10 w-full bg-transparent px-1 font-mono text-sm focus:outline-none" />
          </div>
        </Field>
        <Field label="Título" htmlFor="qr-title">
          <Input id="qr-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={60} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Mensagem" htmlFor="qr-body">
            <Textarea id="qr-body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required rows={4} maxLength={4096} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
          <Button type="submit" loading={pending}>Salvar</Button>
        </div>
      </form>
    </Card>
  );

  return (
    <div className="flex flex-col gap-4">
      {!editing && (
        <div>
          <Button onClick={() => open("new")}>
            <Plus className="size-4" /> Nova resposta
          </Button>
        </div>
      )}
      {form_}
      {items.length === 0 && !editing ? (
        <EmptyState title="Nenhuma resposta rápida ainda" icon={<Zap className="size-6" />} action={
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((e) => (
              <Button key={e.shortcut} size="sm" variant="secondary" onClick={() => open("new", e)}>
                Usar exemplo /{e.shortcut}
              </Button>
            ))}
          </div>
        }>
          Crie textos que a equipe usa sempre. Comece por um dos exemplos.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((it) => (
            <li key={it.id}>
              <Card className="flex h-full flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold">
                    <span className="font-mono text-primary">/{it.shortcut}</span> · {it.title}
                  </p>
                  <span className="flex shrink-0 gap-1">
                    <button onClick={() => open(it)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-label={`Editar /${it.shortcut}`}>
                      <Pencil className="size-4" />
                    </button>
                    <button onClick={() => setConfirmDel(it.id)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-danger" aria-label={`Excluir /${it.shortcut}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </span>
                </div>
                <p className="text-[13px] whitespace-pre-wrap text-muted">{it.body}</p>
                {confirmDel === it.id && (
                  <div className="mt-auto flex items-center justify-end gap-2 pt-2 text-sm">
                    <span className="text-danger">Excluir esta resposta?</span>
                    <Button size="sm" variant="danger" loading={pending} onClick={() => start(async () => {
                      const r = await deleteQuickReply(it.id);
                      if (!r.ok) toast.error(r.error);
                      setConfirmDel(null);
                    })}>Excluir</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDel(null)}>Cancelar</Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
