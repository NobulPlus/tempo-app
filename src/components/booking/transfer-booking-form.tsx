"use client";

import { useActionState, useMemo, useState } from "react";
import { offerBookingTransferAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";
import { SearchIcon, UsersIcon } from "@/components/icons";
import type { PlayerProfile } from "@/lib/types";

const initial: ActionState = {};

export function TransferBookingForm({
  bookingId,
  reference,
  currentUserId,
  players,
}: {
  bookingId: string;
  reference: string;
  currentUserId: string;
  players: PlayerProfile[];
}) {
  const [state, formAction, pending] = useActionState(offerBookingTransferAction, initial);
  useActionToast(state, { skipSuccess: true });
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<PlayerProfile | null>(null);

  const matches = useMemo(() => {
    if (!q.trim() || picked) return [];
    const needle = q.trim().toLowerCase();
    return players
      .filter((p) => p.id !== currentUserId)
      .filter((p) => `${p.fullName} ${p.handle}`.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [q, players, currentUserId, picked]);

  if (state.ok) {
    return (
      <p className="mt-4 rounded-lg border border-green/30 bg-green/10 px-4 py-3 text-[13.5px] text-green">
        {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 text-[13px] font-semibold text-ink-soft transition hover:text-ink">
        Transfer to a friend
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-4 rounded-xl border border-glass-border bg-glass p-4 text-left">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="toUserId" value={picked?.id ?? ""} />

      <div className="text-[13px] font-semibold text-ink-soft">Transfer this booking to a friend</div>

      {picked ? (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2.5">
          <span className="text-[13.5px] font-semibold">{picked.fullName} <span className="text-ink-muted">@{picked.handle}</span></span>
          <button type="button" onClick={() => setPicked(null)} className="text-[12px] text-ink-muted hover:text-ink">
            Change
          </button>
        </div>
      ) : (
        <div className="relative mt-2">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
            <SearchIcon size={14} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or handle"
            className="w-full rounded-full border border-glass-border bg-bg-primary/40 py-2 pl-9 pr-4 text-[13.5px] outline-none focus:border-green/50"
          />
          {matches.length > 0 && (
            <div className="absolute inset-x-0 top-[calc(100%+6px)] z-10 overflow-hidden rounded-xl border border-glass-border bg-bg-card shadow-lg">
              {matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPicked(p);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] transition hover:bg-glass"
                >
                  <UsersIcon size={13} className="text-ink-muted" />
                  {p.fullName} <span className="text-ink-muted">@{p.handle}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending || !picked} className="btn-t btn-green-t !py-2 !text-[13px]">
          {pending ? "Sending…" : "Send transfer offer"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-t btn-ghost-t !py-2 !text-[13px]">
          Cancel
        </button>
      </div>
      {state.ok === false && <p className="mt-2 text-[12px] text-orange">{state.error}</p>}
      <p className="mt-2 text-[11.5px] text-ink-muted">They&apos;ll need to accept before anything changes — you&apos;ll be credited once they do.</p>
    </form>
  );
}
