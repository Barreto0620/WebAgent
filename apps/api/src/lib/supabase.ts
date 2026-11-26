import { createClient } from "@supabase/supabase-js";
import type { Database } from "@webagent/shared";
import { config } from "../config";

/** Cliente com service role: ignora RLS. Usar só no servidor e sempre checando permissão antes. */
export const db = createClient<Database>(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type Db = typeof db;
