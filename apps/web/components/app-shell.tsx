"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutDashboard, MessagesSquare, Users, Boxes, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import type { SwitcherSystem } from "./system-switcher";
import { UserMenu } from "./user-menu";
import { StatusDot } from "./ui/badge";

export interface ShellStatus {
  channel: "connected" | "connecting" | "disconnected" | "error" | "none";
  open: boolean;
  openLabel: string;
}

const MOBILE = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/atendimento", label: "Conversas", icon: MessagesSquare },
  { href: "/contatos", label: "Contatos", icon: Users },
  { href: "/sistemas", label: "Sistemas", icon: Boxes },
];

export function AppShell({
  children,
  systems,
  activeId,
  role,
  queued,
  status,
  user,
}: {
  children: React.ReactNode;
  systems: SwitcherSystem[];
  activeId: string | null;
  role: string | null;
  queued: number;
  status: ShellStatus;
  user: { name: string; email: string; avatar: string | null; theme: string };
}) {
  const [drawer, setDrawer] = useState(false);
  const path = usePathname();
  useEffect(() => setDrawer(false), [path]);

  const channelPill = {
    connected: { tone: "success" as const, text: "WhatsApp conectado" },
    connecting: { tone: "warning" as const, text: "Conectando WhatsApp" },
    disconnected: { tone: "danger" as const, text: "WhatsApp desconectado" },
    error: { tone: "danger" as const, text: "WhatsApp com erro" },
    none: { tone: "neutral" as const, text: "Nenhum número conectado" },
  }[status.channel];

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-dvh border-r border-sidebar-line lg:block">
        <Sidebar systems={systems} activeId={activeId} role={role} queued={queued} />
      </aside>

      {/* Gaveta no celular */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/60" aria-label="Fechar menu" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[84%] max-w-[300px] pt-[env(safe-area-inset-top)] shadow-2xl">
            <Sidebar systems={systems} activeId={activeId} role={role} queued={queued} onNavigate={() => setDrawer(false)} />
            <button className="absolute top-3 right-3 grid size-9 place-items-center rounded-lg text-white/70" onClick={() => setDrawer(false)} aria-label="Fechar menu">
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button className="grid size-9 place-items-center rounded-lg hover:bg-surface-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Abrir menu">
              <Menu className="size-5" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
              <span className="hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs sm:inline-flex">
                <StatusDot tone={channelPill.tone} pulse={status.channel === "connecting"} />
                {channelPill.text}
              </span>
              <span className="inline-flex items-center gap-2 truncate rounded-full border border-line bg-surface px-3 py-1 text-xs">
                <StatusDot tone={status.open ? "success" : "warning"} />
                <span className="truncate">{status.openLabel}</span>
              </span>
            </div>
            <UserMenu {...user} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-5 pb-28 sm:px-6 lg:pb-10">{children}</main>
      </div>

      {/* Navegação inferior no celular */}
      <nav aria-label="Atalhos" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {MOBILE.map((it) => {
            const active = path === it.href || path.startsWith(`${it.href}/`);
            const Icon = it.icon;
            return (
              <li key={it.href}>
                <Link href={it.href} className={cn("relative flex flex-col items-center gap-0.5 py-2 text-[10.5px]", active ? "font-semibold text-primary" : "text-muted")}>
                  <Icon className="size-5" aria-hidden />
                  {it.label}
                  {it.href === "/atendimento" && queued > 0 && (
                    <span className="absolute top-1 left-1/2 ml-2 rounded-full bg-gold px-1 text-[9px] leading-[14px] font-bold text-black">{queued}</span>
                  )}
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setDrawer(true)} className="flex w-full flex-col items-center gap-0.5 py-2 text-[10.5px] text-muted">
              <MoreHorizontal className="size-5" aria-hidden />
              Mais
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
