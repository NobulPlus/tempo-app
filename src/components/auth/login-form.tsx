"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailIcon, LockIcon } from "@/components/icons";
import { signInAction, type ActionState } from "@/app/actions";

const initial: ActionState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initial);

  return (
    <form className="space-y-4" action={formAction}>
      <input type="hidden" name="next" value={next} />

      <div className="field-t">
        <input id="email" name="email" type="email" required autoComplete="email" placeholder=" " />
        <span className="field-icon">
          <MailIcon size={19} />
        </span>
        <label htmlFor="email" className="floating">
          Email
        </label>
      </div>

      <div className="field-t">
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          placeholder=" "
        />
        <span className="field-icon">
          <LockIcon size={19} />
        </span>
        <label htmlFor="password" className="floating">
          Password
        </label>
      </div>

      <button type="submit" disabled={pending} className="btn-t btn-green-t w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>

      {state.error && (
        <p role="alert" className="rounded-lg border border-orange/30 bg-orange/10 px-4 py-2.5 text-center text-[13.5px] text-orange">
          {state.error}
        </p>
      )}

      <Link
        href="/reset"
        className="block text-center text-[13.5px] text-ink-soft transition hover:text-green"
      >
        Forgot your password?
      </Link>
    </form>
  );
}
