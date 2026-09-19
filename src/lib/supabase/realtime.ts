"use client";

import { useEffect, useRef } from "react";
import { createClient } from "./client";

/**
 * First real-time consumer in this app — the browser client exists but was
 * previously unused; every other write goes through a server action.
 * Realtime is read-only here: it pushes new rows to subscribers whose RLS
 * would allow reading them (the same publication already carries
 * games/game_participants/slots), writes still go through server actions.
 */
export function useTableInserts<T>(table: string, filter: string | null, onInsert: (row: T) => void) {
  const onInsertRef = useRef(onInsert);
  useEffect(() => {
    onInsertRef.current = onInsert;
  }, [onInsert]);

  useEffect(() => {
    if (!filter) return;
    const sb = createClient();
    if (!sb) return;

    let cancelled = false;
    let channel: ReturnType<typeof sb.channel> | null = null;

    // createBrowserClient's cookie-backed session isn't automatically wired
    // into the realtime socket's JWT — without an explicit setAuth() call,
    // the channel still reaches "SUBSCRIBED", but auth.uid() evaluates to
    // null for every RLS check Realtime runs against it, so postgres_changes
    // silently never delivers anything to that socket (found via a raw
    // supabase-js script vs. this component: the raw client, which lets
    // supabase-js manage the token itself, worked immediately).
    sb.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const token = data.session?.access_token;
      if (token) sb.realtime.setAuth(token);

      channel = sb
        .channel(`${table}:${filter}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table, filter },
          (payload) => onInsertRef.current(payload.new as T),
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) sb.removeChannel(channel);
    };
  }, [table, filter]);
}
