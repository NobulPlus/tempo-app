"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Starts as a quiet text link so it never competes with the page's real
 * primary action (create a squad) — only becomes a form once someone
 * actually has a code to enter. */
export function JoinByCodeBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-[13.5px] font-semibold text-ink-soft underline decoration-dotted underline-offset-4 transition hover:text-ink ${className}`}
      >
        Have an invite code?
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = code.trim();
        if (trimmed) router.push(`/squads/join/${encodeURIComponent(trimmed)}`);
      }}
      className={`flex items-center gap-2 ${className}`}
    >
      <input
        autoFocus
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Paste or type the code"
        className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/4 px-4 py-2.5 text-[13.5px] outline-none transition focus:border-green/50"
      />
      <button type="submit" className="btn-t btn-ghost-t !py-2.5 !px-4 !text-[13px]">
        Join
      </button>
    </form>
  );
}
