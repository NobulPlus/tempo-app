/**
 * v2 mock data helpers — same relative-date trick as v1's seed.ts, kept
 * because it's the right idea (a demo that's always "this week" instead of
 * drifting stale), just detached from that file entirely per the brief.
 */

const now = new Date();

export function at(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function plus(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/** Deterministic placeholder photography — real Lagos photography replaces this later. */
export function photo(seed: string, w = 1200, h = 800): string {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

export function avatar(seed: string, size = 128): string {
  return `https://i.pravatar.cc/${size}?u=${seed}`;
}
