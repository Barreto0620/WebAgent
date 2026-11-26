import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  success: "bg-primary/15 text-primary",
  warning: "bg-gold/15 text-gold",
  danger: "bg-danger/15 text-danger",
  info: "bg-sky-500/15 text-sky-500",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StatusDot({ tone = "success", pulse }: { tone?: "success" | "warning" | "danger" | "neutral"; pulse?: boolean }) {
  const color = { success: "bg-neon", warning: "bg-gold", danger: "bg-danger", neutral: "bg-muted" }[tone];
  return (
    <span className="relative inline-flex size-2">
      {pulse && <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", color)} />}
      <span className={cn("relative inline-flex size-2 rounded-full", color)} />
    </span>
  );
}
