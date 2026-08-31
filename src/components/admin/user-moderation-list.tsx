"use client";

import { useActionState, useState } from "react";
import { setUserSuspendedAction, setUserRoleAction, type ActionState } from "@/app/actions";
import { BallIcon, SearchIcon, ShieldIcon, StarIcon } from "@/components/icons";
import type { PlayerProfile, UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["player", "host", "venue_owner", "admin"];
const ROLE_FILTERS: (UserRole | "all")[] = ["all", ...ROLES];
const SIGNAL_FILTERS = ["all", "watch", "suspended"] as const;

export function UserModerationList({ profiles }: { profiles: PlayerProfile[] }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<UserRole | "all">("all");
  const [signal, setSignal] = useState<(typeof SIGNAL_FILTERS)[number]>("all");
  const filtered = profiles.filter((p) => {
    const hay = `${p.fullName} ${p.handle}`.toLowerCase();
    const trustWatch = p.punctualityScore < 80 || (p.peerRating ?? 5) < 4;
    if (!hay.includes(q.toLowerCase())) return false;
    if (role !== "all" && p.role !== role) return false;
    if (signal === "suspended" && !p.suspended) return false;
    if (signal === "watch" && !trustWatch) return false;
    return true;
  });
  const suspended = profiles.filter((p) => p.suspended).length;
  const trustWatch = profiles.filter((p) => p.punctualityScore < 80 || (p.peerRating ?? 5) < 4).length;
  const admins = profiles.filter((p) => p.role === "admin").length;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={<ShieldIcon size={14} />} label="Admins" value={admins} />
        <Stat icon={<StarIcon size={14} />} label="Trust watch" value={trustWatch} tone={trustWatch ? "text-gold" : "text-green"} />
        <Stat icon={<BallIcon size={14} />} label="Suspended" value={suspended} tone={suspended ? "text-orange" : "text-green"} />
      </div>

      <div className="mt-5 card-t p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
              <SearchIcon size={15} />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or handle"
              className="w-full rounded-full border border-glass-border bg-glass py-2.5 pl-9 pr-4 text-[13.5px] outline-none transition focus:border-green/50"
            />
          </div>
          <Segmented
            label="Role"
            value={role}
            options={ROLE_FILTERS.map((r) => ({ value: r, label: labelRole(r) }))}
            onChange={(next) => setRole(next as UserRole | "all")}
          />
          <Segmented
            label="Signal"
            value={signal}
            options={SIGNAL_FILTERS.map((s) => ({ value: s, label: labelSignal(s) }))}
            onChange={(next) => setSignal(next as (typeof SIGNAL_FILTERS)[number])}
          />
        </div>
        <div className="mt-3 text-[12.5px] text-ink-muted">
          Showing {filtered.length} of {profiles.length} users
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {filtered.map((p) => (
          <UserModerationRow key={p.id} profile={p} />
        ))}
        {filtered.length === 0 && (
          <p className="py-6 text-center text-[13.5px] text-ink-soft">No users match those filters.</p>
        )}
      </div>
    </div>
  );
}

const initial: ActionState = {};

function UserModerationRow({ profile }: { profile: PlayerProfile }) {
  const [suspendState, suspendAction, suspendPending] = useActionState(
    setUserSuspendedAction,
    initial,
  );
  const [roleState, roleAction, rolePending] = useActionState(setUserRoleAction, initial);

  return (
    <div className="card-t flex flex-wrap items-center gap-3 p-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-green/35 bg-green/10 text-[12px] font-bold">
        {profile.initials}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[14px] font-semibold">{profile.fullName}</span>
          <span className="chip-t !px-2 !py-1 !text-[11px]">{labelRole(profile.role)}</span>
          {profile.suspended && (
            <span className="chip-t !border-orange/35 !bg-orange/12 !text-orange">Suspended</span>
          )}
          {!profile.suspended && (profile.punctualityScore < 80 || (profile.peerRating ?? 5) < 4) && (
            <span className="chip-t !border-gold/35 !bg-gold/12 !text-gold">Trust watch</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-muted">
          <span>@{profile.handle}</span>
          <span>{profile.area ?? "No area"}</span>
          <span>{profile.gamesPlayed} games</span>
          <span>Punctuality {profile.punctualityScore}</span>
          <span>{profile.peerRating ? `${profile.peerRating.toFixed(1)} rating` : "No rating"}</span>
        </div>
      </div>

      <form action={roleAction} className="flex items-center gap-1.5">
        <input type="hidden" name="userId" value={profile.id} />
        <select
          name="role"
          defaultValue={profile.role}
          disabled={rolePending}
          className="rounded-lg border border-glass-border bg-glass px-2.5 py-2 text-[12.5px] outline-none transition focus:border-green/50"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button type="submit" disabled={rolePending} className="btn-t btn-ghost-t !px-3 !py-2 !text-[12px]">
          Save
        </button>
      </form>

      <form action={suspendAction}>
        <input type="hidden" name="userId" value={profile.id} />
        <input type="hidden" name="suspended" value={profile.suspended ? "false" : "true"} />
        <button
          type="submit"
          disabled={suspendPending}
          className={`btn-t !px-3 !py-2 !text-[12px] ${profile.suspended ? "btn-green-t" : "btn-ghost-t"}`}
        >
          {suspendPending ? "Working…" : profile.suspended ? "Unsuspend" : "Suspend"}
        </button>
      </form>

      {(suspendState.error || roleState.error) && (
        <p className="w-full text-[12px] text-orange">{suspendState.error || roleState.error}</p>
      )}
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex shrink-0 overflow-x-auto rounded-full border border-glass-border bg-glass p-1" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
            value === option.value ? "bg-green text-[#051530]" : "text-ink-muted hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone = "text-ink",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="card-t p-4">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.7px] text-ink-muted">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-[28px] font-extrabold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function labelRole(role: UserRole | "all") {
  if (role === "all") return "All roles";
  return role.replace("_", " ");
}

function labelSignal(signal: (typeof SIGNAL_FILTERS)[number]) {
  if (signal === "all") return "All signals";
  if (signal === "watch") return "Trust watch";
  return "Suspended";
}
