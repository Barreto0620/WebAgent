"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Globe, ImagePlus, Loader2, Music2, Trash2, TriangleAlert, X } from "lucide-react";
import { buildCaption, NETWORK_RULES, normalizeHashtag, validateForNetwork, type PostMedia, type SocialProvider } from "@webagent/shared";
import { getBrowserClient } from "@/lib/supabase/client";
import { saveDraft, schedulePost } from "@/app/actions/posts";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ComposerAccount {
  id: string;
  provider: SocialProvider;
  name: string;
  avatar_url: string | null;
  status: string;
}

const ICON = { instagram: Camera, facebook: Globe, tiktok: Music2 };
// Limite de upload do Supabase no plano gratuito (por arquivo)
const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];

interface LocalMedia extends PostMedia {
  preview?: string;
}

export function Composer({
  systemId,
  postId,
  initial,
  accounts,
}: {
  systemId: string;
  postId: string;
  initial: { caption: string; hashtags: string[]; media: PostMedia[]; accountIds: string[] };
  accounts: ComposerAccount[];
}) {
  const supabase = getBrowserClient();
  const router = useRouter();
  const [caption, setCaption] = useState(initial.caption);
  const [hashtags, setHashtags] = useState<string[]>(initial.hashtags);
  const [tagInput, setTagInput] = useState("");
  const [media, setMedia] = useState<LocalMedia[]>(initial.media);
  const [uploading, setUploading] = useState(0);
  const [selected, setSelected] = useState<string[]>(initial.accountIds);
  const [when, setWhen] = useState<"now" | "later">("later");
  const [scheduledAt, setScheduledAt] = useState("");
  const [drag, setDrag] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const providers = useMemo(() => [...new Set(accounts.filter((a) => selected.includes(a.id)).map((a) => a.provider))], [accounts, selected]);
  const errors = useMemo(() => providers.flatMap((p) => validateForNetwork(p, caption, hashtags, media)), [providers, caption, hashtags, media]);
  const full = buildCaption(caption, hashtags);
  const tightest = providers.length ? Math.min(...providers.map((p) => NETWORK_RULES[p].captionMax)) : 2200;

  function addTags(raw: string) {
    const parts = raw.split(/[\s,]+/).map(normalizeHashtag).filter(Boolean);
    if (parts.length) setHashtags((h) => [...new Set([...h, ...parts])].slice(0, 60));
    setTagInput("");
  }

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    for (const f of list) {
      if (!ACCEPT.includes(f.type)) {
        toast.error(`${f.name}: use JPG, PNG, WEBP, MP4 ou MOV.`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}: passa de 50 MB. Comprima o vídeo e tente de novo.`);
        continue;
      }
      if (media.length + 1 > 10) {
        toast.error("No máximo 10 arquivos por publicação.");
        break;
      }
      setUploading((n) => n + 1);
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${systemId}/${postId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("social").upload(path, f, { contentType: f.type, upsert: false });
      setUploading((n) => n - 1);
      if (error) {
        toast.error(`${f.name}: não foi possível enviar (${error.message}).`);
        continue;
      }
      setMedia((m) => [...m, { path, mime: f.type, kind: f.type.startsWith("video") ? "video" : "image", size: f.size, preview: URL.createObjectURL(f) }]);
    }
  }

  async function removeMedia(path: string) {
    setMedia((m) => m.filter((x) => x.path !== path));
    await supabase.storage.from("social").remove([path]);
  }

  function move(i: number, dir: -1 | 1) {
    setMedia((m) => {
      const n = [...m];
      const j = i + dir;
      if (j < 0 || j >= n.length) return m;
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });
  }

  function payload() {
    return { id: postId, caption, hashtags, media: media.map(({ preview: _p, ...rest }) => rest), accountIds: selected };
  }

  function save(thenSchedule: boolean) {
    start(async () => {
      const r = await saveDraft(payload());
      if (!r.ok) return void toast.error(r.error);
      if (!thenSchedule) {
        toast.success("Rascunho salvo.");
        router.push(`/publicacoes/${postId}`);
        return;
      }
      const at = when === "later" ? new Date(scheduledAt).toISOString() : null;
      const s = await schedulePost(postId, at);
      if (!s.ok) {
        toast.error(s.error);
        router.push(`/publicacoes/${postId}`);
        return;
      }
      toast.success(when === "now" ? "Publicando agora." : "Publicação agendada.");
      router.push(`/publicacoes/${postId}`);
    });
  }

  const canSchedule = selected.length > 0 && errors.length === 0 && uploading === 0 && (when === "now" || Boolean(scheduledAt));

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Mídia" description="Até 10 fotos ou vídeos, 50 MB cada. A ordem aqui é a ordem do carrossel." />
          <div className="p-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                void upload(e.dataTransfer.files);
              }}
              className={cn("flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted transition-colors", drag ? "border-primary bg-primary/5" : "border-line")}
            >
              <ImagePlus className="size-7" aria-hidden />
              <p>Arraste arquivos aqui ou</p>
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                Escolher arquivos
              </Button>
              <input ref={fileRef} type="file" multiple accept={ACCEPT.join(",")} className="hidden" onChange={(e) => e.target.files && void upload(e.target.files)} />
              {uploading > 0 && (
                <p className="flex items-center gap-2 text-primary">
                  <Loader2 className="size-4 animate-spin" /> Enviando {uploading} arquivo(s)…
                </p>
              )}
            </div>
            {media.length > 0 && (
              <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {media.map((m, i) => (
                  <li key={m.path} className="group relative aspect-square overflow-hidden rounded-lg bg-surface-2">
                    <MediaThumb m={m} />
                    <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 text-[10px] font-bold text-white">{i + 1}</span>
                    <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="grid size-7 place-items-center rounded text-white disabled:opacity-30" aria-label="Mover para a esquerda">
                        <ArrowLeft className="size-4" />
                      </button>
                      <button onClick={() => void removeMedia(m.path)} className="grid size-7 place-items-center rounded text-white hover:text-danger" aria-label="Remover arquivo">
                        <Trash2 className="size-4" />
                      </button>
                      <button onClick={() => move(i, 1)} disabled={i === media.length - 1} className="grid size-7 place-items-center rounded text-white disabled:opacity-30" aria-label="Mover para a direita">
                        <ArrowRight className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Legenda e hashtags" />
          <div className="flex flex-col gap-3 p-5">
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} maxLength={5000} placeholder="Escreva a legenda…" aria-label="Legenda" />
            <div className="flex flex-wrap gap-1.5">
              {hashtags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-md bg-primary/12 px-2 py-0.5 text-xs text-primary">
                  #{t}
                  <button onClick={() => setHashtags((h) => h.filter((x) => x !== t))} aria-label={`Remover #${t}`}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "," || e.key === " ") {
                  e.preventDefault();
                  addTags(tagInput);
                }
              }}
              onBlur={() => tagInput && addTags(tagInput)}
              placeholder="Adicionar hashtags (Enter ou espaço)"
              aria-label="Hashtags"
            />
            <p className={cn("text-right text-xs tabular", full.length > tightest ? "text-danger" : "text-muted")}>
              {full.length.toLocaleString("pt-BR")} / {tightest.toLocaleString("pt-BR")} caracteres · {hashtags.length} hashtags
            </p>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-4 xl:sticky xl:top-20">
        <Card>
          <CardHeader title="Onde publicar" />
          <ul className="divide-y divide-line">
            {accounts.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">Conecte redes em Canais.</li>}
            {accounts.map((a) => {
              const Icon = ICON[a.provider];
              const on = selected.includes(a.id);
              const issues = on ? validateForNetwork(a.provider, caption, hashtags, media) : [];
              return (
                <li key={a.id}>
                  <label className={cn("flex cursor-pointer items-center gap-3 px-5 py-3", a.status !== "active" && "cursor-not-allowed opacity-60")}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={a.status !== "active"}
                      onChange={() => setSelected((s) => (on ? s.filter((x) => x !== a.id) : [...s, a.id]))}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <Icon className="size-4 text-muted" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{a.name}</span>
                      <span className="block text-xs text-muted">
                        {NETWORK_RULES[a.provider].label}
                        {a.provider === "tiktok" && " · só vídeo"}
                        {a.status !== "active" && " · reconectar em Canais"}
                      </span>
                    </span>
                    {on && (issues.length ? <TriangleAlert className="size-4 text-gold" aria-label="Ajustes necessários" /> : <CheckCircle2 className="size-4 text-primary" aria-label="Pronto" />)}
                  </label>
                </li>
              );
            })}
          </ul>
          {errors.length > 0 && (
            <ul className="space-y-1 border-t border-line bg-gold/5 px-5 py-3 text-xs text-gold">
              {[...new Set(errors)].map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex flex-col gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="when" checked={when === "later"} onChange={() => setWhen("later")} className="accent-[var(--primary)]" /> Agendar para
            </label>
            {when === "later" && <Input type="datetime-local" aria-label="Data e hora da publicação" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />}
            <label className="flex items-center gap-2">
              <input type="radio" name="when" checked={when === "now"} onChange={() => setWhen("now")} className="accent-[var(--primary)]" /> Publicar agora
            </label>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" loading={pending} disabled={uploading > 0} onClick={() => save(false)}>
              Salvar rascunho
            </Button>
            <Button loading={pending} disabled={!canSchedule} onClick={() => save(true)}>
              {when === "now" ? "Publicar agora" : "Agendar"}
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-2.5 text-xs font-semibold text-muted">Prévia da legenda</div>
          <p className="max-h-60 overflow-y-auto px-4 py-3 text-[13px] whitespace-pre-wrap">
            {full || <span className="text-muted">Sem legenda</span>}
          </p>
        </Card>
      </div>
    </div>
  );
}

function MediaThumb({ m }: { m: LocalMedia }) {
  const supabase = getBrowserClient();
  const [url, setUrl] = useState<string | null>(m.preview ?? null);
  useEffect(() => {
    if (url) return;
    let alive = true;
    supabase.storage
      .from("social")
      .createSignedUrl(m.path, 3600)
      .then(({ data }) => alive && data && setUrl(data.signedUrl));
    return () => {
      alive = false;
    };
  }, [supabase, m.path, url]);
  if (!url) return <div className="size-full animate-pulse" />;
  return m.kind === "video" ? (
    <video src={url} className="size-full object-cover" muted playsInline preload="metadata" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="size-full object-cover" />
  );
}
