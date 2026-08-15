import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProfile, getGamesForUser } from "@/lib/data/repo";
import { PlayerCard } from "@/components/player/player-card";
import { GameCard } from "@/components/match/game-card";
import { formatRelativeDay } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const player = await getProfile(handle);
  if (!player) return { title: "Player not found" };

  return {
    title: `${player.fullName} (@${player.handle})`,
    description: `${player.fullName} plays football in ${player.area ?? "Lagos"}. ${player.gamesPlayed} games, ${player.punctualityScore}% punctuality on Tempo.`,
  };
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const player = await getProfile(handle);
  if (!player) notFound();

  const games = await getGamesForUser(player.id);
  const upcoming = games.filter((g) => new Date(g.endsAt).getTime() > Date.now());

  return (
    <div className="py-12">
      <div className="container-t max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <PlayerCard player={player} />
          </div>

          <div>
            <section>
              <h2 className="text-[20px] font-bold">
                {upcoming.length > 0 ? "Playing next" : "No games coming up"}
              </h2>
              {upcoming.length > 0 ? (
                <div className="mt-4 grid gap-5">
                  {upcoming.slice(0, 3).map((g) => (
                    <GameCard key={g.id} game={g} />
                  ))}
                </div>
              ) : (
                <p className="card-t mt-4 p-6 text-[14.5px] text-ink-soft">
                  {player.fullName.split(" ")[0]} hasn&apos;t joined a game yet this
                  week.{" "}
                  <Link href="/games" className="font-semibold text-green">
                    Find one to join
                  </Link>
                  .
                </p>
              )}
            </section>

            <section className="card-t mt-6 p-6">
              <h2 className="text-[18px] font-bold">How reputation works</h2>
              <p className="mt-2.5 text-[14px] leading-relaxed text-ink-soft">
                Nothing on this card is self-declared. Traits come from teammates
                voting after a game. Punctuality starts at 100 and drops when you
                arrive late or don&apos;t turn up. Streaks count consecutive weeks with
                at least one game played.
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
                It exists for one reason: so hosts can tell who will actually show up,
                and so the people who reliably do get picked first.
              </p>
              <div className="mt-4 grid gap-2 text-[13.5px] text-ink-muted">
                <div>Member since {formatRelativeDay(player.joinedAt)}</div>
                <div>
                  Rated by {player.peerRatingCount} teammates across{" "}
                  {player.gamesPlayed} games
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
