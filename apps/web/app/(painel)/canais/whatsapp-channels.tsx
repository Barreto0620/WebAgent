"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, LogOut, MessageCircle, QrCode, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import { maskPhone } from "@webagent/shared";
import { channelStatus, connectChannel, createChannel, deleteChannel, logoutChannel } from "@/app/actions/channels";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/input";
import { timeAgo } from "@/lib/utils";

interface Channel {
  id: string;
  name: string;
  status: "connected" | "connecting" | "disconnected" | "error";
  phone: string | null;
  profile_name: string | null;
  profile_picture_url: string | null;
  connected_at: string | null;
  last_status_at: string | null;
}

const STATUS = {
  connected: { tone: "success" as const, label: "Conectado" },
  connecting: { tone: "warning" as const, label: "Aguardando leitura" },
  disconnected: { tone: "danger" as const, label: "Desconectado" },
  error: { tone: "danger" as const, label: "Erro" },
};

export function WhatsAppChannels({ systemId, systemName, channels }: { systemId: string; systemName: string; channels: Channel[] }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(`WhatsApp ${systemName}`);

  if (channels.length === 0) {
    return (
      <Card>
        <CardHeader title="WhatsApp" description="Use um número exclusivo para o atendimento. Ele não pode estar conectado em outro sistema." />
        <form
          className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createChannel(systemId, name);
              if (r.ok) toast.success("Canal criado. Agora conecte o número.");
              else toast.error(r.error);
            });
          }}
        >
          <div className="flex-1">
            <Field label="Nome do canal" htmlFor="ch-name" hint="Aparece só para a equipe.">
              <Input id="ch-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} />
            </Field>
          </div>
          <Button type="submit" loading={pending}>
            <MessageCircle className="size-4" /> Criar canal WhatsApp
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {channels.map((c) => (
        <ChannelCard key={c.id} channel={c} />
      ))}
    </div>
  );
}

function ChannelCard({ channel }: { channel: Channel }) {
  const router = useRouter();
  const [status, setStatus] = useState(channel.status);
  const [mode, setMode] = useState<"qr" | "code" | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const refresh = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimers = useCallback(() => {
    if (poll.current) clearInterval(poll.current);
    if (refresh.current) clearInterval(refresh.current);
    poll.current = refresh.current = null;
  }, []);
  useEffect(() => stopTimers, [stopTimers]);

  const startPolling = useCallback(() => {
    if (poll.current) return;
    poll.current = setInterval(async () => {
      const r = await channelStatus(channel.id);
      if (r.ok && r.data.status === "connected") {
        stopTimers();
        setStatus("connected");
        setMode(null);
        setQr(null);
        setCode(null);
        toast.success("WhatsApp conectado!");
        router.refresh();
      }
    }, 3000);
  }, [channel.id, router, stopTimers]);

  async function requestQr() {
    setBusy(true);
    const r = await connectChannel(channel.id);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    if (!r.data.qrBase64) return toast.error("A Evolution não devolveu o QR Code. Tente de novo.");
    setQr(r.data.qrBase64);
    setStatus("connecting");
    startPolling();
    // O QR do WhatsApp expira em ~40 s: renova automaticamente
    if (refresh.current) clearInterval(refresh.current);
    refresh.current = setInterval(async () => {
      const again = await connectChannel(channel.id);
      if (again.ok && again.data.qrBase64) setQr(again.data.qrBase64);
    }, 40_000);
  }

  async function requestCode() {
    if (phone.replace(/\D/g, "").length < 10) return toast.error("Informe o número com DDD.");
    setBusy(true);
    const r = await connectChannel(channel.id, phone);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    if (!r.data.pairingCode) return toast.error("Não foi possível gerar o código. Use o QR Code.");
    setCode(r.data.pairingCode);
    setStatus("connecting");
    startPolling();
  }

  async function logout() {
    setBusy(true);
    const r = await logoutChannel(channel.id);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setStatus("disconnected");
    toast.success("Número desconectado.");
  }

  async function remove() {
    setBusy(true);
    const r = await deleteChannel(channel.id);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Canal removido.");
  }

  const st = STATUS[status];
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4">
        {channel.profile_picture_url && status === "connected" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.profile_picture_url} alt="" className="size-11 rounded-full object-cover" />
        ) : (
          <span className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
            <MessageCircle className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{channel.name}</p>
          <p className="truncate text-[13px] text-muted">
            {channel.phone ? maskPhone(channel.phone) : "Número ainda não conectado"}
            {channel.profile_name ? ` · ${channel.profile_name}` : ""}
          </p>
        </div>
        <Badge tone={st.tone === "success" ? "success" : st.tone === "warning" ? "warning" : "danger"}>
          <StatusDot tone={st.tone} pulse={status === "connecting"} /> {st.label}
        </Badge>
      </div>

      {status === "connected" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="flex items-center gap-2 text-sm text-muted">
            <CheckCircle2 className="size-4 text-primary" /> Recebendo e enviando mensagens
            {channel.connected_at ? ` · conectado ${timeAgo(channel.connected_at)}` : ""}
          </p>
          <Button variant="secondary" size="sm" onClick={logout} loading={busy}>
            <LogOut className="size-4" /> Desconectar
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 p-5 md:grid-cols-[1fr_280px]">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1" role="tablist" aria-label="Forma de conexão">
              {[
                { id: "qr" as const, label: "QR Code", icon: QrCode },
                { id: "code" as const, label: "Código de pareamento", icon: KeyRound },
              ].map((t) => {
                const Icon = t.icon;
                const selected = (mode ?? "qr") === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setMode(t.id)}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold ${selected ? "bg-surface text-fg shadow-sm" : "text-muted"}`}
                  >
                    <Icon className="size-4" /> {t.label}
                  </button>
                );
              })}
            </div>

            {(mode ?? "qr") === "qr" ? (
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-muted marker:text-primary">
                <li>No celular do número novo, abra o WhatsApp (de preferência o WhatsApp Business).</li>
                <li>Toque em <b className="text-fg">Mais opções ⋮</b> ou <b className="text-fg">Configurações</b> → <b className="text-fg">Dispositivos conectados</b>.</li>
                <li>Toque em <b className="text-fg">Conectar dispositivo</b> e aponte a câmera para o QR Code.</li>
              </ol>
            ) : (
              <div className="flex flex-col gap-3">
                <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-muted marker:text-primary">
                  <li>Informe o número abaixo e gere o código.</li>
                  <li>No WhatsApp: <b className="text-fg">Dispositivos conectados</b> → <b className="text-fg">Conectar dispositivo</b> → <b className="text-fg">Conectar com número de telefone</b>.</li>
                  <li>Digite o código de 8 caracteres que aparecer aqui.</li>
                </ol>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Field label="Número com DDD" htmlFor={`phone-${channel.id}`}>
                      <Input id={`phone-${channel.id}`} inputMode="tel" placeholder="(11) 99876-4321" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </Field>
                  </div>
                  <Button onClick={requestCode} loading={busy}>
                    <Smartphone className="size-4" /> Gerar código
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              {confirmRemove ? (
                <>
                  <span className="self-center text-sm text-danger">Remover este canal? O histórico de conversas também será apagado.</span>
                  <Button variant="danger" size="sm" onClick={remove} loading={busy}>Sim, remover</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>Cancelar</Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)}>
                  <Trash2 className="size-4" /> Remover canal
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-bg p-4 text-center">
            {(mode ?? "qr") === "qr" ? (
              qr ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`} alt="QR Code para conectar o WhatsApp" className="size-56 rounded-lg bg-white p-2" />
                  <p className="text-xs text-muted">O código renova sozinho a cada 40 segundos.</p>
                </>
              ) : (
                <>
                  <QrCode className="size-10 text-muted" aria-hidden />
                  <Button onClick={requestQr} loading={busy}>Gerar QR Code</Button>
                </>
              )
            ) : code ? (
              <>
                <p className="text-xs text-muted">Seu código</p>
                <p className="font-display text-3xl font-extrabold tracking-[0.2em] text-primary tabular">
                  {code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code}
                </p>
                <Button variant="ghost" size="sm" onClick={requestCode} loading={busy}>
                  <RefreshCw className="size-4" /> Gerar outro
                </Button>
              </>
            ) : (
              <>
                <KeyRound className="size-10 text-muted" aria-hidden />
                <p className="text-xs text-muted">O código aparece aqui.</p>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
