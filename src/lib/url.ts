/**
 * Only allow same-origin, relative redirect targets. Blocks both absolute
 * URLs (`https://evil.com`) and protocol-relative ones (`//evil.com`), which
 * browsers still treat as off-site.
 */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
