import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProfile, getGamesForUser } from "@/lib/data/repo";
import { PlayerCard } from "@/components/player/player-card";
import { GameCard } from "@/components/match/game-card";
import { Reveal } from "@/components/ui/reveal";
import { UsersIcon, ClockIcon, FlameIcon } from "@/components/icons";
import { formatRelativeDay } from "@/lib/format";

const REPUTATION_POINTS = [
  {
    Icon: UsersIcon,
    accent: "text-purple",
    h: "Traits",
    p: "Voted on by teammates after every game — never self-declared.",
  },
  {
    Icon: ClockIcon,
    accent: "text-green",
    h: "Punctuality",
    p: "Starts at 100. Drops when you arrive late or don't turn up.",
  },
  {
    Icon: FlameIcon,
    accent: "text-orange",
    h: "Streaks",
    p: "Counts consecutive weeks with at least one game played.",
  },
] as const;

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
            <Reveal as="section">
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
            </Reveal>

            <Reveal as="section" delay={100} className="card-t mt-6 p-6">
              <h2 className="text-[18px] font-bold">How reputation works</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                Nothing on this card is self-declared — it exists so hosts can tell
                who will actually show up.
              </p>

              <div className="mt-5 flex flex-col gap-4">
                {REPUTATION_POINTS.map(({ Icon, accent, h, p }) => (
                  <div key={h} className="flex items-start gap-3.5">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-glass ${accent}`}
                    >
                      <Icon size={17} />
                    </span>
                    <div>
                      <div className="text-[14px] font-bold">{h}</div>
                      <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-soft">{p}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-glass-border pt-5 text-center">
                <div>
                  <div className="text-[17px] font-bold">{player.peerRatingCount}</div>
                  <div className="text-[11.5px] text-ink-muted">teammates rated</div>
                </div>
                <div>
                  <div className="text-[17px] font-bold">{formatRelativeDay(player.joinedAt)}</div>
                  <div className="text-[11.5px] text-ink-muted">member since</div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}
