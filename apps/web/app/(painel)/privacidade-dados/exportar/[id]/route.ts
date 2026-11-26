import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";

/** Baixa os dados do titular em JSON (portabilidade/acesso, art. 18 LGPD). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await apiFetch<Record<string, unknown>>(`/privacy/contacts/${id}/export`);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="dados-titular-${id.slice(0, 8)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 403 });
  }
}
