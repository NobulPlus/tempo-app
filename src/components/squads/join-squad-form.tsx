"use client";

import { useActionState } from "react";
import { joinSquadByCodeAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export function JoinSquadForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(joinSquadByCodeAction, initial);
  useActionToast(state);

  return (
    <form action={action}>
      <input type="hidden" name="code" value={code} />
      <button type="submit" disabled={pending} className="btn-t btn-green-t w-full">
        {pending ? "Joining..." : "Join squad"}
      </button>
    </form>
  );
}
