import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Sessão inválida ou expirada sem renovação possível: limpa o login e volta para a tela de entrada. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login?erro=sessao", request.nextUrl.origin));
}
