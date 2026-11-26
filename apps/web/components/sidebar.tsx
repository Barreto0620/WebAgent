"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";
import { SystemSwitcher, type SwitcherSystem } from "./system-switcher";

const RANK: Record<string, number> = { agent: 1, supervisor: 2, admin: 3 };

export function Sidebar({
  systems,
  activeId,
  role,
  queued,
  onNavigate,
}: {
  systems: SwitcherSystem[];
  activeId: string | null;
  role: string | null;
  queued: number;
  onNavigate?: () => void;
}) {
  const path = usePathname();
  return (
    <nav aria-label="Menu principal" className="flex h-full flex-col gap-1 bg-sidebar px-3 pt-4 pb-3 text-sidebar-fg">
      <Link href="/dashboard" className="mb-3 flex items-center gap-2.5 px-2" onClick={onNavigate}>
        <Image src="/logo-webcash.png" alt="" width={32} height={32} className="rounded-full" />
        <span className="font-display text-[17px] font-extrabold text-white">WebAgent</span>
      </Link>

      <SystemSwitcher systems={systems} activeId={activeId} />

      <div className="-mr-1 mt-2 flex-1 overflow-y-auto pr-1">
        {NAV.map((section, i) => (
          <div key={i} className="mb-2">
            {section.group && (
              <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold tracking-[0.14em] text-white/35 uppercase">{section.group}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items
                .filter((it) => !it.min || (RANK[role ?? ""] ?? 0) >= RANK[it.min]!)
                .map((it) => {
                  const active = path === it.href || path.startsWith(`${it.href}/`);
                  const Icon = it.icon;
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors",
                          active ? "bg-neon/12 text-white shadow-[inset_2px_0_0_#2bd14a]" : "hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <Icon className={cn("size-[18px] shrink-0", active ? "text-neon" : "text-white/50 group-hover:text-white/80")} aria-hidden />
                        <span className="flex-1 truncate">{it.label}</span>
                        {it.href === "/atendimento" && queued > 0 && (
                          <span className="rounded-full bg-gold px-1.5 text-[10px] leading-4 font-bold text-black tabular">{queued}</span>
                        )}
                        {it.soon && <span className="text-[10px] text-white/30">em breve</span>}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
