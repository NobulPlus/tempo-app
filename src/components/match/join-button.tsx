"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinGameAction, leaveGameAction } from "@/app/actions";
import { formatNaira } from "@/lib/format";
import { CheckIcon } from "@/components/icons";

export function JoinButton({
  gameId,
  slug,
  priceKobo,
  isMember,
  isWaitlisted,
  spotsLeft,
  signedIn,
  hasEnded,
}: {
  gameId: string;
  slug: string;
  priceKobo: number;
  isMember: boolean;
  isWaitlisted: boolean;
  spotsLeft: number;
  signedIn: boolean;
  hasEnded: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (hasEnded) {
    return (
      <button disabled className="btn-t btn-ghost-t w-full">
        This game has finished
      </button>
    );
  }

  if (!signedIn) {
    return (
      <a
        href={`/login?next=${encodeURIComponent(`/games/${slug}`)}`}
        className="btn-t btn-green-t w-full"
      >
        Sign in to join
      </a>
    );
  }

  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>) => {
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await fn();
      if (res.error === "AUTH_REQUIRED") {
        router.push(`/login?next=${encodeURIComponent(`/games/${slug}`)}`);
        return;
      }
      if (res.error) setError(res.error);
      if (res.message) setMessage(res.message);
      router.refresh();
    });
  };

  return (
    <div>
      {isMember ? (
        <>
          <div className="flex items-center justify-center gap-2 rounded-full border border-green/35 bg-green/12 px-5 py-3.5 text-[15px] font-semibold text-green">
            <CheckIcon size={17} />
            {isWaitlisted ? "You're on the waitlist" : "You're in this game"}
          </div>
          <button
            onClick={() => run(() => leaveGameAction(gameId, slug))}
            disabled={pending}
            className="mt-2.5 w-full text-[13.5px] text-ink-muted underline underline-offset-4 transition hover:text-orange"
          >
            {pending ? "Updating…" : "Can't make it? Drop out"}
          </button>
        </>
      ) : (
        <button
          onClick={() => run(() => joinGameAction(gameId, slug))}
          disabled={pending}
          className={`btn-t w-full ${spotsLeft === 0 ? "btn-ghost-t" : "btn-green-t"}`}
        >
          {pending
            ? "Joining…"
            : spotsLeft === 0
              ? "Join the waitlist"
              : `Join game — ${formatNaira(priceKobo)}`}
        </button>
      )}

      {message && (
        <p role="status" className="mt-3 rounded-lg border border-green/25 bg-green/10 px-4 py-2.5 text-[13.5px] text-green">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-orange/30 bg-orange/10 px-4 py-2.5 text-[13.5px] text-orange">
          {error}
        </p>
      )}
    </div>
  );
}
