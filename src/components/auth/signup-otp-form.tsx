"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { MailIcon, LockIcon } from "@/components/icons";
import {
  resendSignupOtpAction,
  verifySignupOtpAction,
  type ActionState,
} from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export function SignupOtpForm({ email, next }: { email: string; next: string }) {
  const [verifyState, verifyAction, verifying] = useActionState(verifySignupOtpAction, initial);
  const [resendState, resendAction, resending] = useActionState(resendSignupOtpAction, initial);
  useActionToast(verifyState);
  useActionToast(resendState);
  const [code, setCode] = useState("");

  return (
    <div className="space-y-5">
      <form action={verifyAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />

        <div className="field-t">
          <input
            id="email"
            name="email"
            type="email"
            required
            readOnly
            autoComplete="email"
            placeholder=" "
            defaultValue={email}
            className="cursor-not-allowed opacity-70"
            suppressHydrationWarning
          />
          <span className="field-icon">
            <MailIcon size={19} />
          </span>
          <label htmlFor="email" className="floating">
            Email
          </label>
        </div>

        <div>
          <div className="field-t">
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              placeholder=" "
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="font-mono text-[22px] tracking-[.35em]"
            />
            <span className="field-icon">
              <LockIcon size={19} />
            </span>
            <label htmlFor="code" className="floating">
              6-digit code
            </label>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-muted">
            Check your inbox and enter the code from Tempo.
          </p>
        </div>

        <button type="submit" disabled={verifying || code.length !== 6} className="btn-t btn-green-t w-full">
          {verifying ? "Checking code..." : "Verify account"}
        </button>
      </form>

      <form action={resendAction} className="rounded-xl border border-glass-border bg-glass p-4">
        <input type="hidden" name="email" value={email} suppressHydrationWarning />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13.5px] text-ink-soft">No code yet?</p>
          <button type="submit" disabled={resending || !email} className="btn-t btn-ghost-t !px-4 !py-2.5 !text-[13px]">
            {resending ? "Sending..." : "Send code again"}
          </button>
        </div>
      </form>

      <p className="text-center text-[13.5px] text-ink-soft">
        Wrong email?{" "}
        <Link href="/signup" className="font-semibold text-green">
          Start again
        </Link>
      </p>
    </div>
  );
}
