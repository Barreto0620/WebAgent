import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateBusinessHours, describeHours, type BusinessHoursRule } from "./business-hours";
import { normalizePhone, maskPhone } from "./phone";
import { renderTemplate } from "./template";

const weekdays: BusinessHoursRule[] = [1, 2, 3, 4, 5].map((d) => ({
  weekday: d, enabled: true, opens_at: "08:00", closes_at: "18:00", break_start: "12:00", break_end: "13:00",
}));
const tz = "America/Sao_Paulo";

test("aberto numa quarta às 10h (SP)", () => {
  // 2026-11-25 é quarta; 10:00 SP = 13:00 UTC
  assert.equal(evaluateBusinessHours(weekdays, [], new Date("2026-11-25T13:00:00Z"), tz).open, true);
});
test("fechado após 18h", () => {
  assert.equal(evaluateBusinessHours(weekdays, [], new Date("2026-11-25T22:30:00Z"), tz).reason, "after_close");
});
test("pausa de almoço", () => {
  assert.equal(evaluateBusinessHours(weekdays, [], new Date("2026-11-25T15:30:00Z"), tz).reason, "break");
});
test("domingo fechado", () => {
  assert.equal(evaluateBusinessHours(weekdays, [], new Date("2026-11-29T13:00:00Z"), tz).reason, "closed_day");
});
test("feriado", () => {
  const r = evaluateBusinessHours(weekdays, [{ date: "2026-11-25", name: "Teste" }], new Date("2026-11-25T13:00:00Z"), tz);
  assert.equal(r.reason, "holiday");
});
test("descrição", () => {
  assert.equal(describeHours(weekdays), "seg. a sex., 08:00–18:00");
});
test("telefone", () => {
  assert.equal(normalizePhone("(11) 99876-4321"), "5511998764321");
  assert.equal(normalizePhone("123"), null);
  assert.equal(maskPhone("5511998764321"), "+55 11 9••••-4321");
});
test("template", () => {
  assert.equal(renderTemplate("Olá {{primeiro_nome}}, protocolo {{protocolo}}", { primeiro_nome: "Ana", protocolo: "BW-1" }), "Olá Ana, protocolo BW-1");
});
