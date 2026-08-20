"use client";

import { useState } from "react";
import { formatNaira } from "@/lib/format";
import { CheckIcon } from "@/components/icons";

/**
 * v2 has no backend — this simulates the join/leave flow with local state
 * instead of calling a server action. Optimistic, resets on refresh.
 */
export function JoinButton({
  priceKobo,
  spotsLeft,
  hasEnded,
  initialJoined = false,
}: {
  priceKobo: number;
  spotsLeft: number;
  hasEnded: boolean;
  initialJoined?: boolean;
}) {
  const [joined, setJoined] = useState(initialJoined);
  const [waitlisted, setWaitlisted] = useState(false);

  if (hasEnded) {
    return (
      <button disabled className="btn-t btn-ghost-t w-full">
        This game has finished
      </button>
    );
  }

  if (joined) {
    return (
      <div>
        <div className="flex items-center justify-center gap-2 rounded-full border border-green/35 bg-green/12 px-5 py-3.5 text-[15px] font-semibold text-green">
          <CheckIcon size={17} />
          {waitlisted ? "You're on the waitlist" : "You're in this game"}
        </div>
        <button
          onClick={() => {
            setJoined(false);
            setWaitlisted(false);
          }}
          className="mt-2.5 w-full text-[13.5px] text-ink-muted underline underline-offset-4 transition hover:text-orange"
        >
          Can&apos;t make it? Drop out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setJoined(true);
        setWaitlisted(spotsLeft === 0);
      }}
      className={`btn-t w-full ${spotsLeft === 0 ? "btn-ghost-t" : "btn-green-t"}`}
    >
      {spotsLeft === 0 ? "Join the waitlist" : `Join game — ${formatNaira(priceKobo)}`}
    </button>
  );
}
