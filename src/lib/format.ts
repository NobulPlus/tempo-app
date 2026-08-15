/**
 * Money is stored in kobo (integers) everywhere. Never floats, never strings.
 * The prototype had "40,000" as a string on one page and 40000 as a number on
 * another — that divergence is exactly what this file exists to prevent.
 */

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

export function formatNaira(kobo: number, opts: { compact?: boolean } = {}): string {
  const naira = koboToNaira(kobo);
  if (opts.compact && naira >= 1000) {
    const k = naira / 1000;
    return `₦${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return `₦${naira.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

/** Split a total across n players, in kobo, with the remainder on the host. */
export function splitKobo(totalKobo: number, players: number): {
  each: number;
  hostExtra: number;
} {
  if (players <= 0) return { each: totalKobo, hostExtra: 0 };
  const each = Math.floor(totalKobo / players);
  return { each, hostExtra: totalKobo - each * players };
}

const WAT = "Africa/Lagos";

export function formatTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d
    .toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: WAT,
    })
    .replace(":00", "")
    .toLowerCase();
}

export function formatDayShort(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: WAT,
  });
}

export function formatRelativeDay(iso: string | Date, now: Date = new Date()): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(now)) / 86_400_000);

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7)
    return d.toLocaleDateString("en-NG", { weekday: "long", timeZone: WAT });
  return formatDayShort(d);
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Haversine distance in km. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m away`;
  return `${km.toFixed(1)}km away`;
}

/** Nigerian phone normalisation: 0801… / +234801… / 234801… → +234801… */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  const m = digits.match(/^(?:\+?234|0)(\d{10})$/);
  return m ? `+234${m[1]}` : null;
}

export function generateReference(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `TMP-${out}`;
}
