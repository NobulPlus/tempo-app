"use client";

import { useActionState, useState } from "react";
import { LockIcon, EyeIcon } from "@/components/icons";
import { updatePasswordAction, type ActionState } from "@/app/actions";

const initial: ActionState = {};

export function ResetConfirmForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initial);
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const pwMatch = pw2 === "" || pw === pw2;

  return (
    <form className="space-y-4" action={formAction}>
      <div className="field-t">
        <input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          required
          minLength={8}
          autoComplete="new-password"
          placeholder=" "
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <span className="field-icon">
          <LockIcon size={19} />
        </span>
        <label htmlFor="password" className="floating">
          New password
        </label>
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className={`absolute right-4 top-4 transition ${show ? "text-green" : "text-ink-muted"}`}
        >
          <EyeIcon size={19} />
        </button>
      </div>

      <div className="field-t">
        <input
          id="password2"
          name="password2"
          type={show ? "text" : "password"}
          required
          autoComplete="new-password"
          placeholder=" "
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          aria-invalid={!pwMatch}
        />
        <span className="field-icon">
          <LockIcon size={19} />
        </span>
        <label htmlFor="password2" className="floating">
          Confirm new password
        </label>
      </div>
      {!pwMatch && (
        <p className="text-[12.5px] text-orange">Passwords don&apos;t match.</p>
      )}

      <button type="submit" disabled={pending} className="btn-t btn-green-t w-full">
        {pending ? "Updating…" : "Update password"}
      </button>

      {state.error && (
        <p role="alert" className="rounded-lg border border-orange/30 bg-orange/10 px-4 py-2.5 text-center text-[13.5px] text-orange">
          {state.error}
        </p>
      )}
    </form>
  );
}
