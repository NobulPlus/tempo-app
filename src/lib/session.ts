import "server-only";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { getProfileById, mapProfileRow } from "@/lib/data/repo";
import type { PlayerProfile, UserRole } from "@/lib/types";

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
    try {
      const sb = await createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return null;
      const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (!data) return null;
      if (data.suspended) {
        // Enforced session-wide here so every action gating on getCurrentUser()
        // returning non-null already blocks a suspended user for free. The SQL
        // functions also check `suspended` directly as defense in depth.
        await sb.auth.signOut();
        return null;
      }
      return mapProfileRow(data);
    } catch (error) {
      unstable_rethrow(error);
      console.error("[auth] getCurrentUser failed:", error);
      return null;
    }
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

export function hasRole(user: PlayerProfile | null, roles: UserRole | UserRole[]): user is PlayerProfile {
  if (!user) return false;
  const allowed = Array.isArray(roles) ? roles : [roles];
  return allowed.includes(user.role);
}

export function isVenueOwner(user: PlayerProfile | null): user is PlayerProfile & { role: "venue_owner" } {
  return user?.role === "venue_owner";
}
