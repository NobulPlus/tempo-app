"use client";

import { useActionState } from "react";
import { leaveSquadAction, removeSquadMemberAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export function LeaveSquadButton({ squadId }: { squadId: string }) {
  const [state, action, pending] = useActionState(leaveSquadAction, initial);
  useActionToast(state);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm("Leave this squad?")) event.preventDefault();
      }}
    >
      <input type="hidden" name="squadId" value={squadId} />
      <button type="submit" disabled={pending} className="btn-t btn-ghost-t !py-2 !text-[13px] !text-orange">
        {pending ? "Leaving..." : "Leave squad"}
      </button>
    </form>
  );
}

export function RemoveSquadMemberButton({
  squadId,
  squadSlug,
  memberId,
}: {
  squadId: string;
  squadSlug: string;
  memberId: string;
}) {
  const [state, action, pending] = useActionState(removeSquadMemberAction, initial);
  useActionToast(state);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm("Remove this member from the squad?")) event.preventDefault();
      }}
    >
      <input type="hidden" name="squadId" value={squadId} />
      <input type="hidden" name="squadSlug" value={squadSlug} />
      <input type="hidden" name="memberId" value={memberId} />
      <button type="submit" disabled={pending} className="text-[12px] font-semibold text-orange hover:underline">
        Remove
      </button>
    </form>
  );
}
