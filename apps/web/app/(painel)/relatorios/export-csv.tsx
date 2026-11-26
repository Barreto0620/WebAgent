"use client";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportCsv({ filename, rows }: { filename: string; rows: Record<string, string | number>[] }) {
  function download() {
    const headers = Object.keys(rows[0] ?? { atendente: "" });
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\r\n");
    // BOM para o Excel abrir acentos corretamente
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Button size="sm" variant="secondary" onClick={download} disabled={rows.length === 0}>
      <Download className="size-4" /> CSV
    </Button>
  );
}
