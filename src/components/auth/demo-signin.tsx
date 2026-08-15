"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { demoSignIn } from "@/app/actions";
import type { PlayerProfile } from "@/lib/types";
import { ArrowRightIcon, BuildingIcon, GroupIcon, UserIcon } from "@/components/icons";

const ROLE_ICON = {
  player: UserIcon,
  host: GroupIcon,
  venue_owner: BuildingIcon,
  admin: UserIcon,
} as const;

const ROLE_LABEL = {
  player: "Player",
  host: "Host",
  venue_owner: "Venue owner",
  admin: "Admin",
} as const;

export function DemoSignIn({
  profiles,
  next,
}: {
  profiles: PlayerProfile[];
  next: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const pick = (id: string) => {
    start(async () => {
      await demoSignIn(id);
      router.push(next);
      router.refresh();
    });
  };

  return (
    <div>
      <p className="text-[13.5px] leading-relaxed text-ink-soft">
        Demo mode — no password needed. Sign in as any of the seeded players to see
        Tempo from their side. Folake owns two venues; Chidi, Amina, Tunde and Yemi
        host games.
      </p>

      <ul className="mt-4 space-y-2">
        {profiles.map((p) => {
          const Icon = ROLE_ICON[p.role] ?? UserIcon;
          return (
            <li key={p.id}>
              <button
                onClick={() => pick(p.id)}
                disabled={pending}
                className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/4 p-3.5 text-left transition hover:border-green/40 hover:bg-green/8 disabled:opacity-50"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-green/35 bg-green/10 text-[13px] font-bold">
                  {p.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">
                    {p.fullName}
                  </span>
                  <span className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                    <Icon size={12} />
                    {ROLE_LABEL[p.role]} · {p.gamesPlayed} games · {p.area}
                  </span>
                </span>
                <ArrowRightIcon
                  size={16}
                  className="shrink-0 text-ink-muted transition group-hover:translate-x-1 group-hover:text-green"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
