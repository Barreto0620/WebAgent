import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMessagesUpsert, parseMessageStatus, parseConnection, previewFor } from "./parse";

test("texto simples", () => {
  const m = parseMessagesUpsert({
    key: { id: "ABC", remoteJid: "5511998764321@s.whatsapp.net", fromMe: false },
    pushName: "Marina",
    message: { conversation: "Oi" },
    messageTimestamp: 1795600000,
  });
  assert.equal(m?.phone, "5511998764321");
  assert.equal(m?.body, "Oi");
  assert.equal(m?.type, "text");
  assert.equal(m?.pushName, "Marina");
});

test("endereçamento LID usa remoteJidAlt", () => {
  const m = parseMessagesUpsert({
    key: { id: "X", remoteJid: "12345@lid", remoteJidAlt: "5511900000000@s.whatsapp.net", fromMe: false },
    message: { extendedTextMessage: { text: "ola" } },
  });
  assert.equal(m?.phone, "5511900000000");
});

test("ignora grupo e status", () => {
  assert.equal(parseMessagesUpsert({ key: { id: "1", remoteJid: "123@g.us" }, message: { conversation: "x" } }), null);
  assert.equal(parseMessagesUpsert({ key: { id: "1", remoteJid: "status@broadcast" }, message: { conversation: "x" } }), null);
});

test("imagem com legenda", () => {
  const m = parseMessagesUpsert({
    key: { id: "I", remoteJid: "5511900000000@s.whatsapp.net" },
    message: { imageMessage: { caption: "boleto", mimetype: "image/jpeg" }, base64: "AAA" },
  });
  assert.equal(m?.type, "image");
  assert.equal(m?.base64, "AAA");
  assert.equal(previewFor("image", "boleto"), "📷 Imagem · boleto");
});

test("status e conexão", () => {
  assert.deepEqual(parseMessageStatus({ keyId: "K", status: "READ" }), { externalId: "K", status: "read" });
  assert.equal(parseConnection({ state: "open", wuid: "5511900000000@s.whatsapp.net" })?.phone, "5511900000000");
  assert.equal(parseConnection({ state: "weird" }), null);
});
