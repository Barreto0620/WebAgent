import { firstName, renderTemplate, zonedParts } from "@webagent/shared";

/** Regras puras das campanhas (sem banco nem fila): testadas em campaign-rules.test.ts */
export const OPT_OUT_FOOTER = "\n\nPara não receber mais mensagens, responda SAIR.";

const toMin = (t: string) => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Quantos ms faltam para a janela de envio abrir (0 se já está aberta). */
export function msUntilWindow(now: Date, tz: string, start: string, end: string): number {
  const { minutes } = zonedParts(now, tz);
  const s = toMin(start);
  const e = toMin(end);
  if (minutes >= s && minutes < e) return 0;
  const wait = minutes < s ? s - minutes : 24 * 60 - minutes + s;
  return wait * 60_000;
}

export function campaignText(template: string, contact: { name: string | null; push_name: string | null }, systemName: string) {
  const nome = contact.name ?? contact.push_name ?? "";
  return renderTemplate(template, { nome, primeiro_nome: firstName(nome) || "tudo bem", sistema: systemName }).trim() + OPT_OUT_FOOTER;
}

export function randomDelay(minS: number, maxS: number) {
  return (minS + Math.random() * (maxS - minS)) * 1000;
}
