"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { addHoliday, removeHoliday } from "@/app/actions/schedule";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const fmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });

export function HolidaysCard({ holidays }: { holidays: { id: string; date: string; name: string; system_id: string | null }[] }) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader title="Feriados e folgas" description="Nesses dias o sistema responde como fechado." />
      <form
        className="flex flex-wrap gap-2 border-b border-line px-5 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addHoliday({ date, name });
            if (r.ok) {
              toast.success("Data adicionada.");
              setDate("");
              setName("");
            } else toast.error(r.error);
          });
        }}
      >
        <Input type="date" aria-label="Data" value={date} onChange={(e) => setDate(e.target.value)} required className="h-9 w-[150px]" />
        <Input aria-label="Nome" placeholder="Ex.: Aniversário da cidade" value={name} onChange={(e) => setName(e.target.value)} required className="h-9 min-w-0 flex-1" />
        <Button size="sm" type="submit" loading={pending} className="h-9">
          Adicionar
        </Button>
      </form>
      <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
        {holidays.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">Nenhuma data futura cadastrada.</li>}
        {holidays.map((h) => (
          <li key={h.id} className="flex items-center gap-3 px-5 py-2.5">
            <span className="w-28 shrink-0 text-[13px] text-muted capitalize tabular">{fmt.format(new Date(`${h.date}T00:00:00Z`))}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{h.name}</span>
            {h.system_id === null ? (
              <Badge>Nacional</Badge>
            ) : (
              <button
                className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-danger"
                aria-label={`Remover ${h.name}`}
                onClick={() =>
                  start(async () => {
                    const r = await removeHoliday(h.id);
                    if (!r.ok) toast.error(r.error);
                  })
                }
              >
                <X className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
