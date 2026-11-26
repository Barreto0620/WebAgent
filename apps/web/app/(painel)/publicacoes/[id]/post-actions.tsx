"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Trash2, X } from "lucide-react";
import type { PostMedia } from "@webagent/shared";
import { getBrowserClient } from "@/lib/supabase/client";
import { cancelPost, deletePost, retryPost } from "@/app/actions/posts";
import { Button } from "@/components/ui/button";

export function PostActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, after?: () => void) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(msg);
        after ? after() : router.refresh();
      } else toast.error(r.error);
    });
  }

  if (confirm)
    return (
      <span className="flex items-center gap-2">
        <span className="text-sm text-danger">Excluir publicação e arquivos?</span>
        <Button size="sm" variant="danger" loading={pending} onClick={() => run(() => deletePost(id), "Publicação excluída.", () => router.push("/publicacoes"))}>
          Excluir
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Voltar</Button>
      </span>
    );

  return (
    <span className="flex flex-wrap gap-2">
      {status === "scheduled" && (
        <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => cancelPost(id), "Agendamento cancelado. Voltou para rascunho.")}>
          <X className="size-4" /> Cancelar agendamento
        </Button>
      )}
      {(status === "failed" || status === "partial") && (
        <Button size="sm" loading={pending} onClick={() => run(() => retryPost(id), "Tentando publicar de novo.")}>
          <RotateCcw className="size-4" /> Tentar de novo
        </Button>
      )}
      {["draft", "failed", "partial", "published", "canceled"].includes(status) && (
        <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
          <Trash2 className="size-4" /> Excluir
        </Button>
      )}
    </span>
  );
}

export function PostAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}

export function PostMediaGrid({ media }: { media: PostMedia[] }) {
  const supabase = getBrowserClient();
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    Promise.all(media.map((m) => supabase.storage.from("social").createSignedUrl(m.path, 3600).then(({ data }) => [m.path, data?.signedUrl ?? ""] as const))).then(
      (pairs) => alive && setUrls(Object.fromEntries(pairs)),
    );
    return () => {
      alive = false;
    };
  }, [supabase, media]);
  if (!media.length) return null;
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {media.map((m) => (
        <li key={m.path} className="aspect-square overflow-hidden rounded-lg bg-surface-2">
          {urls[m.path] &&
            (m.kind === "video" ? (
              <video src={urls[m.path]} className="size-full object-cover" controls preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[m.path]} alt="" className="size-full object-cover" />
            ))}
        </li>
      ))}
    </ul>
  );
}
