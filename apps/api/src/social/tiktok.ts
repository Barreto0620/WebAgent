import { config } from "../config";
import { ProviderError, requestJson, sleep } from "./http";

/**
 * TikTok Content Posting API (envio direto). Apps ainda não auditados pelo TikTok
 * só podem publicar como privado (SELF_ONLY). Docs: developers.tiktok.com/doc/content-posting-api-get-started
 */
const API = "https://open.tiktokapis.com/v2";

export function tiktokConfigured() {
  return Boolean(config.TIKTOK_CLIENT_KEY && config.TIKTOK_CLIENT_SECRET);
}

export function tiktokRedirectUri() {
  return `${config.PUBLIC_APP_URL}/redes/callback/tiktok`;
}

export function tiktokAuthUrl(state: string) {
  const u = new URL("https://www.tiktok.com/v2/auth/authorize/");
  u.searchParams.set("client_key", config.TIKTOK_CLIENT_KEY!);
  u.searchParams.set("scope", "user.info.basic,video.publish");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", tiktokRedirectUri());
  u.searchParams.set("state", state);
  return u.toString();
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_token: string;
  refresh_expires_in: number;
}

async function token(params: Record<string, string>) {
  return requestJson<TokenResponse>(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: config.TIKTOK_CLIENT_KEY!, client_secret: config.TIKTOK_CLIENT_SECRET!, ...params }),
  });
}

export async function tiktokExchange(code: string) {
  const t = await token({ code, grant_type: "authorization_code", redirect_uri: tiktokRedirectUri() });
  const info = await requestJson<{ data: { user: { open_id: string; display_name?: string; avatar_url?: string } } }>(
    `${API}/user/info/?fields=open_id,display_name,avatar_url`,
    { headers: { Authorization: `Bearer ${t.access_token}` } },
  );
  return { token: t, user: info.data.user };
}

export async function tiktokRefresh(refreshToken: string) {
  return token({ grant_type: "refresh_token", refresh_token: refreshToken });
}

function auth(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" };
}

export async function publishTikTok(accessToken: string, caption: string, video: Buffer) {
  const creator = await requestJson<{ data: { privacy_level_options: string[] } }>(`${API}/post/publish/creator_info/query/`, {
    method: "POST",
    headers: auth(accessToken),
  });
  const options = creator.data.privacy_level_options ?? [];
  const privacy = options.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : (options[0] ?? "SELF_ONLY");

  // Regras de upload em partes: cada parte entre 5 MB e 64 MB; a última pode ser maior
  const size = video.byteLength;
  const MB = 1024 * 1024;
  const chunkSize = size <= 64 * MB ? size : 10 * MB;
  const chunks = size <= 64 * MB ? 1 : Math.floor(size / chunkSize);

  const init = await requestJson<{ data: { publish_id: string; upload_url: string } }>(`${API}/post/publish/video/init/`, {
    method: "POST",
    headers: auth(accessToken),
    body: JSON.stringify({
      post_info: { title: caption.slice(0, 2200), privacy_level: privacy, disable_comment: false, disable_duet: false, disable_stitch: false },
      source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunkSize, total_chunk_count: chunks },
    }),
  });

  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = i === chunks - 1 ? size - 1 : start + chunkSize - 1;
    const part = video.subarray(start, end + 1);
    const res = await fetch(init.data.upload_url, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4", "Content-Length": String(part.byteLength), "Content-Range": `bytes ${start}-${end}/${size}` },
      body: part,
      signal: AbortSignal.timeout(300_000),
    });
    if (!res.ok) throw new ProviderError(`TikTok recusou o envio do vídeo (${res.status}).`);
  }

  for (let i = 0; i < 60; i++) {
    const st = await requestJson<{ data: { status: string; fail_reason?: string; publicaly_available_post_id?: string[] } }>(`${API}/post/publish/status/fetch/`, {
      method: "POST",
      headers: auth(accessToken),
      body: JSON.stringify({ publish_id: init.data.publish_id }),
    });
    if (st.data.status === "PUBLISH_COMPLETE") {
      const postId = st.data.publicaly_available_post_id?.[0];
      return { externalId: postId ?? init.data.publish_id, permalink: null, privacy };
    }
    if (st.data.status === "FAILED") throw new ProviderError(`TikTok: ${st.data.fail_reason ?? "falha ao publicar"}`);
    await sleep(5_000);
  }
  // Ainda processando: o TikTok conclui sozinho
  return { externalId: init.data.publish_id, permalink: null, privacy };
}
