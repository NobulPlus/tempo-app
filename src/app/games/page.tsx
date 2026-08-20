import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { listGames } from "@/lib/mock";
import { GameCard } from "@/components/match/game-card";
import { GameFilters } from "@/components/match/game-filters";
import type { SkillLevel } from "@/lib/types";

export const metadata: Metadata = {
  title: "Join an open game in Lagos",
  description:
    "Open football games across Lagos you can join solo. See who's playing, how many spots are left, and whether the game is guaranteed to go ahead.",
};

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) as string | undefined;

  const games = listGames({
    q: one("q"),
    level: (one("level") as SkillLevel) ?? "all",
    when: (one("when") as "all" | "today" | "tomorrow" | "week") ?? "all",
    side: (one("side") as "all" | "island" | "mainland") ?? "all",
  });

  return (
    <div className="py-12">
      <div className="container-t">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[clamp(32px,6vw,50px)] font-extrabold tracking-[-.02em]">
              Join a <span className="text-orange">game</span>
            </h1>
            <p className="mt-3 max-w-2xl text-[17px] text-ink-soft">
              Turn up alone, leave with a team. Every game shows how many players it
              needs to be guaranteed — hit the number and it&apos;s definitely on.
            </p>
          </div>
          <Link href="/host" className="btn-t btn-ghost-t">
            Host your own
          </Link>
        </div>

        <Suspense fallback={<div className="mt-8 h-40" />}>
          <GameFilters resultCount={games.length} />
        </Suspense>

        {games.length === 0 ? (
          <div className="card-t mt-10 p-12 text-center">
            <h2 className="text-[20px] font-bold">No games match that</h2>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">
              Nothing on with those filters. Widen the search — or host a game
              yourself and let people come to you.
            </p>
            <Link href="/host" className="btn-t btn-green-t mt-6">
              Host a game
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
