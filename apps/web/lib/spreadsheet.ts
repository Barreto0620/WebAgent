import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ExcelJS from "exceljs";
import { googleSheetsCsvUrl, parseCsv, tableToRows, type LeadRow } from "@webagent/shared";

const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 5000;

export interface ParsedSheet {
  headers: string[];
  rows: LeadRow[];
  sourceName: string;
  truncated: boolean;
}

/** Bloqueia endereços internos (proteção contra SSRF: o link é digitado no painel). */
function isPrivateAddress(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v === "::";
  }
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

async function assertPublicUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Link inválido.");
  }
  if (u.protocol !== "https:") throw new Error("Use um link https.");
  const host = u.hostname;
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (!ips.length) throw new Error("Não foi possível acessar o endereço do link.");
  if (ips.some(isPrivateAddress)) throw new Error("Este endereço não é permitido.");
  return u;
}

async function safeFetch(url: string): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    const u = await assertPublicUrl(current);
    const res = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "WebAgent/1.0 (+planilha de leads)" } });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("O link redirecionou sem destino.");
      current = new URL(loc, u).toString();
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new Error("A planilha não está pública. Compartilhe como “Qualquer pessoa com o link pode ver”.");
    if (!res.ok) throw new Error(`O link respondeu com erro ${res.status}.`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) throw new Error("Arquivo maior que 10 MB.");
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) throw new Error("Arquivo maior que 10 MB.");
    return { buffer, contentType: res.headers.get("content-type") ?? "", finalUrl: current };
  }
  throw new Error("O link redirecionou vezes demais.");
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    const d = String(v.getUTCDate()).padStart(2, "0");
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    return `${d}/${m}/${v.getUTCFullYear()}`;
  }
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("error" in v) return "";
  }
  return String(v);
}

async function readXlsx(buffer: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  // Primeira aba que tem dados de verdade (a planilha pode ter abas vazias)
  const sheet = wb.worksheets.find((ws) => ws.actualRowCount > 1) ?? wb.worksheets[0];
  if (!sheet) return [];
  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= sheet.columnCount; c++) cells.push(cellText(row.getCell(c).value).trim());
    if (cells.some(Boolean)) table.push(cells);
  });
  return table;
}

function finish(table: string[][], sourceName: string): ParsedSheet {
  if (table.length < 2) throw new Error("A planilha precisa de uma linha de cabeçalho e pelo menos uma linha de dados.");
  const { headers, rows } = tableToRows(table);
  return { headers, rows: rows.slice(0, MAX_ROWS), sourceName, truncated: rows.length > MAX_ROWS };
}

const isZip = (b: Buffer) => b[0] === 0x50 && b[1] === 0x4b;

export async function parseUploadedFile(file: File): Promise<ParsedSheet> {
  if (file.size > MAX_BYTES) throw new Error("Arquivo maior que 10 MB.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || isZip(buffer)) return finish(await readXlsx(buffer), file.name);
  if (name.endsWith(".csv") || name.endsWith(".txt")) return finish(parseCsv(buffer.toString("utf8")), file.name);
  if (name.endsWith(".xls")) throw new Error("Formato .xls antigo não é suportado. Salve como .xlsx ou .csv.");
  throw new Error("Envie um arquivo .xlsx ou .csv.");
}

export async function parseFromLink(link: string): Promise<ParsedSheet> {
  const google = googleSheetsCsvUrl(link.trim());
  const { buffer, contentType, finalUrl } = await safeFetch(google ?? link.trim());
  const name = google ? "Google Planilhas" : (new URL(finalUrl).pathname.split("/").pop() || "Planilha do link");
  if (isZip(buffer)) return finish(await readXlsx(buffer), name);
  const text = buffer.toString("utf8");
  if (contentType.includes("text/html") || /^\s*<!doctype html|^\s*<html/i.test(text)) {
    throw new Error("O link abriu uma página, não a planilha. No Google Planilhas: Compartilhar → “Qualquer pessoa com o link”. Em outros serviços, use o link de download direto.");
  }
  return finish(parseCsv(text), name);
}
