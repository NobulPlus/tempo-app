"use client";

import { useActionState, useState } from "react";
import { submitIdentityVerificationAction, type ActionState } from "@/app/actions";
import { DocumentIcon } from "@/components/icons";

const initial: ActionState = {};

export function IdentityUploadForm() {
  const [state, formAction, pending] = useActionState(submitIdentityVerificationAction, initial);
  const [fileName, setFileName] = useState<string | null>(null);

  if (state.ok) {
    return (
      <p className="rounded-lg border border-green/30 bg-green/10 px-4 py-3 text-[13.5px] text-green">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="card-t p-6">
      <label
        htmlFor="document"
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-glass-border bg-glass px-6 py-10 text-center transition hover:border-green/40"
      >
        <DocumentIcon size={26} className="text-ink-muted" />
        <span className="text-[14px] font-semibold">
          {fileName ?? "Choose a photo or scan of your ID"}
        </span>
        <span className="text-[12px] text-ink-muted">
          National ID, driver&apos;s licence or passport. JPG, PNG or PDF, up to 8MB.
        </span>
        <input
          id="document"
          name="document"
          type="file"
          accept="image/*,application/pdf"
          required
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </label>

      {state.error && (
        <p role="alert" className="mt-4 rounded-lg border border-orange/30 bg-orange/10 px-4 py-3 text-[13.5px] text-orange">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-t btn-green-t mt-5 w-full">
        {pending ? "Uploading…" : "Submit for review"}
      </button>

      <p className="mt-3 text-center text-[12px] text-ink-muted">
        Only Tempo admins can see this document. It&apos;s never shown to other users.
      </p>
    </form>
  );
}
