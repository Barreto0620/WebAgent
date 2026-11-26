"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTIVE_SYSTEM_COOKIE } from "@webagent/shared";
import { createClient } from "@/lib/supabase/server";

export async function setActiveSystem(systemId: string) {
  const supabase = await createClient();
  // RLS garante que o usuário só encontra sistemas aos quais tem acesso
  const { data } = await supabase.from("systems").select("id").eq("id", systemId).maybeSingle();
  if (!data) return;
  (await cookies()).set(ACTIVE_SYSTEM_COOKIE, systemId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
  });
  revalidatePath("/", "layout");
}
