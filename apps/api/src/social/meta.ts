import { config } from "../config";
import { ProviderError, requestJson, sleep } from "./http";

/**
 * Meta Graph API: Página do Facebook + conta profissional do Instagram ligada a ela.
 * Docs: developers.facebook.com/docs/instagram-platform/content-publishing e /docs/pages-api
 */
const G = () => `https://graph.facebook.com/${config.META_GRAPH_VERSION}`;
const GV = () => `https://graph-video.facebook.com/${config.META_GRAPH_VERSION}`;

export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
];

export function metaConfigured() {
  return Boolean(config.META_APP_ID && config.META_APP_SECRET);
}

export function metaRedirectUri() {
  return `${config.PUBLIC_APP_URL}/redes/callback/meta`;
}

export function metaAuthUrl(state: string) {
  const u = new URL(`https://www.facebook.com/${config.META_GRAPH_VERSION}/dialog/oauth`);
  u.searchParams.set("client_id", config.META_APP_ID!);
  u.searchParams.set("redirect_uri", metaRedirectUri());
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", META_SCOPES.join(","));
  return u.toString();
}

export interface MetaAccount {
  provider: "facebook" | "instagram";
  externalId: string;
  name: string;
  username?: string;
  avatar?: string;
  token: string;
  pageId: string;
}

/** Troca o código por token de longa duração e lista Páginas + Instagram vinculados. */
export async function metaExchange(code: string): Promise<MetaAccount[]> {
  const short = await requestJson<{ access_token: string }>(
    `${G()}/oauth/access_token?${new URLSearchParams({ client_id: config.META_APP_ID!, client_secret: config.META_APP_SECRET!, redirect_uri: metaRedirectUri(), code })}`,
  );
  const long = await requestJson<{ access_token: string }>(
    `${G()}/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: config.META_APP_ID!, client_secret: config.META_APP_SECRET!, fb_exchange_token: short.access_token })}`,
  );
  const pages = await requestJson<{
    data: { id: string; name: string; access_token: string; picture?: { data?: { url?: string } }; instagram_business_account?: { id: string; username?: string; profile_picture_url?: string } }[];
  }>(
    `${G()}/me/accounts?${new URLSearchParams({
      fields: "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}",
      limit: "100",
      access_token: long.access_token,
    })}`,
  );
  const out: MetaAccount[] = [];
  for (const p of pages.data) {
    out.push({ provider: "facebook", externalId: p.id, name: p.name, avatar: p.picture?.data?.url, token: p.access_token, pageId: p.id });
    const ig = p.instagram_business_account;
    if (ig) out.push({ provider: "instagram", externalId: ig.id, name: ig.username ? `@${ig.username}` : p.name, username: ig.username, avatar: ig.profile_picture_url, token: p.access_token, pageId: p.id });
  }
  if (!out.length) throw new ProviderError("Nenhuma Página do Facebook encontrada nesta conta. O Instagram precisa ser profissional e estar ligado a uma Página.");
  return out;
}

async function post<T>(url: string, params: Record<string, string>, token: string) {
  return requestJson<T>(url, { method: "POST", body: new URLSearchParams({ ...params, access_token: token }), timeoutMs: 120_000 });
}

async function waitContainer(id: string, token: string) {
  for (let i = 0; i < 60; i++) {
    const r = await requestJson<{ status_code: string; status?: string }>(`${G()}/${id}?fields=status_code,status&access_token=${encodeURIComponent(token)}`);
    if (r.status_code === "FINISHED") return;
    if (r.status_code === "ERROR" || r.status_code === "EXPIRED") throw new ProviderError(`Instagram recusou o vídeo: ${r.status ?? r.status_code}`);
    await sleep(5_000);
  }
  throw new ProviderError("Instagram demorou demais para processar o vídeo.");
}

export async function publishInstagram(igId: string, token: string, caption: string, media: { url: string; kind: "image" | "video" }[]) {
  let creationId: string;
  if (media.length === 1) {
    const m = media[0]!;
    const c = await post<{ id: string }>(
      `${G()}/${igId}/media`,
      m.kind === "image" ? { image_url: m.url, caption } : { media_type: "REELS", video_url: m.url, caption, share_to_feed: "true" },
      token,
    );
    if (m.kind === "video") await waitContainer(c.id, token);
    creationId = c.id;
  } else {
    const children: string[] = [];
    for (const m of media) {
      const c = await post<{ id: string }>(
        `${G()}/${igId}/media`,
        m.kind === "image" ? { image_url: m.url, is_carousel_item: "true" } : { media_type: "VIDEO", video_url: m.url, is_carousel_item: "true" },
        token,
      );
      if (m.kind === "video") await waitContainer(c.id, token);
      children.push(c.id);
    }
    const parent = await post<{ id: string }>(`${G()}/${igId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption }, token);
    await waitContainer(parent.id, token);
    creationId = parent.id;
  }
  const pub = await post<{ id: string }>(`${G()}/${igId}/media_publish`, { creation_id: creationId }, token);
  const info = await requestJson<{ permalink?: string }>(`${G()}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(token)}`).catch(() => ({ permalink: undefined }));
  return { externalId: pub.id, permalink: info.permalink ?? null };
}

export async function publishFacebook(pageId: string, token: string, message: string, media: { url: string; kind: "image" | "video" }[]) {
  if (media.length === 0) {
    const r = await post<{ id: string }>(`${G()}/${pageId}/feed`, { message }, token);
    return { externalId: r.id, permalink: `https://www.facebook.com/${r.id}` };
  }
  if (media[0]!.kind === "video") {
    const r = await post<{ id: string }>(`${GV()}/${pageId}/videos`, { file_url: media[0]!.url, description: message }, token);
    return { externalId: r.id, permalink: `https://www.facebook.com/${pageId}/videos/${r.id}` };
  }
  if (media.length === 1) {
    const r = await post<{ id: string; post_id?: string }>(`${G()}/${pageId}/photos`, { url: media[0]!.url, message }, token);
    const id = r.post_id ?? r.id;
    return { externalId: id, permalink: `https://www.facebook.com/${id}` };
  }
  const ids: string[] = [];
  for (const m of media) {
    const r = await post<{ id: string }>(`${G()}/${pageId}/photos`, { url: m.url, published: "false" }, token);
    ids.push(r.id);
  }
  const params: Record<string, string> = { message };
  ids.forEach((id, i) => (params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
  const r = await post<{ id: string }>(`${G()}/${pageId}/feed`, params, token);
  return { externalId: r.id, permalink: `https://www.facebook.com/${r.id}` };
}
