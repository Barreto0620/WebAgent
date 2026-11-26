import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-muted/70 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(base, "h-10", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(base, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
});

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] font-medium text-muted", className)} {...props} />;
}

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
