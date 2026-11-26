"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pause, Play, Trash2, X } from "lucide-react";
import { campaignAction, deleteCampaign } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";

export function CampaignControls({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<null | "cancel" | "delete">(null);
  const router = useRouter();

  function run(action: "start" | "pause" | "resume" | "cancel", msg: string) {
    start(async () => {
      const r = await campaignAction(id, action);
      if (r.ok) {
        toast.success(msg);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  if (confirm) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-danger">{confirm === "cancel" ? "Cancelar o envio para quem falta?" : "Excluir esta campanha?"}</span>
        <Button
          size="sm"
          variant="danger"
          loading={pending}
          onClick={() => {
            if (confirm === "cancel") run("cancel", "Campanha cancelada.");
            else
              start(async () => {
                const r = await deleteCampaign(id);
                if (r.ok) router.push("/campanhas");
                else toast.error(r.error);
              });
            setConfirm(null);
          }}
        >
          Confirmar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Voltar</Button>
      </span>
    );
  }

  return (
    <span className="flex flex-wrap gap-2">
      {status === "draft" && (
        <Button size="sm" loading={pending} onClick={() => run("start", "Campanha iniciada.")}>
          <Play className="size-4" /> Iniciar
        </Button>
      )}
      {(status === "running" || status === "scheduled") && (
        <Button size="sm" variant="secondary" loading={pending} onClick={() => run("pause", "Campanha pausada.")}>
          <Pause className="size-4" /> Pausar
        </Button>
      )}
      {status === "paused" && (
        <Button size="sm" loading={pending} onClick={() => run("resume", "Campanha retomada.")}>
          <Play className="size-4" /> Retomar
        </Button>
      )}
      {["running", "scheduled", "paused"].includes(status) && (
        <Button size="sm" variant="ghost" onClick={() => setConfirm("cancel")}>
          <X className="size-4" /> Cancelar
        </Button>
      )}
      {["draft", "completed", "canceled"].includes(status) && (
        <Button size="sm" variant="ghost" onClick={() => setConfirm("delete")}>
          <Trash2 className="size-4" /> Excluir
        </Button>
      )}
    </span>
  );
}

/** Atualiza a página a cada 10 s enquanto a campanha está rodando. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
