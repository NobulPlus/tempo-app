"use client";

import { useActionState } from "react";
import { openDmThreadAction, type ActionState } from "@/app/actions";
import { ChatIcon } from "@/components/icons";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export function MessagePlayerButton({ otherUserId }: { otherUserId: string }) {
  const [state, formAction, pending] = useActionState(openDmThreadAction, initial);
  useActionToast(state);

  return (
    <form action={formAction}>
      <input type="hidden" name="otherUserId" value={otherUserId} />
      <button type="submit" disabled={pending} className="btn-t btn-ghost-t w-full !py-3 !text-[14px]">
        <ChatIcon size={15} />
        {pending ? "Opening…" : "Message"}
      </button>
    </form>
  );
}
