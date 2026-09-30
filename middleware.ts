import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isLiveProduction } from "@/lib/env";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Pre-launch lock: production sends every route to /coming-soon, full stop
 * — no exceptions for existing accounts, by design. Staging/preview is
 * unaffected (isLiveProduction() is false there), so the real app stays
 * fully usable for the team and the client. API routes are excluded so
 * payment webhooks and cron automation keep running behind the scenes.
 */
function comingSoonGate(request: NextRequest): NextResponse | null {
  const localGateEnabled = process.env.TEMPO_LAUNCH_GATE === "true";
  const isPublicTempoDomain = ["playtempo11.com", "www.playtempo11.com"].includes(
    request.nextUrl.hostname,
  );

  // A Vercel system environment variable should distinguish Preview from
  // Production. The public-domain check is an additional guardrail: a
  // Preview URL must always remain a usable staging environment.
  if (!localGateEnabled && (!isLiveProduction() || !isPublicTempoDomain)) return null;
  const { pathname } = request.nextUrl;
  if (pathname === "/coming-soon" || pathname.startsWith("/api/")) return null;
  return NextResponse.redirect(new URL("/coming-soon", request.url));
}

/**
 * Refreshes the Supabase session cookie on every request. Without this,
 * sessions silently expire — Supabase's access token is short-lived and
 * only gets renewed here, not by the client SDK on its own in an SSR app.
 * No-ops entirely in demo mode (no Supabase configured).
 */
export async function middleware(request: NextRequest) {
  const gate = comingSoonGate(request);
  if (gate) return gate;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touching getUser() is what actually triggers the refresh when the
  // access token is close to expiry.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff|woff2)$).*)",
  ],
};
