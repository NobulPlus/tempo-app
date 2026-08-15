import type { Metadata } from "next";
import Link from "next/link";
import { listProfiles } from "@/lib/data/repo";
import { PunctualityRing, TraitRadar } from "@/components/player/player-card";
import { FlameIcon, StarIcon, ShieldIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Players",
  description:
    "The Tempo community — real players across Lagos with earned reputations, traits voted by teammates, and punctuality that actually means something.",
};

export default async function PlayersPage() {
  const players = await listProfiles();

  const byStreak = [...players].sort((a, b) => b.streakWeeks - a.streakWeeks);
  const byPunctuality = [...players].sort(
    (a, b) => b.punctualityScore - a.punctualityScore,
  );
  const byMotm = [...players].sort((a, b) => b.motmCount - a.motmCount);

  return (
    <div className="py-12">
      <div className="container-t">
        <h1 className="text-[clamp(32px,6vw,50px)] font-extrabold tracking-[-.03em]">
          The <span className="text-green">community</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[17px] text-ink-soft">
          Every rating here was earned in a real game. Traits are voted by
          teammates, punctuality is measured, and streaks are counted — nobody
          writes their own review.
        </p>

        {/* Leaderboards */}
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <Board
            title="Longest streaks"
            icon={<FlameIcon size={16} className="text-orange" />}
            rows={byStreak.slice(0, 5).map((p) => ({
              handle: p.handle,
              name: p.fullName,
              initials: p.initials,
              value: p.streakWeeks > 0 ? `${p.streakWeeks} wks` : "—",
            }))}
          />
          <Board
            title="Most reliable"
            icon={<ShieldIcon size={16} className="text-green" />}
            rows={byPunctuality.slice(0, 5).map((p) => ({
              handle: p.handle,
              name: p.fullName,
              initials: p.initials,
              value: `${p.punctualityScore}%`,
            }))}
          />
          <Board
            title="Man of the match"
            icon={<StarIcon size={16} className="text-gold" />}
            rows={byMotm.slice(0, 5).map((p) => ({
              handle: p.handle,
              name: p.fullName,
              initials: p.initials,
              value: `${p.motmCount}×`,
            }))}
          />
        </div>

        {/* Grid */}
        <h2 className="mt-14 text-[22px] font-bold">All players</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => (
            <Link
              key={p.id}
              href={`/players/${p.handle}`}
              className="card-t card-t-hover flex items-center gap-4 p-5"
            >
              <div className="shrink-0">
                <TraitRadar traits={p.traits} size={92} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-bold">{p.fullName}</div>
                <div className="truncate text-[12.5px] text-ink-muted">
                  @{p.handle} · {p.position ?? "—"} · {p.area ?? "Lagos"}
                </div>
                <div className="mt-2 flex items-center gap-3 text-[12.5px] text-ink-soft">
                  <span>{p.gamesPlayed} games</span>
                  {p.streakWeeks >= 4 && (
                    <span className="flex items-center gap-1 text-orange">
                      <FlameIcon size={12} />
                      {p.streakWeeks}
                    </span>
                  )}
                </div>
              </div>
              <PunctualityRing score={p.punctualityScore} size={46} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Board({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { handle: string; name: string; initials: string; value: string }[];
}) {
  return (
    <div className="card-t p-5">
      <h3 className="flex items-center gap-2 text-[15px] font-bold">
        {icon}
        {title}
      </h3>
      <ol className="mt-4 space-y-2.5">
        {rows.map((r, i) => (
          <li key={r.handle}>
            <Link href={`/players/${r.handle}`} className="group flex items-center gap-3">
              <span className="w-4 text-[12.5px] font-bold text-ink-muted">{i + 1}</span>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-green/35 bg-green/10 text-[11px] font-bold">
                {r.initials}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] group-hover:text-green">
                {r.name}
              </span>
              <span className="shrink-0 text-[13px] font-bold">{r.value}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
