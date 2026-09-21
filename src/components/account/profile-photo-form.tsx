"use client";

import { useActionState, useState } from "react";
import { updateProfilePhotoAction, type ActionState } from "@/app/actions";
import { UserIcon } from "@/components/icons";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export function ProfilePhotoForm({
  fullName,
  initials,
  avatarUrl,
}: {
  fullName: string;
  initials: string;
  avatarUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateProfilePhotoAction, initial);
  useActionToast(state, { skipSuccess: true });
  const [preview, setPreview] = useState<string | null>(null);

  const shown = preview ?? avatarUrl;

  return (
    <form action={formAction} className="card-t p-6">
      <div className="flex flex-col items-center text-center">
        {shown ? (
          <img
            src={shown}
            alt={fullName}
            className="h-24 w-24 shrink-0 rounded-full border-2 border-green object-cover"
          />
        ) : (
          <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-2 border-green bg-green/10 text-[28px] font-extrabold">
            {initials}
          </span>
        )}
        <div className="mt-3 text-[16px] font-bold">{fullName}</div>

        <label
          htmlFor="photo"
          className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-2 text-[13px] font-semibold transition hover:border-green/40"
        >
          <UserIcon size={14} className="text-ink-muted" />
          Choose a photo
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/*"
            required
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
        </label>
      </div>

      {state.ok && (
        <p className="mt-4 rounded-lg border border-green/30 bg-green/10 px-4 py-3 text-[13.5px] text-green">
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending || !preview} className="btn-t btn-green-t mt-5 w-full">
        {pending ? "Uploading…" : "Save photo"}
      </button>

      <p className="mt-3 text-center text-[12px] text-ink-muted">
        JPG, PNG or WEBP, up to 6MB. Shown on your public player profile.
      </p>
    </form>
  );
}
