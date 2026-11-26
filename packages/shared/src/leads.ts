/**
 * Leads vindos de planilha (arquivo ou link). Funções puras, usadas no painel e na API.
 */
import { zonedParts } from "./business-hours";

export type LeadRow = Record<string, string>;

/** Normaliza nome de coluna: "Mensagem 1" → "mensagem_1", "Negócio" → "negocio". */
export function normalizeKey(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9+]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export interface LeadMapping {
  phone: string | null;
  name: string | null;
  message: string | null;
  channel: string | null;
  day: string | null;
  /** Colunas de acompanhamento: "+3 dias sem resposta" → 3 */
  followups: { column: string; afterDays: number }[];
  /** Respostas prontas para o atendente (ex.: "Se perguntar o preço") */
  script: string[];
  /** Coluna com a resposta para quem diz que não tem interesse */
  noInterest: string | null;
}

const has = (k: string, ...words: string[]) => words.some((w) => k.includes(w));

/** Sugere o mapeamento a partir dos cabeçalhos. */
export function detectMapping(headers: string[]): LeadMapping {
  const keys = headers.map((h) => ({ h, k: normalizeKey(h) }));
  const find = (pred: (k: string) => boolean) => keys.find(({ k }) => pred(k))?.h ?? null;

  const followups = keys
    .map(({ h, k }) => {
      const m = k.match(/^\+?_?(\d{1,2})_?dias?/);
      return m ? { column: h, afterDays: Number(m[1]) } : null;
    })
    .filter((x): x is { column: string; afterDays: number } => x !== null)
    .sort((a, b) => a.afterDays - b.afterDays);

  const script = keys.filter(({ k }) => k.startsWith("se_")).map(({ h }) => h);
  return {
    phone: find((k) => has(k, "telefone", "celular", "whatsapp_numero", "fone", "numero")) ?? find((k) => k === "whatsapp"),
    name: find((k) => has(k, "negocio", "empresa", "nome", "razao_social", "cliente")),
    message: find((k) => /^mensagem(_1)?$/.test(k) || k === "msg") ?? find((k) => k.startsWith("mensagem")),
    channel: find((k) => k === "canal" || k === "origem"),
    day: find((k) => k === "dia" || k === "data" || has(k, "data_envio")),
    followups,
    script,
    noInterest: find((k) => has(k, "nao_tiver_interesse", "sem_interesse")),
  };
}

/** Substitui {{Coluna}} pelo valor da linha (nome da coluna sem acento, maiúsculas ou espaços). */
export function renderRow(template: string, row: LeadRow): string {
  const byKey = new Map(Object.entries(row).map(([k, v]) => [normalizeKey(k), v]));
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key: string) => byKey.get(normalizeKey(key)) ?? "");
}

/**
 * Interpreta a coluna "Dia" ("26/11", "26/11/2026", "2026-11-26") e devolve o início do dia
 * no fuso informado (ISO UTC). Sem ano: usa o ano atual; se cair mais de 60 dias no passado, o próximo.
 */
export function parseLeadDay(raw: string | null | undefined, now: Date, timeZone: string): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  let d: number, m: number, y: number | null = null;
  let match = v.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (match) {
    d = Number(match[1]);
    m = Number(match[2]);
    if (match[3]) y = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  } else if ((match = v.match(/^(\d{4})-(\d{2})-(\d{2})/))) {
    y = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
  } else {
    return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const today = zonedParts(now, timeZone).isoDate;
  const year = y ?? Number(today.slice(0, 4));
  const iso = (yy: number) => `${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  let date = iso(year);
  if (y === null && new Date(date).getTime() < new Date(today).getTime() - 60 * 86_400_000) date = iso(year + 1);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  const out = new Date(`${date}T00:00:00${offset}`);
  return Number.isNaN(out.getTime()) ? null : out.toISOString();
}

/** Resposta clara de "não tenho interesse" / "não quero receber". Conservador de propósito. */
export function isNoInterest(text: string | null | undefined): boolean {
  const t = (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return /\b(nao\s+(tenho|temos|tem|ha)\s+(nenhum\s+)?interesse|sem\s+interesse|nao\s+(quero|queremos)\s+(receber|mais|nada)|nao\s+me\s+(mande|envie|mandem|enviem)|pare(m)?\s+de\s+(me\s+)?(mandar|enviar)|nao\s+(mande|envie)\s+mais|remov[ae]\s+(meu|o\s+meu|nosso)\s+(numero|contato))\b/.test(t);
}

export interface LeadOptions extends LeadMapping {
  /** Só linhas cujo canal contém este texto (ex.: "whatsapp"). Vazio = todas. */
  channelValue: string;
  /** "column": mensagem vem da coluna; "template": texto único com {{Coluna}} */
  messageMode: "column" | "template";
  template: string;
}

export interface BuiltLead {
  phone: string;
  name: string | null;
  message: string;
  sendAfter: string | null;
  followups: { afterDays: number; text: string }[];
  row: LeadRow;
}

/** Aplica o mapeamento: filtra canal, monta mensagem e acompanhamentos de cada linha. */
export function buildLeads(rows: LeadRow[], o: LeadOptions, now: Date, timeZone: string): { leads: BuiltLead[]; ignored: { reason: string; count: number }[] } {
  const reasons = new Map<string, number>();
  const skip = (r: string) => reasons.set(r, (reasons.get(r) ?? 0) + 1);
  const leads: BuiltLead[] = [];
  const wanted = o.channelValue.trim().toLowerCase();

  for (const row of rows) {
    if (o.channel && wanted && !(row[o.channel] ?? "").toLowerCase().includes(wanted)) {
      skip(`canal diferente de "${o.channelValue}"`);
      continue;
    }
    const phone = (o.phone ? row[o.phone] : "")?.trim() ?? "";
    if (!phone) {
      skip("sem telefone");
      continue;
    }
    const message = (o.messageMode === "template" ? renderRow(o.template, row) : o.message ? (row[o.message] ?? "") : "").trim();
    if (!message) {
      skip("sem mensagem");
      continue;
    }
    if (/^\[(liga[cç][aã]o|ligar)\]/i.test(message)) {
      skip("roteiro de ligação");
      continue;
    }
    leads.push({
      phone,
      name: (o.name ? row[o.name] : null)?.trim() || null,
      message,
      sendAfter: o.day ? parseLeadDay(row[o.day], now, timeZone) : null,
      followups: o.followups.map((f) => ({ afterDays: f.afterDays, text: (row[f.column] ?? "").trim() })).filter((f) => f.text),
      row,
    });
  }
  return { leads, ignored: [...reasons.entries()].map(([reason, count]) => ({ reason, count })) };
}

/** Converte link de compartilhamento do Google Planilhas em link de exportação CSV da aba indicada. */
export function googleSheetsCsvUrl(link: string): string | null {
  try {
    const u = new URL(link);
    if (u.hostname !== "docs.google.com") return null;
    const m = u.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!m) return null;
    const gid = u.searchParams.get("gid") ?? u.hash.match(/gid=(\d+)/)?.[1] ?? "0";
    return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
  } catch {
    return null;
  }
}

/** CSV com aspas, quebras de linha dentro de células e separador , ou ; (detectado). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.indexOf("\n") === -1 ? undefined : src.indexOf("\n"));
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Tabela (1ª linha = cabeçalho) → objetos por coluna. */
export function tableToRows(table: string[][]): { headers: string[]; rows: LeadRow[] } {
  const [head = [], ...body] = table;
  const headers = head.map((h, i) => h.trim() || `Coluna ${i + 1}`);
  const rows = body.map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").toString()])));
  return { headers, rows };
}
