"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { UserIcon, MailIcon, PhoneIcon, LockIcon, EyeIcon } from "@/components/icons";
import { normalisePhone } from "@/lib/format";
import { signUpAction, type ActionState } from "@/app/actions";

const initial: ActionState = {};

/**
 * Real client-side validation plus a real server action. Role is no longer
 * chosen here — every signup is a player; 0002_auth_hardening.sql enforces
 * that server-side too, so this form isn't the only thing standing between
 * a signup and an elevated role.
 */
export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initial);
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [phone, setPhone] = useState("");

  const phoneValid = phone === "" || Boolean(normalisePhone(phone));
  const pwStrength = strength(pw);
  const pwMatch = pw2 === "" || pw === pw2;

  if (state.ok && state.message) {
    return (
      <div className="rounded-xl border border-green/30 bg-green/10 p-5 text-[14.5px] text-ink">
        {state.message}
      </div>
    );
  }

  return (
    <form className="space-y-4" action={formAction}>
      <div className="field-t">
        <input id="fullName" name="fullName" type="text" required autoComplete="name" placeholder=" " />
        <span className="field-icon">
          <UserIcon size={19} />
        </span>
        <label htmlFor="fullName" className="floating">
          Full name
        </label>
      </div>

      <div className="field-t">
        <input id="email" name="email" type="email" required autoComplete="email" placeholder=" " />
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
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder=" "
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={!phoneValid}
          />
          <span className="field-icon">
            <PhoneIcon size={19} />
          </span>
          <label htmlFor="phone" className="floating">
            Phone number
          </label>
        </div>
        {!phoneValid && (
          <p className="mt-1.5 text-[12.5px] text-orange">
            Use a Nigerian number — 0801 234 5678 or +234 801 234 5678.
          </p>
        )}
        <p className="mt-1.5 text-[12px] text-ink-muted">
          We use this to message you about your games on WhatsApp. Optional.
        </p>
      </div>

      <div>
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
            Password
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

        {pw && (
          <div className="mt-2">
            <div className="fill-track">
              <div
                className="fill-bar"
                data-heat={pwStrength.score < 2 ? "hot" : pwStrength.score < 3 ? "warm" : undefined}
                style={{ width: `${(pwStrength.score / 4) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-[12px] text-ink-muted">{pwStrength.label}</p>
          </div>
        )}
      </div>

      <div>
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
            Confirm password
          </label>
        </div>
        {!pwMatch && (
          <p className="mt-1.5 text-[12.5px] text-orange">Passwords don&apos;t match.</p>
        )}
      </div>

      <label className="flex items-start gap-3 text-[13.5px] leading-relaxed text-ink-soft">
        <input type="checkbox" name="terms" required className="mt-0.5 h-4 w-4 shrink-0 accent-green" />
        <span>
          I agree to Tempo&apos;s{" "}
          <Link href="/legal/terms" className="text-green underline underline-offset-2">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="text-green underline underline-offset-2">
            Privacy Policy
          </Link>
          , and consent to Tempo processing my personal data as described there.
        </span>
      </label>

      <button type="submit" disabled={pending} className="btn-t btn-green-t w-full">
        {pending ? "Creating account…" : "Create account"}
      </button>

      {state.error && (
        <p role="alert" className="rounded-lg border border-orange/30 bg-orange/10 px-4 py-3 text-[13.5px] text-orange">
          {state.error}
        </p>
      )}
    </form>
  );
}

function strength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^\w\s]/.test(pw)) score++;

  const labels = [
    "Too short — use at least 8 characters",
    "Weak — add length or mix cases",
    "Fair — a bit longer would help",
    "Good",
    "Strong",
  ];
  return { score, label: labels[score] };
}
