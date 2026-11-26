"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, FileSpreadsheet, Link2, ShieldAlert, Upload } from "lucide-react";
import { buildLeads, detectMapping, type LeadOptions, type LeadRow } from "@webagent/shared";
import { createLeadCampaign, readLeadSource } from "@/app/actions/leads";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SPEEDS = [
  { id: "safe", label: "Segura", desc: "45 a 120 s entre envios", min: 45, max: 120 },
  { id: "normal", label: "Normal", desc: "20 a 60 s entre envios", min: 20, max: 60 },
  { id: "fast", label: "Rápida", desc: "10 a 30 s · mais risco de bloqueio", min: 10, max: 30 },
] as const;

const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

function Select({ id, label, value, onChange, options, allowEmpty = true, hint }: { id: string; label: string; value: string | null; onChange: (v: string | null) => void; options: string[]; allowEmpty?: boolean; hint?: string }) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="h-10 rounded-lg border border-line bg-bg px-3 text-sm focus:border-primary focus:outline-none">
        {allowEmpty && <option value="">— nenhuma —</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </Field>
  );
}

export function LeadCampaignForm({ timezone }: { timezone: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"file" | "link">("file");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState<{ headers: string[]; rows: LeadRow[]; sourceName: string; truncated: boolean } | null>(null);
  const [opts, setOpts] = useState<LeadOptions | null>(null);
  const [name, setName] = useState("");
  const [respectDay, setRespectDay] = useState(true);
  const [followupsEnabled, setFollowupsEnabled] = useState(true);
  const [appendOptout, setAppendOptout] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]["id"]>("safe");
  const [dailyLimit, setDailyLimit] = useState(30);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("18:00");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [legal, setLegal] = useState(false);
  const [reading, startRead] = useTransition();
  const [saving, startSave] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function read() {
    const fd = new FormData();
    if (mode === "file" && file) fd.set("file", file);
    if (mode === "link") fd.set("link", link);
    startRead(async () => {
      const r = await readLeadSource(fd);
      if (!r.ok) return void toast.error(r.error);
      const m = detectMapping(r.data.headers);
      const channelValue = m.channel && r.data.rows.some((row) => (row[m.channel!] ?? "").toLowerCase().includes("whatsapp")) ? "whatsapp" : "";
      setSheet(r.data);
      setOpts({ ...m, channelValue, messageMode: m.message ? "column" : "template", template: m.name ? `Olá, {{${m.name}}}! ` : "Olá! " });
      setFollowupsEnabled(m.followups.length > 0);
      setRespectDay(Boolean(m.day));
      if (!name) setName(`Leads ${r.data.sourceName.replace(/\.(xlsx|csv)$/i, "")}`.slice(0, 80));
      // Se as mensagens já oferecem como recusar, não duplica o aviso
      const sample = m.message ? (r.data.rows[0]?.[m.message] ?? "") : "";
      setAppendOptout(!/interesse|não envio mais|nao envio mais|responda sair/i.test(sample));
      toast.success(`${r.data.rows.length} linhas lidas${r.data.truncated ? " (limite de 5.000)" : ""}.`);
    });
  }

  const built = useMemo(() => (sheet && opts ? buildLeads(sheet.rows, opts, new Date(), timezone) : null), [sheet, opts, timezone]);
  const sp = SPEEDS.find((s) => s.id === speed)!;
  const leadsCount = built?.leads.length ?? 0;
  const perDay = Math.min(dailyLimit, Math.floor(((Number(windowEnd.slice(0, 2)) - Number(windowStart.slice(0, 2))) * 3600) / ((sp.min + sp.max) / 2)));
  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of built?.leads ?? []) m.set(l.sendAfter ?? "", (m.get(l.sendAfter ?? "") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [built]);
  const maxPerDay = Math.max(0, ...byDay.map(([, n]) => n));

  function save(start: boolean) {
    if (!built || !opts) return;
    startSave(async () => {
      const r = await createLeadCampaign({
        name,
        sourceName: sheet?.sourceName ?? null,
        sourceUrl: mode === "link" ? link.trim() : null,
        mapping: opts,
        respectDay: respectDay && Boolean(opts.day),
        followupsEnabled: followupsEnabled && opts.followups.length > 0,
        appendOptout,
        minIntervalS: sp.min,
        maxIntervalS: sp.max,
        dailyLimit,
        windowStart,
        windowEnd,
        scheduledAt: when === "later" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        start,
        leads: built.leads,
      });
      if (!r.ok) return void toast.error(r.error);
      const d = r.data;
      const extra = [d.invalid ? `${d.invalid} telefone(s) inválido(s)` : "", d.optedOut ? `${d.optedOut} já tinham pedido para não receber` : ""].filter(Boolean).join(", ");
      if (start && !d.started) toast.error(`Campanha salva, mas não iniciou: ${d.startError}`);
      else toast.success(`${d.added} leads na campanha${extra ? ` (${extra})` : ""}.`);
      router.push(`/campanhas/${d.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="1. Planilha" description="Arquivo .xlsx ou .csv, ou o link de compartilhamento (Google Planilhas: “Qualquer pessoa com o link pode ver”)." />
        <div className="flex flex-col gap-4 p-5">
          <div role="tablist" aria-label="Origem" className="grid w-full max-w-sm grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
            {[
              { id: "file" as const, label: "Arquivo", icon: Upload },
              { id: "link" as const, label: "Link", icon: Link2 },
            ].map((t) => (
              <button key={t.id} role="tab" aria-selected={mode === t.id} onClick={() => setMode(t.id)} className={cn("flex items-center justify-center gap-2 rounded-md py-1.5 text-[13px] font-semibold", mode === t.id ? "bg-surface shadow-sm" : "text-muted")}>
                <t.icon className="size-4" /> {t.label}
              </button>
            ))}
          </div>
          {mode === "file" ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <FileSpreadsheet className="size-4" /> Escolher arquivo
              </Button>
              <span className="text-sm text-muted">{file ? file.name : "Nenhum arquivo escolhido"}</span>
              <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          ) : (
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" aria-label="Link da planilha" inputMode="url" />
          )}
          <div>
            <Button onClick={read} loading={reading} disabled={mode === "file" ? !file : !/^https:\/\//.test(link.trim())}>
              Ler planilha
            </Button>
          </div>
        </div>
      </Card>

      {sheet && opts && built && (
        <>
          <Card>
            <CardHeader title="2. Colunas" description={`${sheet.sourceName} · ${sheet.rows.length} linhas · ${sheet.headers.length} colunas. Conferimos sozinhos; ajuste se precisar.`} />
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <Select id="m-phone" label="Telefone (WhatsApp)" value={opts.phone} onChange={(v) => setOpts({ ...opts, phone: v })} options={sheet.headers} />
              <Select id="m-name" label="Nome do lead" value={opts.name} onChange={(v) => setOpts({ ...opts, name: v })} options={sheet.headers} />
              <Select id="m-day" label="Dia de envio" value={opts.day} onChange={(v) => setOpts({ ...opts, day: v })} options={sheet.headers} hint="Cada lead só recebe a partir do dia da linha." />
              <Select id="m-channel" label="Coluna de canal" value={opts.channel} onChange={(v) => setOpts({ ...opts, channel: v })} options={sheet.headers} />
              <Field label="Enviar só quando o canal contém" htmlFor="m-chval" hint="Vazio = todas as linhas">
                <Input id="m-chval" value={opts.channelValue} onChange={(e) => setOpts({ ...opts, channelValue: e.target.value })} disabled={!opts.channel} />
              </Field>
              <Select id="m-noint" label="Resposta para “sem interesse”" value={opts.noInterest} onChange={(v) => setOpts({ ...opts, noInterest: v })} options={sheet.headers} hint="Enviada sozinha quando o lead recusa." />
            </div>
            <div className="flex flex-col gap-3 border-t border-line p-5">
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="msgmode" checked={opts.messageMode === "column"} onChange={() => setOpts({ ...opts, messageMode: "column" })} className="accent-[var(--primary)]" /> Mensagem pronta em uma coluna
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="msgmode" checked={opts.messageMode === "template"} onChange={() => setOpts({ ...opts, messageMode: "template" })} className="accent-[var(--primary)]" /> Texto único com variáveis
                </label>
              </div>
              {opts.messageMode === "column" ? (
                <div className="max-w-sm">
                  <Select id="m-msg" label="Coluna da 1ª mensagem" value={opts.message} onChange={(v) => setOpts({ ...opts, message: v })} options={sheet.headers} />
                </div>
              ) : (
                <Field label="Texto" htmlFor="m-tpl" hint={`Use o nome de qualquer coluna entre chaves, ex.: {{${sheet.headers[0]}}}`}>
                  <Textarea id="m-tpl" value={opts.template} onChange={(e) => setOpts({ ...opts, template: e.target.value })} rows={5} maxLength={3000} />
                </Field>
              )}
            </div>
            <div className="grid gap-4 border-t border-line p-5 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Acompanhamento automático</p>
                    <p className="text-xs text-muted">Se o lead não responder, envia as colunas abaixo nos dias indicados. Para assim que ele responder.</p>
                  </div>
                  <Switch id="fu" label="Acompanhamento automático" checked={followupsEnabled && opts.followups.length > 0} disabled={!opts.followups.length} onChange={setFollowupsEnabled} />
                </div>
                {opts.followups.length ? (
                  <ul className="flex flex-col gap-1 text-[13px]">
                    {opts.followups.map((f) => (
                      <li key={f.column} className="flex items-center gap-2"><Badge tone="info">+{f.afterDays} dias</Badge> {f.column}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted">Nenhuma coluna como “+3 dias” encontrada.</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">Roteiro para o atendente</p>
                <p className="text-xs text-muted">Aparecem como botões na conversa quando o lead responder.</p>
                <div className="flex flex-wrap gap-1.5">
                  {sheet.headers.map((h) => {
                    const on = opts.script.includes(h);
                    return (
                      <button key={h} type="button" aria-pressed={on} onClick={() => setOpts({ ...opts, script: on ? opts.script.filter((x) => x !== h) : [...opts.script, h] })} className={cn("rounded-full border px-2.5 py-0.5 text-xs", on ? "border-primary bg-primary/12 text-primary" : "border-line text-muted")}>
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title={`${leadsCount} leads prontos`}
              description={built.ignored.length ? `Ignoradas: ${built.ignored.map((i) => `${i.count} ${i.reason}`).join(" · ")}` : "Todas as linhas entraram."}
            />
            {respectDay && opts.day && byDay.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3 text-xs">
                <CalendarDays className="size-4 text-muted" aria-hidden />
                {byDay.map(([d, n]) => (
                  <span key={d} className="rounded-md bg-surface-2 px-2 py-0.5 tabular">{d ? dayFmt.format(new Date(d)) : "sem dia"}: <b>{n}</b></span>
                ))}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-line text-left text-xs text-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Lead</th>
                    <th className="px-3 py-2.5 font-medium">Telefone</th>
                    <th className="px-3 py-2.5 font-medium">Dia</th>
                    <th className="px-5 py-2.5 font-medium">1ª mensagem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {built.leads.slice(0, 6).map((l, i) => (
                    <tr key={i}>
                      <td className="px-5 py-2.5 font-medium">{l.name ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted tabular">{l.phone}</td>
                      <td className="px-3 py-2.5 text-muted tabular">{l.sendAfter ? dayFmt.format(new Date(l.sendAfter)) : "—"}</td>
                      <td className="max-w-md truncate px-5 py-2.5 text-muted" title={l.message}>{l.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {leadsCount > 6 && <p className="border-t border-line px-5 py-2 text-xs text-muted">+ {leadsCount - 6} leads</p>}
          </Card>

          <Card>
            <CardHeader title="3. Envio" />
            <div className="flex flex-col gap-4 p-5">
              <Field label="Nome da campanha" htmlFor="lc-name">
                <Input id="lc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              </Field>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Velocidade">
                {SPEEDS.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={speed === s.id} onClick={() => setSpeed(s.id)} className={cn("rounded-xl border p-3 text-left", speed === s.id ? "border-primary bg-primary/8" : "border-line hover:border-primary/40")}>
                    <span className="block text-sm font-semibold">{s.label}</span>
                    <span className={cn("block text-xs", s.id === "fast" ? "text-gold" : "text-muted")}>{s.desc}</span>
                  </button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Limite por dia (número)" htmlFor="lc-limit" hint="Para número novo, comece com até 30.">
                  <Input id="lc-limit" type="number" min={1} max={2000} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value) || 1)} />
                </Field>
                <Field label="Enviar a partir de" htmlFor="lc-ws">
                  <Input id="lc-ws" type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
                </Field>
                <Field label="Até" htmlFor="lc-we">
                  <Input id="lc-we" type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
                </Field>
              </div>
              <div className="flex flex-col gap-3 text-sm">
                {opts.day && (
                  <label className="flex items-center justify-between gap-3">
                    <span>Respeitar a coluna “{opts.day}” (cada lead no seu dia)</span>
                    <Switch id="rd" label="Respeitar dia" checked={respectDay} onChange={setRespectDay} />
                  </label>
                )}
                <label className="flex items-center justify-between gap-3">
                  <span>Acrescentar “Para não receber mais mensagens, responda SAIR.”</span>
                  <Switch id="ao" label="Aviso de descadastro" checked={appendOptout} onChange={setAppendOptout} />
                </label>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2"><input type="radio" name="lwhen" checked={when === "now"} onChange={() => setWhen("now")} className="accent-[var(--primary)]" /> Começar agora</label>
                  <label className="flex items-center gap-2"><input type="radio" name="lwhen" checked={when === "later"} onChange={() => setWhen("later")} className="accent-[var(--primary)]" /> Agendar início</label>
                  {when === "later" && <Input type="datetime-local" aria-label="Início" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-9 w-auto" />}
                </div>
              </div>
              {maxPerDay > perDay && respectDay && (
                <p className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold">
                  Um dos dias tem {maxPerDay} leads, mas com estes ajustes cabem cerca de {perDay} por dia. O que sobrar vai para o dia seguinte.
                </p>
              )}
              <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-[13px]">
                <input type="checkbox" checked={legal} onChange={(e) => setLegal(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
                <span className="text-muted">
                  Confirmo que são contatos comerciais (empresas) com telefone público, abordados por legítimo interesse (LGPD, art. 7º, IX), e que a mensagem oferece como recusar. Quem disser que não tem interesse ou mandar SAIR é descadastrado na hora.
                </span>
              </label>
              <div className="flex gap-3 rounded-xl border border-gold/40 bg-gold/5 p-3 text-[13px]">
                <ShieldAlert className="size-5 shrink-0 text-gold" aria-hidden />
                <p className="text-muted">Mensagem para quem não conhece o número é o maior risco de bloqueio. Use velocidade Segura, limite baixo nos primeiros dias e acompanhe as respostas.</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" loading={saving} disabled={!leadsCount || !legal || name.trim().length < 2} onClick={() => save(false)}>
                  Salvar rascunho
                </Button>
                <Button loading={saving} disabled={!leadsCount || !legal || name.trim().length < 2 || (when === "later" && !scheduledAt)} onClick={() => save(true)}>
                  {when === "later" ? "Agendar campanha" : `Iniciar com ${leadsCount} leads`}
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
