"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { addMember, changeRole, removeMember, type TeamRow } from "@/app/actions/team";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/input";
import { initials, timeAgo } from "@/lib/utils";

const ROLES = [
  { id: "agent", label: "Atendente", desc: "Atende conversas e edita contatos." },
  { id: "supervisor", label: "Supervisor", desc: "Também edita horários, mensagens automáticas e respostas rápidas." },
  { id: "admin", label: "Administrador", desc: "Também conecta números e gerencia a equipe." },
] as const;

export function TeamManager({ rows, meId, systemName }: { rows: TeamRow[]; meId: string; systemName: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", fullName: "", role: "agent", password: "" });
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {!open && (
        <div>
          <Button onClick={() => setOpen(true)}>
            <UserPlus className="size-4" /> Adicionar pessoa
          </Button>
        </div>
      )}

      {open && (
        <Card>
          <CardHeader title={`Adicionar ao ${systemName}`} description="Se a pessoa já tem conta no WebAgent, basta o e-mail. Se não tem, defina uma senha provisória." />
          <form
            className="grid gap-4 p-5 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await addMember(form);
                if (r.ok) {
                  toast.success(r.message ?? "Pronto.");
                  setForm({ email: "", fullName: "", role: "agent", password: "" });
                  setOpen(false);
                } else toast.error(r.error);
              });
            }}
          >
            <Field label="Nome" htmlFor="tm-name">
              <Input id="tm-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required minLength={2} autoComplete="off" />
            </Field>
            <Field label="E-mail" htmlFor="tm-email">
              <Input id="tm-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="off" />
            </Field>
            <Field label="Senha provisória (só para conta nova)" htmlFor="tm-pass" hint="Mínimo 10 caracteres, com letras e números. A pessoa troca em Configurações.">
              <Input id="tm-pass" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={10} autoComplete="new-password" />
            </Field>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-[13px] font-medium text-muted">Papel</legend>
              {ROLES.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-2.5 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="radio" name="role" value={r.id} checked={form.role === r.id} onChange={() => setForm({ ...form, role: r.id })} className="mt-1 accent-[var(--primary)]" />
                  <span>
                    <span className="block text-sm font-semibold">{r.label}</span>
                    <span className="block text-xs text-muted">{r.desc}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={pending}>Adicionar</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Pessoa</th>
                <th className="px-3 py-3 font-medium">Papel</th>
                <th className="px-3 py-3 font-medium">Último acesso</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.userId}>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-primary">{initials(r.fullName || r.email)}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-semibold">
                          <span className="truncate">{r.fullName || "Sem nome"}</span>
                          {r.userId === meId && <Badge>você</Badge>}
                          {r.isPlatformAdmin && <Badge tone="warning">admin da plataforma</Badge>}
                        </span>
                        <span className="block truncate text-xs text-muted">{r.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      aria-label={`Papel de ${r.fullName || r.email}`}
                      value={r.role}
                      disabled={pending}
                      onChange={(e) =>
                        start(async () => {
                          const res = await changeRole(r.userId, e.target.value);
                          if (res.ok) toast.success("Papel atualizado.");
                          else toast.error(res.error);
                        })
                      }
                      className="h-9 rounded-lg border border-line bg-bg px-2 text-sm focus:border-primary focus:outline-none"
                    >
                      {ROLES.map((x) => (
                        <option key={x.id} value={x.id}>{x.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-muted">{r.lastSignInAt ? timeAgo(r.lastSignInAt) : "nunca entrou"}</td>
                  <td className="px-5 py-3 text-right">
                    {r.userId !== meId &&
                      (confirm === r.userId ? (
                        <span className="inline-flex items-center gap-2">
                          <Button size="sm" variant="danger" loading={pending} onClick={() => start(async () => {
                            const res = await removeMember(r.userId);
                            if (res.ok) toast.success("Acesso removido. As conversas dele voltaram para a fila.");
                            else toast.error(res.error);
                            setConfirm(null);
                          })}>Remover</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Button>
                        </span>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setConfirm(r.userId)}>Remover acesso</Button>
                      ))}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted">Ninguém neste sistema ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
