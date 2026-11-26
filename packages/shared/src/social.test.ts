import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCaption, normalizeHashtag, validateForNetwork } from "./social";

test("hashtags", () => {
  assert.equal(normalizeHashtag("##Black Friday!"), "BlackFriday");
  assert.equal(buildCaption("Promo", ["#promo", "promo", "ofertas"]), "Promo\n\n#promo #ofertas");
  assert.equal(buildCaption("", ["a"]), "#a");
});

test("regras por rede", () => {
  assert.deepEqual(validateForNetwork("instagram", "oi", [], [{ kind: "image" }]), []);
  assert.match(validateForNetwork("instagram", "oi", [], [])[0]!, /precisa/);
  assert.match(validateForNetwork("tiktok", "oi", [], [{ kind: "image" }]).join(), /só vídeo/);
  assert.match(validateForNetwork("facebook", "", [], [{ kind: "image" }, { kind: "video" }]).join(), /não mistura/);
  const tags = Array.from({ length: 31 }, (_, i) => `t${i}`);
  assert.match(validateForNetwork("instagram", "x", tags, [{ kind: "image" }]).join(), /30 hashtags/);
  assert.deepEqual(validateForNetwork("facebook", "Só texto", [], []), []);
});
