import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { buildCaption, type PostMedia } from "@webagent/shared";
import { canManage, getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Composer } from "../composer";
import { POST_STATUS, type PostStatus } from "../shared";
import { PostActions, PostAutoRefresh, PostMediaGrid } from "./post-actions";

export const metadata: Metadata = { title: "Publicação" };

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const LABEL = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" } as const;

export default async function PublicacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, active, role } = await getSession();
  if (!active) redirect("/sistemas");
  const { data: post } = await supabase.from("posts").select("*").eq("id", id).eq("system_id", active.id).maybeSingle();
  if (!post) notFound();
  const manage = canManage(role, "supervisor");

  const [{ data: targets }, { data: accounts }] = await Promise.all([
    supabase.from("post_targets").select("id, status, error, permalink, published_at, account_id, social_accounts!inner(name, provider)").eq("post_id", post.id),
    supabase.from("social_accounts").select("id, provider, name, avatar_url, status").eq("system_id", active.id).order("provider"),
  ]);

  const st = POST_STATUS[post.status as PostStatus];
  const media = (post.media as unknown as PostMedia[]) ?? [];

  if (post.status === "draft" && manage) {
    return (
      <div className="flex flex-col gap-6">
        <Link href="/publicacoes" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Publicações
        </Link>
        <PageHeader eyebrow={active.name} title="Editar rascunho" action={<PostActions id={post.id} status={post.status} />} />
        <Composer
          systemId={active.id}
          postId={post.id}
          initial={{ caption: post.caption, hashtags: post.hashtags, media, accountIds: (targets ?? []).map((t) => t.account_id) }}
          accounts={accounts ?? []}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {post.status === "publishing" && <PostAutoRefresh />}
      <Link href="/publicacoes" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Publicações
      </Link>
      <PageHeader
        eyebrow={active.name}
        title="Publicação"
        description={post.scheduled_at ? `${post.status === "scheduled" ? "Agendada para" : "Programada para"} ${dt.format(new Date(post.scheduled_at))}` : undefined}
        action={manage ? <PostActions id={post.id} status={post.status} /> : undefined}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Conteúdo" action={<Badge tone={st.tone}>{st.label}</Badge>} />
          <div className="flex flex-col gap-4 p-5">
            <PostMediaGrid media={media} />
            <p className="text-sm whitespace-pre-wrap">{buildCaption(post.caption, post.hashtags) || <span className="text-muted">Sem legenda</span>}</p>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="Por rede" />
          <ul className="divide-y divide-line">
            {(targets ?? []).map((t) => {
              const acc = t.social_accounts as unknown as { name: string; provider: keyof typeof LABEL };
              const tone = t.status === "published" ? "success" : t.status === "failed" ? "danger" : t.status === "publishing" ? "warning" : "neutral";
              const label = { published: "Publicado", failed: "Falhou", publishing: "Publicando", pending: "Aguardando" }[t.status];
              return (
                <li key={t.id} className="flex flex-col gap-1 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {acc.name} <span className="font-normal text-muted">· {LABEL[acc.provider]}</span>
                    </span>
                    <Badge tone={tone}>{label}</Badge>
                  </div>
                  {t.permalink && (
                    <a href={t.permalink} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline">
                      Ver publicação <ExternalLink className="size-3" />
                    </a>
                  )}
                  {t.error && <p className="text-xs text-danger">{t.error}</p>}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
