"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldAlert, Users } from "lucide-react";
import { renderTemplate } from "@webagent/shared";
import { audienceCount, createCampaign } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SPEEDS = [
  { id: "safe", label: "Segura", desc: "45 a 120 s entre envios", min: 45, max: 120 },
  { id: "normal", label: "Normal", desc: "20 a 60 s entre envios", min: 20, max: 60 },
  { id: "fast", label: "Rápida", desc: "10 a 30 s · mais risco de bloqueio", min: 10, max: 30 },
] as const;

const FOOTER = "\n\nPara não receber mais mensagens, responda SAIR.";

export function CampaignForm({ tags, optInTotal, systemName }: { tags: { tag: string; count: number }[]; optInTotal: number; systemName: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("Olá, {{primeiro_nome}}! ");
  const [selected, setSelected] = useState<string[]>([]);
  const [count, setCount] = useState<number | null>(optInTotal);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]["id"]>("normal");
  const [dailyLimit, setDailyLimit] = useState(200);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("20:00");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    setCount(null);
    audienceCount(selected).then((n) => alive && setCount(n));
    return () => {
      alive = false;
    };
  }, [selected]);

  const sp = SPEEDS.find((s) => s.id === speed)!;
  const avg = (sp.min + sp.max) / 2;
  const perDay = Math.min(dailyLimit, Math.floor(((Number(windowEnd.slice(0, 2)) - Number(windowStart.slice(0, 2))) * 3600) / avg));
  const daysNeeded = count ? Math.ceil(count / Math.max(1, perDay)) : 0;
  const preview = renderTemplate(message, { primeiro_nome: "Marina", nome: "Marina Souza", sistema: systemName }).trim() + FOOTER;

  function submit(startNow: boolean) {
    start(async () => {
      const r = await createCampaign(
        {
          name,
          message,
          audience_tags: selected,
          scheduled_at: when === "later" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          min_interval_s: sp.min,
          max_interval_s: sp.max,
          daily_limit: dailyLimit,
          window_start: windowStart,
          window_end: windowEnd,
        },
        startNow,
      );
      if (r.ok) {
        toast.success(startNow ? (when === "later" ? "Campanha agendada." : "Campanha iniciada.") : "Rascunho salvo.");
        router.push(`/campanhas/${r.data!.id}`);
      } else toast.error(r.error);
    });
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="1. Mensagem" />
          <div className="flex flex-col gap-4 p-5">
            <Field label="Nome interno" htmlFor="cp-name" hint="Só a equipe vê.">
              <Input id="cp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Aviso de manutenção 28/11" maxLength={80} />
            </Field>
            <Field label="Texto" htmlFor="cp-msg" hint="Variáveis: {{primeiro_nome}}, {{nome}}, {{sistema}}. O aviso “responda SAIR” é adicionado sempre (LGPD).">
              <Textarea id="cp-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} maxLength={3000} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="2. Público" description="Somente contatos marcados como “Aceita mensagens”." />
          <div className="flex flex-col gap-3 p-5">
            {tags.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma etiqueta entre os contatos com opt-in. A campanha vai para todos os {optInTotal} contatos que aceitaram.</p>
            ) : (
              <>
                <p className="text-[13px] text-muted">Escolha etiquetas (qualquer uma delas). Sem seleção = todos com opt-in.</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map(({ tag, count: n }) => {
                    const on = selected.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSelected((s) => (on ? s.filter((x) => x !== tag) : [...s, tag]))}
                        className={cn("rounded-full border px-3 py-1 text-[13px]", on ? "border-primary bg-primary/12 text-primary" : "border-line text-muted hover:text-fg")}
                      >
                        #{tag} <span className="tabular opacity-70">{n}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-primary" /> {count === null ? "Calculando…" : `${count} destinatário(s)`}
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="3. Envio" />
          <div className="flex flex-col gap-4 p-5">
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Velocidade">
              {SPEEDS.map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={speed === s.id} onClick={() => setSpeed(s.id)} className={cn("rounded-xl border p-3 text-left", speed === s.id ? "border-primary bg-primary/8" : "border-line hover:border-primary/40")}>
                  <span className="block text-sm font-semibold">{s.label}</span>
                  <span className={cn("block text-xs", s.id === "fast" ? "text-gold" : "text-muted")}>{s.desc}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Limite por dia" htmlFor="cp-limit">
                <Input id="cp-limit" type="number" min={1} max={2000} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value) || 1)} />
              </Field>
              <Field label="Enviar a partir de" htmlFor="cp-ws">
                <Input id="cp-ws" type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
              </Field>
              <Field label="Até" htmlFor="cp-we">
                <Input id="cp-we" type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="when" checked={when === "now"} onChange={() => setWhen("now")} className="accent-[var(--primary)]" /> Começar agora
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="when" checked={when === "later"} onChange={() => setWhen("later")} className="accent-[var(--primary)]" /> Agendar
              </label>
              {when === "later" && <Input type="datetime-local" aria-label="Data e hora" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-9 w-auto" />}
            </div>
            {count !== null && count > 0 && (
              <p className="text-xs text-muted">Estimativa: cerca de {perDay} envios por dia → {daysNeeded <= 1 ? "termina no mesmo dia" : `cerca de ${daysNeeded} dias`}.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-4 xl:sticky xl:top-20">
        <Card className="overflow-hidden">
          <div className="bg-sidebar px-4 py-3 text-sm font-semibold text-white">Prévia no WhatsApp</div>
          <div className="grid-bg bg-bg p-4">
            <div className="ml-auto max-w-[90%] rounded-xl rounded-tr-sm bg-[var(--bubble-out)] px-3 py-2 text-[13px] whitespace-pre-wrap">{preview}</div>
          </div>
        </Card>
        <Card className="flex gap-3 border-gold/40 bg-gold/5 p-4 text-[13px]">
          <ShieldAlert className="size-5 shrink-0 text-gold" aria-hidden />
          <p className="text-muted">
            Envio em massa por WhatsApp não oficial pode bloquear o número. Use a velocidade Segura em listas grandes, só para quem pediu para receber, e evite links encurtados.
          </p>
        </Card>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" loading={pending} disabled={!name.trim() || message.trim().length < 2} onClick={() => submit(false)}>
            Salvar rascunho
          </Button>
          <Button loading={pending} disabled={!name.trim() || message.trim().length < 2 || !count || (when === "later" && !scheduledAt)} onClick={() => submit(true)}>
            {when === "later" ? "Agendar campanha" : "Iniciar campanha"}
          </Button>
        </div>
      </div>
    </div>
  );
}
