"use client";

import { useState } from "react";
import { CheckIcon, MailIcon, WhatsAppIcon, BellIcon } from "./icons";

interface Channel {
  key: "app" | "email" | "whatsapp";
  label: string;
  hint: string;
  icon: typeof BellIcon;
  locked?: boolean;
}

const CHANNELS: Channel[] = [
  { key: "app", label: "In-app", hint: "Shows up in the bell menu, always on.", icon: BellIcon, locked: true },
  { key: "email", label: "Email", hint: "New games near you, reminders, waitlist updates.", icon: MailIcon },
  { key: "whatsapp", label: "WhatsApp", hint: "The same alerts, sent to the number below.", icon: WhatsAppIcon },
];

export function NotificationPreferences({ email }: { email: string }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ app: true, email: true, whatsapp: false });
  const [whatsapp, setWhatsapp] = useState("");

  return (
    <div className="card-t p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold">Notifications</h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            Get notified the moment a game opens near you.
          </p>
        </div>
        <span className="chip-t !border-gold/35 !bg-gold/12 !text-gold shrink-0">Preview</span>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {CHANNELS.map((c) => {
          const Icon = c.icon;
          const on = enabled[c.key];
          return (
            <div key={c.key} className="rounded-xl border border-glass-border p-3.5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-glass text-ink-soft">
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold">{c.label}</div>
                  <div className="text-[12px] text-ink-muted">{c.hint}</div>
                </div>
                <button
                  role="switch"
                  aria-checked={on}
                  aria-label={`${c.label} notifications`}
                  disabled={c.locked}
                  onClick={() => setEnabled((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    on ? "bg-green" : "bg-glass"
                  } ${c.locked ? "opacity-60" : ""}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg-card shadow transition ${
                      on ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {c.key === "email" && on && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-glass px-3 py-2 text-[13px] text-ink-soft">
                  <CheckIcon size={13} className="text-green" />
                  {email}
                </div>
              )}

              {c.key === "whatsapp" && on && (
                <input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  type="tel"
                  placeholder="+234 801 234 5678"
                  className="mt-3 w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-[13px] outline-none transition focus:border-green/50"
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11.5px] leading-relaxed text-ink-muted">
        Preview only — these switches aren&apos;t wired to real delivery yet.
        In-app already works; email and WhatsApp need a provider connected on
        the backend before they can actually send anything.
      </p>
    </div>
  );
}
