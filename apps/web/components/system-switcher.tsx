"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { setActiveSystem } from "@/app/actions/system";
import { cn } from "@/lib/utils";

export interface SwitcherSystem {
  id: string;
  name: string;
  color: string;
}

/** Troca o sistema ativo (Bookweb, Promoforia...). Todas as abas passam a mostrar os dados dele. */
export function SystemSwitcher({ systems, activeId }: { systems: SwitcherSystem[]; activeId: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const active = systems.find((s) => s.id === activeId);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (systems.length === 0) {
    return <p className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50">Nenhum sistema liberado</p>;
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border border-sidebar-line bg-white/[0.03] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]",
          pending && "opacity-60",
        )}
      >
        <span className="size-7 shrink-0 rounded-lg" style={{ background: active?.color ?? "#2bd14a" }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{active?.name ?? "Selecione"}</span>
          <span className="block text-[11px] text-white/45">Sistema ativo</span>
        </span>
        <ChevronsUpDown className="size-4 text-white/45" aria-hidden />
      </button>
      {open && (
        <ul role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-sidebar-line bg-[#111613] p-1 shadow-xl">
          {systems.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                aria-selected={s.id === activeId}
                onClick={() => {
                  setOpen(false);
                  if (s.id !== activeId) start(() => setActiveSystem(s.id));
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-white/85 hover:bg-white/5"
              >
                <span className="size-3 rounded" style={{ background: s.color }} aria-hidden />
                <span className="flex-1 truncate">{s.name}</span>
                {s.id === activeId && <Check className="size-4 text-neon" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
