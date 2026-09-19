"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateNotificationPreferencesAction, type ActionState } from "@/app/actions";
import { CheckIcon, MailIcon, BellIcon } from "./icons";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export function NotificationPreferences({
  email,
  emailNotificationsEnabled,
}: {
  email?: string | null;
  emailNotificationsEnabled: boolean;
}) {
  const [state, formAction] = useActionState(updateNotificationPreferencesAction, initial);
  useActionToast(state, { skipSuccess: true });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="card-t p-6">
      <div>
        <h2 className="text-[18px] font-bold">Notifications</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Get notified the moment a game opens near you.
        </p>
      </div>

      <form ref={formRef} action={formAction} className="mt-5 flex flex-col gap-3">
        <div className="rounded-xl border border-glass-border p-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-glass text-ink-soft">
              <BellIcon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold">In-app</div>
              <div className="text-[12px] text-ink-muted">Shows up in the bell menu, always on.</div>
            </div>
            <span
              aria-hidden
              className="relative h-6 w-11 shrink-0 rounded-full bg-green opacity-60"
            >
              <span className="absolute left-[22px] top-0.5 h-5 w-5 rounded-full bg-bg-card shadow" />
            </span>
          </div>
        </div>

        <label className="rounded-xl border border-glass-border p-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-glass text-ink-soft">
              <MailIcon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold">Email</div>
              <div className="text-[12px] text-ink-muted">Kickoff reminders for your games and bookings.</div>
            </div>
            <ToggleInput name="emailNotifications" defaultChecked={emailNotificationsEnabled} onToggle={() => formRef.current?.requestSubmit()} />
          </div>

          {emailNotificationsEnabled && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-glass px-3 py-2 text-[13px] text-ink-soft">
              <CheckIcon size={13} className="text-green" />
              {email ?? "The email you signed up with"}
            </div>
          )}
        </label>
      </form>

      <p className="mt-4 text-[11.5px] leading-relaxed text-ink-muted">
        Payment receipts, refunds and account security emails always send regardless of this setting.
      </p>
    </div>
  );
}

function ToggleInput({
  name,
  defaultChecked,
  onToggle,
}: {
  name: string;
  defaultChecked: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.checked = defaultChecked;
  }, [defaultChecked]);

  return (
    <span className="relative inline-block h-6 w-11 shrink-0">
      <input
        ref={ref}
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        onChange={onToggle}
        className="peer sr-only"
      />
      <span className="pointer-events-none absolute inset-0 rounded-full bg-glass transition peer-checked:bg-green" />
      <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-bg-card shadow transition peer-checked:left-[22px]" />
    </span>
  );
}
