"use client";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Hand, MoonStar, CheckCircle2, ShieldOff } from "lucide-react";
import { renderTemplate } from "@webagent/shared";
import { saveAutomations } from "@/app/actions/schedule";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/input";

interface Settings {
  welcome_enabled: boolean;
  welcome_message: string;
  away_enabled: boolean;
  away_message: string;
  closing_enabled: boolean;
  closing_message: string;
  opt_out_message: string;
}

type MsgKey = "welcome_message" | "away_message" | "closing_message" | "opt_out_message";

const VARIABLES = [
  { key: "{{primeiro_nome}}", label: "Primeiro nome" },
  { key: "{{protocolo}}", label: "Protocolo" },
  { key: "{{sistema}}", label: "Sistema" },
  { key: "{{horario}}", label: "Horário" },
];

const BLOCKS: { msg: MsgKey; toggle?: keyof Settings; title: string; when: string; icon: typeof Hand }[] = [
  { msg: "welcome_message", toggle: "welcome_enabled", title: "Boas-vindas", when: "Primeira mensagem de uma conversa nova, dentro do horário.", icon: Hand },
  { msg: "away_message", toggle: "away_enabled", title: "Fora do horário", when: "Primeira mensagem fora do horário, em pausa ou feriado.", icon: MoonStar },
  { msg: "closing_message", toggle: "closing_enabled", title: "Encerramento", when: "Quando o atendente clica em Resolver.", icon: CheckCircle2 },
  { msg: "opt_out_message", title: "Descadastro (LGPD)", when: "Quando o cliente envia SAIR, PARAR ou STOP. Sempre ativo.", icon: ShieldOff },
];

export function AutomationsEditor({ initial, sample }: { initial: Settings; sample: Record<string, string> }) {
  const [s, setS] = useState(initial);
  const [focus, setFocus] = useState<MsgKey>("welcome_message");
  const [pending, start] = useTransition();
  const refs = useRef<Partial<Record<MsgKey, HTMLTextAreaElement | null>>>({});
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);

  function insertVar(v: string) {
    const el = refs.current[focus];
    const text = s[focus];
    const pos = el?.selectionStart ?? text.length;
    const next = text.slice(0, pos) + v + text.slice(el?.selectionEnd ?? pos);
    setS({ ...s, [focus]: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos + v.length, pos + v.length);
    });
  }

  const preview = renderTemplate(s[focus], sample);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
      <div className="flex flex-col gap-4">
        {BLOCKS.map((b) => {
          const Icon = b.icon;
          const enabled = b.toggle ? (s[b.toggle] as boolean) : true;
          return (
            <Card key={b.msg} className={focus === b.msg ? "border-primary/50" : undefined}>
              <div className="flex items-start gap-3 px-5 pt-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-bold">{b.title}</h2>
                  <p className="text-[13px] text-muted">{b.when}</p>
                </div>
                {b.toggle && <Switch id={`t-${b.msg}`} label={`Ativar ${b.title}`} checked={enabled} onChange={(v) => setS({ ...s, [b.toggle!]: v })} />}
              </div>
              <div className="px-5 pt-3 pb-4">
                <Textarea
                  ref={(el) => {
                    refs.current[b.msg] = el;
                  }}
                  aria-label={`Texto da mensagem: ${b.title}`}
                  value={s[b.msg]}
                  disabled={!enabled}
                  onFocus={() => setFocus(b.msg)}
                  onChange={(e) => setS({ ...s, [b.msg]: e.target.value })}
                  maxLength={1000}
                  rows={3}
                />
                <p className="mt-1 text-right text-[11px] text-muted tabular">{s[b.msg].length}/1000</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 xl:sticky xl:top-20">
        <Card className="p-4">
          <p className="mb-2 text-[13px] font-semibold">Inserir variável</p>
          <div className="flex flex-wrap gap-2">
            {VARIABLES.map((v) => (
              <button key={v.key} type="button" onClick={() => insertVar(v.key)} className="rounded-md border border-line bg-bg px-2 py-1 font-mono text-[12px] text-primary hover:border-primary">
                {v.key}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Clique para inserir na mensagem selecionada.</p>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 bg-sidebar px-4 py-3 text-white">
            <span className="size-8 rounded-full bg-neon/20" />
            <div>
              <p className="text-sm font-semibold">{sample.sistema}</p>
              <p className="text-[11px] text-white/50">Prévia no WhatsApp</p>
            </div>
          </div>
          <div className="grid-bg flex min-h-48 flex-col gap-2 bg-bg p-4">
            <div className="max-w-[80%] self-start rounded-xl rounded-tl-sm border border-line bg-[var(--bubble-in)] px-3 py-2 text-[13px]">Oi, preciso de ajuda</div>
            <div className="max-w-[85%] self-end rounded-xl rounded-tr-sm bg-[var(--bubble-out)] px-3 py-2 text-[13px] whitespace-pre-wrap">
              {preview || <span className="text-muted">Mensagem vazia</span>}
              <span className="mt-1 block text-right text-[10px] text-muted">automática</span>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          {dirty && <span className="mr-auto self-center text-xs text-gold">Alterações não salvas</span>}
          <Button variant="ghost" disabled={!dirty || pending} onClick={() => setS(initial)}>
            Descartar
          </Button>
          <Button
            disabled={!dirty}
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await saveAutomations(s);
                if (r.ok) toast.success("Mensagens salvas. Valem para as próximas conversas.");
                else toast.error(r.error);
              })
            }
          >
            Salvar mensagens
          </Button>
        </div>
      </div>
    </div>
  );
}
