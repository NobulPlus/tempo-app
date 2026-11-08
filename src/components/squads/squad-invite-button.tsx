"use client";

import { useActionState, useState } from "react";
import { createSquadInviteAction, type SquadInviteActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";
import { CheckIcon } from "@/components/icons";

const initial: SquadInviteActionState = {};

export function SquadInviteButton({ squadId }: { squadId: string }) {
  const [state, action, pending] = useActionState(createSquadInviteAction, initial);
  useActionToast(state, { skipSuccess: true });
  const [copied, setCopied] = useState(false);

  const link = state.code && typeof window !== "undefined" ? `${window.location.origin}/squads/join/${state.code}` : state.code;

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="squadId" value={squadId} />
        <button type="submit" disabled={pending} className="btn-t btn-green-t !py-2.5 !text-[13.5px]">
          {pending ? "Creating link..." : "Create invite link"}
        </button>
      </form>
      {state.code && (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 p-3">
          <code className="min-w-0 flex-1 truncate text-[12.5px] text-ink-soft">{link}</code>
          <button
            type="button"
            onClick={() => {
              if (link) navigator.clipboard?.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="btn-t btn-ghost-t !py-1.5 !px-3 !text-[12px]"
          >
            {copied ? <CheckIcon size={13} /> : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
