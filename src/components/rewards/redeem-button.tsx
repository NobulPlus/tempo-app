"use client";

import { useActionState } from "react";
import { redeemPointsAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export function RedeemButton({ pointsCost, disabled }: { pointsCost: number; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(redeemPointsAction, initial);
  useActionToast(state);

  return (
    <form action={formAction}>
      <input type="hidden" name="pointsCost" value={pointsCost} />
      <button
        type="submit"
        disabled={disabled || pending || state.ok === true}
        className="btn-t btn-ghost-t shrink-0 !py-2 !text-[12.5px]"
      >
        {state.ok === true ? "Redeemed" : pending ? "…" : `Redeem ${pointsCost}`}
      </button>
    </form>
  );
}
