"use client";

import { useActionState } from "react";
import { toggleSquadRecurringTemplateEnabledAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export function ToggleTemplateButton({
  templateId,
  squadSlug,
  enabled,
}: {
  templateId: string;
  squadSlug: string;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(toggleSquadRecurringTemplateEnabledAction, initial);
  useActionToast(state);

  return (
    <form action={action}>
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="squadSlug" value={squadSlug} />
      <button type="submit" disabled={pending} className="btn-t btn-ghost-t !py-2 !text-[12.5px]">
        {pending ? "Saving..." : enabled ? "Pause weekly game" : "Resume weekly game"}
      </button>
    </form>
  );
}
