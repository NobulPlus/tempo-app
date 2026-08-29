/**
 * Postgres/Supabase returns snake_case column names (`full_name`,
 * `price_per_hour_kobo`); every domain type in `lib/types.ts` is camelCase
 * (`fullName`, `pricePerHourKobo`). A bare `as unknown as T` cast changes
 * nothing at runtime — the object still has the snake_case keys, so
 * `row.fullName` is `undefined`. This is the one place that conversion
 * actually happens, recursively, so nested selects (`venue:venues(*)`)
 * come out camelCased too.
 */
export function camelize<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((v) => camelize(v)) as unknown as T;
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      const camelKey = key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
      out[camelKey] = camelize(v);
    }
    return out as T;
  }
  return value as T;
}
