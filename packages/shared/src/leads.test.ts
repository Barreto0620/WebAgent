import { test } from "node:test";
import assert from "node:assert/strict";
import { detectMapping, isNoInterest, normalizeKey, parseLeadDay, renderRow } from "./leads";

const headers = ["Dia", "Canal", "Encaixe", "Cidade", "Nicho", "Negócio", "Telefone", "Instagram", "Site", "Google", "Mensagem 1", "Se demonstrar interesse", "Se perguntar o preço", "Se não tiver interesse", "+3 dias sem resposta", "+7 dias (encerrar)", "Obs."];

test("detecta colunas da planilha de leads", () => {
  const m = detectMapping(headers);
  assert.equal(m.phone, "Telefone");
  assert.equal(m.name, "Negócio");
  assert.equal(m.message, "Mensagem 1");
  assert.equal(m.channel, "Canal");
  assert.equal(m.day, "Dia");
  assert.deepEqual(m.followups, [
    { column: "+3 dias sem resposta", afterDays: 3 },
    { column: "+7 dias (encerrar)", afterDays: 7 },
  ]);
  assert.deepEqual(m.script, ["Se demonstrar interesse", "Se perguntar o preço", "Se não tiver interesse"]);
  assert.equal(m.noInterest, "Se não tiver interesse");
});

test("modelo com colunas", () => {
  assert.equal(normalizeKey("Negócio"), "negocio");
  assert.equal(renderRow("Olá, {{Negócio}} de {{ cidade }}!", { "Negócio": "Happy Pet", Cidade: "Santo André" }), "Olá, Happy Pet de Santo André!");
});

test("dia do lead", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  assert.equal(parseLeadDay("26/11", now, "America/Sao_Paulo"), "2026-11-26T03:00:00.000Z");
  assert.equal(parseLeadDay("07/12", now, "America/Sao_Paulo"), "2026-12-07T03:00:00.000Z");
  assert.equal(parseLeadDay("05/01", now, "America/Sao_Paulo"), "2027-01-05T03:00:00.000Z");
  assert.equal(parseLeadDay("", now, "America/Sao_Paulo"), null);
  assert.equal(parseLeadDay("abc", now, "America/Sao_Paulo"), null);
});

test("não tenho interesse", () => {
  assert.equal(isNoInterest("Não tenho interesse, obrigado"), true);
  assert.equal(isNoInterest("sem interesse"), true);
  assert.equal(isNoInterest("Por favor não me mande mais mensagens"), true);
  assert.equal(isNoInterest("Tenho interesse sim! Qual o preço?"), false);
  assert.equal(isNoInterest("não sei se tenho interesse, me explica melhor"), false);
});

import { buildLeads, googleSheetsCsvUrl, parseCsv, tableToRows } from "./leads";

test("csv com aspas e quebra de linha", () => {
  const t = parseCsv('Nome;Telefone;Mensagem\n"Ana";"(11) 98888-7777";"Olá\nAna, tudo bem?"\n');
  assert.equal(t.length, 2);
  assert.equal(t[1]![2], "Olá\nAna, tudo bem?");
  assert.deepEqual(parseCsv('a,"b ""x""",c'), [["a", 'b "x"', "c"]]);
});

test("link do Google Planilhas", () => {
  assert.equal(
    googleSheetsCsvUrl("https://docs.google.com/spreadsheets/d/1AbC_d-9/edit?usp=sharing#gid=123"),
    "https://docs.google.com/spreadsheets/d/1AbC_d-9/export?format=csv&gid=123",
  );
  assert.equal(googleSheetsCsvUrl("https://example.com/x.xlsx"), null);
});

test("monta leads filtrando canal e ligação", () => {
  const { rows } = tableToRows([
    ["Dia", "Canal", "Negócio", "Telefone", "Mensagem 1", "+3 dias sem resposta", "+7 dias (encerrar)"],
    ["26/11", "whatsapp", "Art in Pets", "(11) 97038-3482", "Olá, pessoal!", "Reforçando...", "Última mensagem"],
    ["26/11", "ligar", "Clínica", "(11) 4054-2772", "[Ligação] Bom dia", "", ""],
    ["27/11", "whatsapp", "Sem fone", "", "Oi", "", ""],
  ]);
  const m = detectMapping(Object.keys(rows[0]!));
  const r = buildLeads(rows, { ...m, channelValue: "whatsapp", messageMode: "column", template: "" }, new Date("2026-11-26T12:00:00Z"), "America/Sao_Paulo");
  assert.equal(r.leads.length, 1);
  assert.equal(r.leads[0]!.name, "Art in Pets");
  assert.equal(r.leads[0]!.sendAfter, "2026-11-26T03:00:00.000Z");
  assert.deepEqual(r.leads[0]!.followups, [{ afterDays: 3, text: "Reforçando..." }, { afterDays: 7, text: "Última mensagem" }]);
  assert.equal(r.ignored.reduce((a, b) => a + b.count, 0), 2);
});
