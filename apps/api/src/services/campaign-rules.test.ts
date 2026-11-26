import { test } from "node:test";
import assert from "node:assert/strict";
process.env.SUPABASE_URL ??= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key-000000";
process.env.EVOLUTION_API_KEY ??= "test-evolution-key-0000";
process.env.WEBHOOK_SECRET ??= "0".repeat(32);
process.env.REDIS_URL ??= "redis://127.0.0.1:1/0";

const { msUntilWindow, campaignText, randomDelay, OPT_OUT_FOOTER } = await import("./campaign-rules");
const tz = "America/Sao_Paulo";

test("janela de envio", () => {
  // 10:00 em SP (13:00 UTC) dentro de 09–20
  assert.equal(msUntilWindow(new Date("2026-11-25T13:00:00Z"), tz, "09:00", "20:00"), 0);
  // 07:00 em SP: faltam 2 h
  assert.equal(msUntilWindow(new Date("2026-11-25T10:00:00Z"), tz, "09:00", "20:00"), 2 * 3_600_000);
  // 21:00 em SP: abre às 09:00 do dia seguinte (12 h)
  assert.equal(msUntilWindow(new Date("2026-11-26T00:00:00Z"), tz, "09:00:00", "20:00:00"), 12 * 3_600_000);
});

test("texto da campanha com rodapé de descadastro", () => {
  const t = campaignText("Oi {{primeiro_nome}}, novidade no {{sistema}}!", { name: "Marina Souza", push_name: null }, "Bookweb");
  assert.equal(t, "Oi Marina, novidade no Bookweb!" + OPT_OUT_FOOTER);
});

test("intervalo aleatório dentro do limite", () => {
  for (let i = 0; i < 50; i++) {
    const d = randomDelay(20, 60);
    assert.ok(d >= 20_000 && d <= 60_000);
  }
});
