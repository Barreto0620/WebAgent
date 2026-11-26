"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { LogOut, Moon, Settings, Sun } from "lucide-react";
import { initials } from "@/lib/utils";
import { setTheme } from "@/app/actions/profile";

export function UserMenu({ name, email, avatar, theme }: { name: string; email: string; avatar: string | null; theme: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(theme === "light" ? "light" : "dark");
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function toggleTheme() {
    const next = current === "dark" ? "light" : "dark";
    setCurrent(next);
    document.documentElement.dataset.theme = next;
    start(() => setTheme(next));
  }

  return (
    <div ref={ref} className="relative flex items-center gap-1">
      <button onClick={toggleTheme} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-label={current === "dark" ? "Usar tema claro" : "Usar tema escuro"}>
        {current === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
      </button>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-full p-0.5 hover:bg-surface-2" aria-label="Menu da conta">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="size-8 rounded-full object-cover" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{initials(name)}</span>
        )}
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <Link role="menuitem" href="/configuracoes" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface-2">
            <Settings className="size-4 text-muted" /> Configurações
          </Link>
          <form action="/auth/sair" method="post">
            <button role="menuitem" type="submit" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-danger hover:bg-surface-2">
              <LogOut className="size-4" /> Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
