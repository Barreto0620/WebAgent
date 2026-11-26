"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@webagent/shared";
import { SUPABASE_KEY, SUPABASE_URL } from "../env";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getBrowserClient() {
  client ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
