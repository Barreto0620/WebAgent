import { test } from "node:test";
import assert from "node:assert/strict";
process.env.SUPABASE_URL ??= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key-000000";
process.env.EVOLUTION_API_KEY ??= "test-evolution-key-0000";
process.env.WEBHOOK_SECRET ??= "0".repeat(32);

const { detectConsentKeyword, pickGreeting, templateVars, openState } = await import("./automations");

const ctx = {
  id: "s1",
  name: "Bookweb",
  timezone: "America/Sao_Paulo",
  settings: {
    welcome_enabled: true,
    welcome_message: "Olá, {{primeiro_nome}}! Protocolo {{protocolo}}.",
    away_enabled: true,
    away_message: "Horário: {{horario}}. Protocolo {{protocolo}}.",
    closing_enabled: true,
    closing_message: "",
    opt_out_message: "",
    welcome_cooldown_minutes: 720,
  },
  hours: [1, 2, 3, 4, 5].map((d) => ({ weekday: d, enabled: true, opens_at: "08:00", closes_at: "18:00" })),
  holidays: [{ date: "2026-12-25", name: "Natal" }],
};

test("palavras de consentimento", () => {
  assert.equal(detectConsentKeyword("SAIR"), "opt_out");
  assert.equal(detectConsentKeyword(" Parar! "), "opt_out");
  assert.equal(detectConsentKeyword("Voltar"), "opt_in");
  assert.equal(detectConsentKeyword("quero sair do plano"), null);
});

test("boas-vindas dentro do horário", () => {
  const state = openState(ctx, new Date("2026-11-25T13:00:00Z"));
  const msg = pickGreeting(ctx, state, templateVars(ctx, "Marina Souza", "BW-261125-0001"));
  assert.equal(msg, "Olá, Marina! Protocolo BW-261125-0001.");
});

test("fora do horário e feriado", () => {
  const night = openState(ctx, new Date("2026-11-25T23:00:00Z"));
  assert.equal(pickGreeting(ctx, night, templateVars(ctx, null, "P1")), "Horário: seg. a sex., 08:00–18:00. Protocolo P1.");
  const xmas = openState(ctx, new Date("2026-12-25T13:00:00Z"));
  assert.match(pickGreeting(ctx, xmas, templateVars(ctx, null, "P2")) ?? "", /feriado \(Natal\)/);
});
