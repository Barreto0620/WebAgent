import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@webagent/shared";
import { SUPABASE_KEY, SUPABASE_URL } from "../env";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado de um Server Component: o proxy já renova a sessão.
        }
      },
    },
  });
}
