"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Camera, Globe, Music2, Unplug } from "lucide-react";
import { disconnectSocial, socialAuthUrl } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

interface Account {
  id: string;
  provider: "instagram" | "facebook" | "tiktok";
  name: string;
  avatar_url: string | null;
  status: string;
  status_detail: string | null;
  created_at: string;
}

const ICON = { instagram: Camera, facebook: Globe, tiktok: Music2 };
const LABEL = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" };

export function SocialAccounts({ accounts, configured }: { accounts: Account[]; configured: { meta: boolean; tiktok: boolean } }) {
  const params = useSearchParams();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => {
    const st = params.get("social");
    const msg = params.get("msg");
    if (!st || !msg) return;
    if (st === "ok") toast.success(msg);
    else toast.error(msg);
    router.replace("/canais", { scroll: false });
  }, [params, router]);

  function connect(provider: "meta" | "tiktok") {
    start(async () => {
      const r = await socialAuthUrl(provider);
      if (r.ok) window.location.href = r.url;
      else toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader
        title="Redes sociais"
        description="Contas usadas em Publicações. O login é feito na própria rede: o WebAgent não vê sua senha."
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" loading={pending} disabled={!configured.meta} onClick={() => connect("meta")}>
              <Camera className="size-4" /> Instagram e Facebook
            </Button>
            <Button size="sm" variant="secondary" loading={pending} disabled={!configured.tiktok} onClick={() => connect("tiktok")}>
              <Music2 className="size-4" /> TikTok
            </Button>
          </div>
        }
      />
      {(!configured.meta || !configured.tiktok) && (
        <p className="border-b border-line bg-gold/5 px-5 py-3 text-xs text-muted">
          {!configured.meta && "Para conectar Instagram e Facebook, o servidor precisa do app da Meta (META_APP_ID e META_APP_SECRET). "}
          {!configured.tiktok && "Para o TikTok, do app do TikTok (TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET). "}
          Veja o passo a passo em docs/REDES-SOCIAIS.md.
        </p>
      )}
      <ul className="divide-y divide-line">
        {accounts.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">Nenhuma rede conectada.</li>}
        {accounts.map((a) => {
          const Icon = ICON[a.provider];
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              {a.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.avatar_url} alt="" className="size-9 rounded-full object-cover" />
              ) : (
                <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-primary">
                  <Icon className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{a.name}</p>
                <p className="text-xs text-muted">
                  {LABEL[a.provider]} · conectado {timeAgo(a.created_at)}
                </p>
                {a.status !== "active" && a.status_detail && <p className="truncate text-xs text-danger">{a.status_detail}</p>}
              </div>
              <Badge tone={a.status === "active" ? "success" : "danger"}>{a.status === "active" ? "Ativa" : "Reconectar"}</Badge>
              {confirm === a.id ? (
                <span className="flex gap-2">
                  <Button size="sm" variant="danger" loading={pending} onClick={() => start(async () => {
                    const r = await disconnectSocial(a.id);
                    if (!r.ok) toast.error(r.error);
                    setConfirm(null);
                  })}>Desconectar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Button>
                </span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirm(a.id)} aria-label={`Desconectar ${a.name}`}>
                  <Unplug className="size-4" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
