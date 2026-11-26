import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "agora";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s.toString().padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${(m % 60).toString().padStart(2, "0")}m`;
}
