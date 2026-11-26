/** Regras de publicação por rede (validadas no painel e de novo na API antes de publicar). */
export type SocialProvider = "instagram" | "facebook" | "tiktok";

export interface PostMedia {
  path: string;
  mime: string;
  kind: "image" | "video";
  size: number;
}

export const NETWORK_RULES: Record<
  SocialProvider,
  { label: string; captionMax: number; hashtagMax: number | null; requiresMedia: boolean; maxItems: number; videoOnly: boolean; allowMixed: boolean; maxVideos: number }
> = {
  instagram: { label: "Instagram", captionMax: 2200, hashtagMax: 30, requiresMedia: true, maxItems: 10, videoOnly: false, allowMixed: true, maxVideos: 10 },
  facebook: { label: "Facebook", captionMax: 63206, hashtagMax: null, requiresMedia: false, maxItems: 10, videoOnly: false, allowMixed: false, maxVideos: 1 },
  tiktok: { label: "TikTok", captionMax: 2200, hashtagMax: null, requiresMedia: true, maxItems: 1, videoOnly: true, allowMixed: false, maxVideos: 1 },
};

export function normalizeHashtag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}_]/gu, "");
}

/** Legenda final: texto + hashtags no fim. */
export function buildCaption(caption: string, hashtags: string[]): string {
  const tags = [...new Set(hashtags.map(normalizeHashtag).filter(Boolean))].map((t) => `#${t}`);
  const text = caption.trim();
  return tags.length ? `${text}${text ? "\n\n" : ""}${tags.join(" ")}` : text;
}

/** Problemas que impedem publicar nesta rede (lista vazia = ok). */
export function validateForNetwork(provider: SocialProvider, caption: string, hashtags: string[], media: Pick<PostMedia, "kind">[]): string[] {
  const r = NETWORK_RULES[provider];
  const errors: string[] = [];
  const full = buildCaption(caption, hashtags);
  const tagCount = (full.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
  const videos = media.filter((m) => m.kind === "video").length;
  const images = media.length - videos;

  if (full.length > r.captionMax) errors.push(`${r.label}: legenda passa de ${r.captionMax.toLocaleString("pt-BR")} caracteres.`);
  if (r.hashtagMax !== null && tagCount > r.hashtagMax) errors.push(`${r.label}: no máximo ${r.hashtagMax} hashtags.`);
  if (r.requiresMedia && media.length === 0) errors.push(`${r.label}: precisa de ${r.videoOnly ? "um vídeo" : "pelo menos uma foto ou vídeo"}.`);
  if (r.videoOnly && images > 0) errors.push(`${r.label}: aceita só vídeo.`);
  if (media.length > r.maxItems) errors.push(`${r.label}: no máximo ${r.maxItems} arquivo(s).`);
  if (!r.allowMixed && images > 0 && videos > 0) errors.push(`${r.label}: não mistura fotos e vídeo na mesma publicação.`);
  if (videos > r.maxVideos) errors.push(`${r.label}: no máximo ${r.maxVideos} vídeo(s).`);
  if (provider === "facebook" && media.length === 0 && !full) errors.push("Facebook: escreva um texto ou adicione mídia.");
  return errors;
}
