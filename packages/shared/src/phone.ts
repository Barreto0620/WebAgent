/** Normaliza telefone para E.164 sem "+" (formato usado pelo WhatsApp: 5511999998888). */
export function normalizePhone(raw: string, defaultCountry = "55"): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  let n = digits;
  if (n.startsWith("00")) n = n.slice(2);
  if (n.length === 10 || n.length === 11) n = defaultCountry + n;
  if (n.length < 12 || n.length > 15) return null;
  return n;
}

/** Mascara telefone para exibição (LGPD: minimização). Ex.: +55 11 9••••-4321 */
export function maskPhone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length < 8) return "••••";
  const cc = d.slice(0, 2);
  const ddd = d.slice(2, 4);
  const last = d.slice(-4);
  const first = d.slice(4, 5);
  return `+${cc} ${ddd} ${first}••••-${last}`;
}

/** Converte JID do WhatsApp (5511...@s.whatsapp.net) em número. */
export function phoneFromJid(jid: string): string {
  return jid.split("@")[0]?.split(":")[0] ?? jid;
}
