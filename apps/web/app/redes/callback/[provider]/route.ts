import { publicUrl } from "@/lib/env";
import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "@/lib/api";

/** Retorno do login da Meta/TikTok: repassa o código para a API e volta para Canais. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = request.nextUrl;
  const back = publicUrl("/canais");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error") ?? url.searchParams.get("error_reason");
  if (denied || !code || !state || (provider !== "meta" && provider !== "tiktok")) {
    back.searchParams.set("social", "erro");
    back.searchParams.set("msg", denied ? "Login cancelado na rede social." : "Retorno inválido do login.");
    return NextResponse.redirect(back);
  }
  try {
    const r = await apiFetch<{ accounts: string[] }>(`/social/${provider}/callback`, { method: "POST", body: { code, state } });
    back.searchParams.set("social", "ok");
    back.searchParams.set("msg", `Conectado: ${r.accounts.join(", ")}`);
  } catch (e) {
    back.searchParams.set("social", "erro");
    back.searchParams.set("msg", e instanceof Error ? e.message : "Falha ao conectar.");
  }
  return NextResponse.redirect(back);
}
