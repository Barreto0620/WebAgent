"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Plus, Search, UserX } from "lucide-react";
import { anonymizeContact, createDataRequest, findContactByPhone, saveRetention, updateDataRequest } from "@/app/actions/privacy";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Textarea } from "@/components/ui/input";

const TYPES = {
  access: "Acesso aos dados",
  correction: "Correção",
  deletion: "Eliminação",
  portability: "Portabilidade",
  revocation: "Revogar consentimento",
} as const;

const STATUS = {
  open: { label: "Aberto", tone: "warning" as const },
  in_progress: { label: "Em andamento", tone: "info" as const },
  done: { label: "Concluído", tone: "success" as const },
  rejected: { label: "Negado", tone: "neutral" as const },
};

const dfmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

interface Req {
  id: string;
  requester_name: string;
  requester_contact: string;
  type: keyof typeof TYPES;
  status: keyof typeof STATUS;
  notes: string | null;
  due_at: string;
  created_at: string;
  contact_id: string | null;
}

export function DataRequests({ requests }: { requests: Req[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ requester_name: "", requester_contact: "", type: "access" as keyof typeof TYPES, notes: "", phone: "" });
  const [pending, start] = useTransition();
  const late = requests.filter((r) => (r.status === "open" || r.status === "in_progress") && new Date(r.due_at) < new Date()).length;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Pedidos dos titulares"
        description="Prazo legal de resposta: 15 dias (art. 19, II)."
        action={
          <div className="flex items-center gap-2">
            {late > 0 && <Badge tone="danger">{late} atrasado(s)</Badge>}
            {!open && (
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="size-4" /> Registrar pedido
              </Button>
            )}
          </div>
        }
      />
      {open && (
        <form
          className="grid gap-4 border-b border-line p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createDataRequest(form);
              if (r.ok) {
                toast.success("Pedido registrado. Prazo de 15 dias.");
                setOpen(false);
                setForm({ requester_name: "", requester_contact: "", type: "access", notes: "", phone: "" });
              } else toast.error(r.error);
            });
          }}
        >
          <Field label="Nome do titular" htmlFor="dr-name">
            <Input id="dr-name" value={form.requester_name} onChange={(e) => setForm({ ...form, requester_name: e.target.value })} required />
          </Field>
          <Field label="Contato para resposta" htmlFor="dr-contact" hint="E-mail ou telefone">
            <Input id="dr-contact" value={form.requester_contact} onChange={(e) => setForm({ ...form, requester_contact: e.target.value })} required />
          </Field>
          <Field label="Tipo de pedido" htmlFor="dr-type">
            <select id="dr-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as keyof typeof TYPES })} className="h-10 rounded-lg border border-line bg-bg px-3 text-sm focus:border-primary focus:outline-none">
              {Object.entries(TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="WhatsApp do titular (opcional)" htmlFor="dr-phone" hint="Liga o pedido ao contato cadastrado.">
            <Input id="dr-phone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Detalhes" htmlFor="dr-notes">
              <Textarea id="dr-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={pending}>Registrar</Button>
          </div>
        </form>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Titular</th>
              <th className="px-3 py-3 font-medium">Pedido</th>
              <th className="px-3 py-3 font-medium">Prazo</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {requests.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-muted">Nenhum pedido registrado.</td>
              </tr>
            )}
            {requests.map((r) => {
              const overdue = (r.status === "open" || r.status === "in_progress") && new Date(r.due_at) < new Date();
              return (
                <tr key={r.id}>
                  <td className="px-5 py-3">
                    <span className="block font-medium">{r.requester_name}</span>
                    <span className="block text-xs text-muted">{r.requester_contact}</span>
                  </td>
                  <td className="px-3 py-3">
                    {TYPES[r.type]}
                    {r.notes && <span className="block max-w-xs truncate text-xs text-muted">{r.notes}</span>}
                  </td>
                  <td className={overdue ? "px-3 py-3 font-semibold text-danger tabular" : "px-3 py-3 text-muted tabular"}>{dfmt.format(new Date(r.due_at))}{overdue ? " · atrasado" : ""}</td>
                  <td className="px-5 py-3">
                    <select
                      aria-label={`Status do pedido de ${r.requester_name}`}
                      value={r.status}
                      disabled={pending}
                      onChange={(e) => start(async () => {
                        const res = await updateDataRequest(r.id, e.target.value as keyof typeof STATUS);
                        if (!res.ok) toast.error(res.error);
                      })}
                      className="h-9 rounded-lg border border-line bg-bg px-2 text-sm focus:border-primary focus:outline-none"
                    >
                      {Object.entries(STATUS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function TitularTools({ isAdmin }: { isAdmin: boolean }) {
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<{ id: string; name: string | null; push_name: string | null; consent_status: string } | null | undefined>(undefined);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader title="Atender um titular" description="Busque pelo WhatsApp para exportar ou anonimizar os dados." />
      <div className="flex flex-col gap-4 p-5">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await findContactByPhone(phone);
              if (r.ok) setFound(r.contact);
              else toast.error(r.error);
            });
          }}
        >
          <Input inputMode="tel" placeholder="(11) 99876-4321" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="WhatsApp do titular" />
          <Button type="submit" variant="secondary" loading={pending}>
            <Search className="size-4" /> Buscar
          </Button>
        </form>
        {found === null && <p className="text-sm text-muted">Nenhum contato com este número neste sistema.</p>}
        {found && (
          <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
            <p className="font-semibold">{found.name ?? found.push_name ?? "Sem nome"}</p>
            <a href={`/privacidade-dados/exportar/${found.id}`} className="inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-line px-3 text-[13px] font-semibold hover:bg-surface-2">
              <Download className="size-4" /> Exportar dados (JSON)
            </a>
            {isAdmin ? (
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <p className="text-xs text-muted">
                  Anonimizar apaga nome, e-mail, observações, arquivos e o texto das mensagens, e troca o telefone por um código. Os números de protocolo e as estatísticas continuam. <b className="text-danger">Não pode ser desfeito.</b>
                </p>
                <div className="flex gap-2">
                  <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Digite ANONIMIZAR" aria-label="Confirmação" />
                  <Button
                    variant="danger"
                    loading={pending}
                    disabled={confirm.trim().toUpperCase() !== "ANONIMIZAR"}
                    onClick={() => start(async () => {
                      const r = await anonymizeContact(found.id, confirm);
                      if (r.ok) {
                        toast.success("Titular anonimizado.");
                        setFound(undefined);
                        setConfirm("");
                        setPhone("");
                      } else toast.error(r.error);
                    })}
                  >
                    <UserX className="size-4" /> Anonimizar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted">Só administradores podem anonimizar.</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export function RetentionForm({ days, isAdmin }: { days: number; isAdmin: boolean }) {
  const [value, setValue] = useState(String(days));
  const [pending, start] = useTransition();
  const presets = [{ d: 180, l: "6 meses" }, { d: 365, l: "1 ano" }, { d: 730, l: "2 anos" }, { d: 1825, l: "5 anos" }];
  return (
    <Card>
      <CardHeader title="Prazo de guarda" description="Conversas encerradas há mais tempo que isso são apagadas todo dia às 03:30, com mensagens e arquivos." />
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p.d} disabled={!isAdmin} onClick={() => setValue(String(p.d))} className={`rounded-lg border px-3 py-1.5 text-[13px] ${Number(value) === p.d ? "border-primary bg-primary/10 text-primary" : "border-line text-muted hover:text-fg"} disabled:opacity-60`}>
              {p.l}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Field label="Dias" htmlFor="ret-days">
            <Input id="ret-days" type="number" min={30} max={3650} value={value} onChange={(e) => setValue(e.target.value)} disabled={!isAdmin} className="w-32" />
          </Field>
          <Button
            disabled={!isAdmin || Number(value) === days}
            loading={pending}
            onClick={() => start(async () => {
              const r = await saveRetention(Number(value));
              if (r.ok) toast.success("Prazo de guarda salvo.");
              else toast.error(r.error);
            })}
          >
            Salvar
          </Button>
        </div>
        <p className="text-xs text-muted">O histórico de consentimento e os pedidos de titulares não são apagados por este prazo, porque servem de prova.</p>
      </div>
    </Card>
  );
}
