"use client";
import { cn } from "@/lib/utils";

export function Switch({
  id,
  name,
  checked,
  defaultChecked,
  onChange,
  disabled,
  label,
}: {
  id: string;
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label htmlFor={id} className={cn("relative inline-flex cursor-pointer items-center", disabled && "cursor-not-allowed opacity-60")}>
      <input
        id={id}
        name={name}
        type="checkbox"
        role="switch"
        aria-label={label}
        className="peer sr-only"
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="h-5 w-9 rounded-full bg-surface-3 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ring)]" />
      <span className="absolute left-0.5 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
    </label>
  );
}
