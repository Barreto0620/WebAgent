"use server";
import { cookies, headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

const YEAR = 60 * 60 * 24 * 365;

export async function saveCookieConsent(input: { preferences: boolean; version: string }) {
  const store = await cookies();
  const h = await headers();
  const anonId = store.get("wa_anon")?.value ?? randomUUID();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  await supabase.from("cookie_consents").insert({
    user_id: data.user?.id ?? null,
    anon_id: data.user ? null : anonId,
    version: input.version,
    necessary: true,
    preferences: input.preferences,
    analytics: false,
    user_agent: (h.get("user-agent") ?? "").slice(0, 400),
  });

  const secure = process.env.NODE_ENV === "production";
  store.set("wa_consent", `${input.version}:${input.preferences ? "p" : "n"}`, { maxAge: YEAR, sameSite: "lax", secure, httpOnly: true, path: "/" });
  if (!data.user) store.set("wa_anon", anonId, { maxAge: YEAR, sameSite: "lax", secure, httpOnly: true, path: "/" });
  if (!input.preferences) store.delete("wa_theme");
}
