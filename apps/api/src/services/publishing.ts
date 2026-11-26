import { buildCaption, validateForNetwork, type PostMedia, type SocialProvider } from "@webagent/shared";
import { db } from "../lib/supabase";
import { publishFacebook, publishInstagram } from "../social/meta";
import { publishTikTok, tiktokRefresh } from "../social/tiktok";

interface TargetRow {
  id: string;
  status: string;
  account_id: string;
  social_accounts: { id: string; provider: SocialProvider; external_id: string; name: string; status: string };
}

export async function loadPost(postId: string) {
  const { data: post } = await db.from("posts").select("*").eq("id", postId).maybeSingle();
  if (!post) return null;
  const { data: targets } = await db
    .from("post_targets")
    .select("id, status, account_id, social_accounts!inner(id, provider, external_id, name, status)")
    .eq("post_id", postId);
  return { post, targets: (targets ?? []) as unknown as TargetRow[] };
}

/** Erros que impedem agendar (por rede). */
export function validatePost(post: { caption: string; hashtags: string[]; media: unknown }, targets: TargetRow[]) {
  const media = (post.media as PostMedia[]) ?? [];
  if (!targets.length) return ["Escolha pelo menos uma conta para publicar."];
  return targets.flatMap((t) => validateForNetwork(t.social_accounts.provider, post.caption, post.hashtags, media));
}

async function signedUrls(media: PostMedia[]) {
  const out: { url: string; kind: "image" | "video"; path: string }[] = [];
  for (const m of media) {
    const { data, error } = await db.storage.from("social").createSignedUrl(m.path, 4 * 3600);
    if (error || !data) throw new Error(`Arquivo não encontrado: ${m.path}`);
    out.push({ url: data.signedUrl, kind: m.kind, path: m.path });
  }
  return out;
}

async function tiktokToken(accountId: string) {
  const { data: sec } = await db.from("social_account_secrets").select("*").eq("account_id", accountId).single();
  if (!sec) throw new Error("Conta sem credenciais. Conecte de novo.");
  const { data: acc } = await db.from("social_accounts").select("token_expires_at").eq("id", accountId).single();
  const expires = acc?.token_expires_at ? new Date(acc.token_expires_at).getTime() : 0;
  if (expires - Date.now() > 10 * 60_000) return sec.access_token;
  if (!sec.refresh_token) throw new Error("Login do TikTok expirou. Conecte a conta de novo.");
  const t = await tiktokRefresh(sec.refresh_token);
  await db
    .from("social_account_secrets")
    .update({ access_token: t.access_token, refresh_token: t.refresh_token, refresh_expires_at: new Date(Date.now() + t.refresh_expires_in * 1000).toISOString(), updated_at: new Date().toISOString() })
    .eq("account_id", accountId);
  await db.from("social_accounts").update({ token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(), status: "active" }).eq("id", accountId);
  return t.access_token;
}

/** Publica em todas as contas pendentes/falhas do post. */
export async function publishPost(postId: string) {
  const loaded = await loadPost(postId);
  if (!loaded) return;
  const { post, targets } = loaded;
  if (post.status !== "scheduled" && post.status !== "publishing") return; // cancelada ou já tratada
  await db.from("posts").update({ status: "publishing", error: null }).eq("id", post.id);

  const media = (post.media as unknown as PostMedia[]) ?? [];
  const caption = buildCaption(post.caption, post.hashtags);
  let urls: Awaited<ReturnType<typeof signedUrls>> = [];
  try {
    urls = await signedUrls(media);
  } catch (e) {
    await db.from("posts").update({ status: "failed", error: e instanceof Error ? e.message : "Mídia indisponível" }).eq("id", post.id);
    return;
  }

  for (const t of targets.filter((x) => x.status !== "published")) {
    await db.from("post_targets").update({ status: "publishing", error: null }).eq("id", t.id);
    try {
      const { data: sec } = await db.from("social_account_secrets").select("access_token, extra").eq("account_id", t.account_id).single();
      if (!sec) throw new Error("Conta sem credenciais. Conecte de novo em Canais.");
      const acc = t.social_accounts;
      let result: { externalId: string; permalink: string | null };
      if (acc.provider === "instagram") {
        result = await publishInstagram(acc.external_id, sec.access_token, caption, urls);
      } else if (acc.provider === "facebook") {
        result = await publishFacebook(acc.external_id, sec.access_token, caption, urls);
      } else {
        const token = await tiktokToken(acc.id);
        const { data: file, error } = await db.storage.from("social").download(urls[0]!.path);
        if (error || !file) throw new Error("Vídeo não encontrado no armazenamento.");
        result = await publishTikTok(token, caption, Buffer.from(await file.arrayBuffer()));
      }
      await db
        .from("post_targets")
        .update({ status: "published", external_id: result.externalId, permalink: result.permalink, published_at: new Date().toISOString() })
        .eq("id", t.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 400) : "Falha ao publicar";
      await db.from("post_targets").update({ status: "failed", error: msg }).eq("id", t.id);
      if (/token|session|expired|login|OAuth/i.test(msg)) {
        await db.from("social_accounts").update({ status: "expired", status_detail: msg }).eq("id", t.account_id);
      }
    }
  }

  const { data: final } = await db.from("post_targets").select("status").eq("post_id", post.id);
  const ok = (final ?? []).filter((x) => x.status === "published").length;
  const total = (final ?? []).length;
  await db
    .from("posts")
    .update({ status: ok === total ? "published" : ok > 0 ? "partial" : "failed", published_at: ok > 0 ? new Date().toISOString() : null })
    .eq("id", post.id);
}
