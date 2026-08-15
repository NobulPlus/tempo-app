"use client";

import { useState } from "react";
import Link from "next/link";
import {
  UserIcon,
  MailIcon,
  PhoneIcon,
  LockIcon,
  EyeIcon,
  GroupIcon,
  BuildingIcon,
  CheckIcon,
} from "@/components/icons";
import { normalisePhone } from "@/lib/format";

const ROLES = [
  {
    key: "player",
    label: "Player",
    desc: "Join games, book pitches, build a reputation",
    Icon: UserIcon,
  },
  {
    key: "host",
    label: "Host",
    desc: "Organise games, manage rosters, get paid automatically",
    Icon: GroupIcon,
  },
  {
    key: "venue_owner",
    label: "Venue owner",
    desc: "List your pitch, fill empty hours, manage bookings",
    Icon: BuildingIcon,
  },
] as const;

/**
 * Real client-side validation. The prototype's form had no `name` attributes,
 * no `required`, no password match check and an unenforced terms box.
 */
export function SignupForm() {
  const [role, setRole] = useState<string>("player");
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);

  const phoneValid = phone === "" || Boolean(normalisePhone(phone));
  const pwStrength = strength(pw);
  const pwMatch = pw2 === "" || pw === pw2;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
      }}
    >
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

      <fieldset>
        <legend className="mb-2.5 text-[13px] font-semibold text-ink-soft">
          I want to join as
        </legend>
        <div
          role="radiogroup"
          aria-label="Account type"
          className="grid gap-2"
        >
          {ROLES.map(({ key, label, desc, Icon }) => (
            <button
              type="button"
              role="radio"
              aria-checked={role === key}
              key={key}
              onClick={() => setRole(key)}
              className={`flex items-center gap-3.5 rounded-xl border p-3.5 text-left transition ${
                role === key
                  ? "border-green/50 bg-green/10"
                  : "border-white/10 bg-white/4 hover:border-white/25"
              }`}
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                  role === key ? "bg-green/18 text-green" : "bg-white/6 text-ink-soft"
                }`}
              >
                <Icon size={19} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-semibold">{label}</span>
                <span className="block text-[12px] leading-snug text-ink-muted">{desc}</span>
              </span>
              <span
                className={`ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                  role === key ? "border-green bg-green text-[#04150c]" : "border-white/25"
                }`}
              >
                {role === key && <CheckIcon size={11} />}
              </span>
            </button>
          ))}
        </div>
        <input type="hidden" name="role" value={role} />
      </fieldset>

      <label className="flex items-start gap-3 text-[13.5px] leading-relaxed text-ink-soft">
        <input type="checkbox" name="terms" required className="mt-0.5 h-4 w-4 shrink-0 accent-[#00e676]" />
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

      <button type="submit" className="btn-t btn-green-t w-full">
        Create account
      </button>

      {touched && (
        <p role="status" className="rounded-lg border border-gold/25 bg-gold/10 px-4 py-3 text-[13px] text-gold">
          Demo mode — account creation needs Supabase. Add your keys, then this form
          creates a real user with a hashed password and a profile row.
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
