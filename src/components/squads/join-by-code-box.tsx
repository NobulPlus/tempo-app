"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinByCodeBox() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = code.trim();
        if (trimmed) router.push(`/squads/join/${encodeURIComponent(trimmed)}`);
      }}
      className="flex items-center gap-2"
    >
      <input
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Have an invite code?"
        className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/4 px-4 py-2.5 text-[13.5px] outline-none transition focus:border-green/50"
      />
      <button type="submit" className="btn-t btn-ghost-t !py-2.5 !px-4 !text-[13px]">
        Join
      </button>
    </form>
  );
}
