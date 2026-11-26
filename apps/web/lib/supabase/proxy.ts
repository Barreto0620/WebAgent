import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@webagent/shared";
import { SUPABASE_KEY, SUPABASE_URL } from "../env";

const PUBLIC_PATHS = ["/login", "/esqueci-senha", "/auth", "/privacidade", "/termos"];

/** Renova a sessão a cada requisição e protege as rotas do painel. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Lê a sessão do cookie e só chama o servidor de autenticação quando o token expira (renovação).
  // A validação de verdade acontece no banco (RLS) e na API em cada consulta.
  const { data } = await supabase.auth.getSession();
  const user = data.session?.access_token ? true : null;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path !== "/" ? `?next=${encodeURIComponent(path)}` : "";
    return NextResponse.redirect(url);
  }
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
