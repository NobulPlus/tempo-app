"use client";

import { useState, type FormEvent } from "react";
import { CheckIcon, MailIcon } from "@/components/icons";

export function WaitlistForm() {
  const [done, setDone] = useState(false);
  const [area, setArea] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const contact = new FormData(e.currentTarget).get("contact")?.toString().trim() ?? "";
    if (contact.length < 3) {
      setError("Enter your email or phone number");
      return;
    }
    setError(null);
    setDone(true);
  };

  if (done) {
    return (
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-green/30 bg-green/10 px-5 py-4 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green/20 text-green">
          <CheckIcon size={18} />
        </span>
        <p className="text-[14.5px] text-ink">
          {area
            ? `Got it. We'll let you know as soon as we verify a pitch in ${area}.`
            : "Got it. We'll be in touch when we're live in your area."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
            <MailIcon size={17} />
          </span>
          <input
            name="contact"
            required
            placeholder="Email or 0801 234 5678"
            aria-label="Email address or phone number"
            autoComplete="email"
            className="w-full rounded-full border border-glass-border bg-glass py-3.5 pl-11 pr-4 text-[14.5px] outline-none transition focus:border-green/50"
          />
        </div>
        <input
          name="area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="Where do you play?"
          aria-label="Your area"
          className="rounded-full border border-glass-border bg-glass px-5 py-3.5 text-[14.5px] outline-none transition focus:border-green/50 sm:w-44"
        />
        <button type="submit" className="btn-t btn-green-t !py-3.5">
          Notify me
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[13.5px] text-orange">
          {error}
        </p>
      )}
      <p className="mt-3 text-[12px] text-ink-muted">
        We&apos;ll only message you about pitches in your area. Unsubscribe anytime.
      </p>
    </form>
  );
}
