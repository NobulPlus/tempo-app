"use client";

import { usePathname } from "next/navigation";

/**
 * Management surfaces (dashboard, wallet, venue owner tools, admin) don't
 * need the public marketing footer — "Play sports by area" and legal links
 * are noise once someone's looking at their own KPIs or bookings, not
 * browsing the site. Discovery pages (/games, /pitches, /players) keep it
 * even when signed in, since those stay browsable content either way.
 *
 * Footer itself is an async Server Component (it fetches pitches-by-area),
 * so it can't be imported and instantiated from here directly — this only
 * needs usePathname(), which requires "use client". Instead the layout
 * renders <Footer /> on the server and passes the result in as children,
 * and this just decides whether to show it.
 */
const HIDDEN_PREFIXES = ["/dashboard", "/wallet", "/venue", "/admin"];

export function ConditionalFooter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hide = HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (hide) return null;
  return <>{children}</>;
}
