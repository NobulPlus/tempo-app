import "server-only";
import { cookies } from "next/headers";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/data/repo";
import type { PlayerProfile } from "@/lib/types";

export const DEMO_COOKIE = "tempo_demo_user";

/**
 * Who is signed in?
 *
 * With Supabase configured this reads the real session. In demo mode it reads
 * a cookie holding a seed profile id, so you can sign in as any of the seeded
 * players and experience the product from their side without a backend.
 */
export async function getCurrentUser(): Promise<PlayerProfile | null> {
  if (isSupabaseConfigured()) {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
    return (data as unknown as PlayerProfile) ?? null;
  }

  const jar = await cookies();
  const id = jar.get(DEMO_COOKIE)?.value;
  if (!id) return null;
  return getProfileById(id);
}

export async function requireUser(): Promise<PlayerProfile> {
  const user = await getCurrentUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  return user;
}
