"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { describeHours } from "@webagent/shared";
import { saveBusinessHours } from "@/app/actions/schedule";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface Day {
  weekday: number;
  enabled: boolean;
  opens_at: string;
  closes_at: string;
  break_start: string | null;
  break_end: string | null;
}

const NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
// Mostra de segunda a domingo
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function HoursEditor({ initial }: { initial: Day[] }) {
  const [days, setDays] = useState<Day[]>(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(days) !== JSON.stringify(initial);

  const update = (weekday: number, patch: Partial<Day>) => setDays((ds) => ds.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));

  function copyMondayToWeekdays() {
    const mon = days.find((d) => d.weekday === 1);
    if (!mon) return;
    setDays((ds) => ds.map((d) => (d.weekday >= 2 && d.weekday <= 5 ? { ...mon, weekday: d.weekday } : d)));
  }

  return (
    <Card>
      <CardHeader
        title="Grade semanal"
        description={describeHours(days)}
        action={
          <Button variant="ghost" size="sm" onClick={copyMondayToWeekdays}>
            <Copy className="size-4" /> Copiar segunda para ter–sex
          </Button>
        }
      />
      <ul className="divide-y divide-line">
        {ORDER.map((wd) => {
          const d = days.find((x) => x.weekday === wd)!;
          const hasBreak = d.break_start !== null;
          return (
            <li key={wd} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <div className="flex w-36 items-center gap-3">
                <Switch id={`day-${wd}`} label={`Abrir ${NAMES[wd]}`} checked={d.enabled} onChange={(v) => update(wd, { enabled: v })} />
                <span className={`text-sm font-semibold ${d.enabled ? "" : "text-muted"}`}>{NAMES[wd]}</span>
              </div>
              {d.enabled ? (
                <div className="flex flex-1 flex-wrap items-center gap-2 text-sm">
                  <Input type="time" aria-label={`Abertura ${NAMES[wd]}`} value={d.opens_at} onChange={(e) => update(wd, { opens_at: e.target.value })} className="h-9 w-[110px]" />
                  <span className="text-muted">às</span>
                  <Input type="time" aria-label={`Fechamento ${NAMES[wd]}`} value={d.closes_at} onChange={(e) => update(wd, { closes_at: e.target.value })} className="h-9 w-[110px]" />
                  {hasBreak ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-muted">· pausa</span>
                      <Input type="time" aria-label={`Início da pausa ${NAMES[wd]}`} value={d.break_start ?? ""} onChange={(e) => update(wd, { break_start: e.target.value })} className="h-9 w-[110px]" />
                      <span className="text-muted">–</span>
                      <Input type="time" aria-label={`Fim da pausa ${NAMES[wd]}`} value={d.break_end ?? ""} onChange={(e) => update(wd, { break_end: e.target.value })} className="h-9 w-[110px]" />
                      <button className="text-xs text-muted underline-offset-2 hover:text-danger hover:underline" onClick={() => update(wd, { break_start: null, break_end: null })}>
                        remover
                      </button>
                    </span>
                  ) : (
                    <button className="text-xs font-medium text-primary hover:underline" onClick={() => update(wd, { break_start: "12:00", break_end: "13:00" })}>
                      + pausa de almoço
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-sm text-muted">Fechado</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
        {dirty && <span className="mr-auto text-xs text-gold">Alterações não salvas</span>}
        <Button variant="ghost" disabled={!dirty || pending} onClick={() => setDays(initial)}>
          Descartar
        </Button>
        <Button
          disabled={!dirty}
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await saveBusinessHours(days);
              if (r.ok) toast.success("Horário salvo.");
              else toast.error(r.error);
            })
          }
        >
          Salvar horário
        </Button>
      </div>
    </Card>
  );
}
