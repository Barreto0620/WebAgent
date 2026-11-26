import Link from "next/link";
import { FileSpreadsheet, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function SourceTabs({ current }: { current: "leads" | "optin" }) {
  const tabs = [
    { id: "leads", href: "/campanhas/nova", icon: FileSpreadsheet, title: "Planilha de leads", desc: "Arquivo ou link · mensagem por linha · acompanhamento automático" },
    { id: "optin", href: "/campanhas/nova?tipo=optin", icon: ShieldCheck, title: "Contatos que aceitaram", desc: "Clientes com opt-in, filtrados por etiqueta" },
  ] as const;
  return (
    <nav aria-label="Tipo de campanha" className="grid gap-3 sm:grid-cols-2">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={current === t.id ? "page" : undefined}
          className={cn("flex items-start gap-3 rounded-xl border p-4 transition-colors", current === t.id ? "border-primary bg-primary/8" : "border-line hover:border-primary/40")}
        >
          <t.icon className={cn("mt-0.5 size-5", current === t.id ? "text-primary" : "text-muted")} aria-hidden />
          <span>
            <span className="block font-semibold">{t.title}</span>
            <span className="block text-xs text-muted">{t.desc}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
