import Link from "next/link";
import type { PlayerProfile, PlayerTraits } from "@/lib/types";
import { FlameIcon, StarIcon, ShieldIcon, BallIcon } from "@/components/icons";

/* ---------------------------------------------------------------- traits -- */

const TRAIT_ORDER: (keyof PlayerTraits)[] = [
  "pace",
  "passing",
  "finishing",
  "defending",
  "stamina",
  "teamwork",
];

const TRAIT_LABEL: Record<keyof PlayerTraits, string> = {
  pace: "PAC",
  passing: "PAS",
  finishing: "FIN",
  defending: "DEF",
  stamina: "STA",
  teamwork: "TMW",
};

/**
 * Hexagon radar. Every value here is peer-voted — nobody sets their own pace
 * rating, which is what stops it being a vanity toy.
 */
export function TraitRadar({
  traits,
  size = 190,
}: {
  traits: PlayerTraits;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 26;

  const point = (i: number, value: number) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const dist = (value / 100) * r;
    return [cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist];
  };

  const rings = [0.25, 0.5, 0.75, 1].map((f) =>
    TRAIT_ORDER.map((_, i) => point(i, f * 100).join(",")).join(" "),
  );

  const shape = TRAIT_ORDER.map((k, i) => point(i, traits[k]).join(",")).join(" ");
  const avg = Math.round(
    TRAIT_ORDER.reduce((s, k) => s + traits[k], 0) / TRAIT_ORDER.length,
  );

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`Trait profile, overall ${avg}`}>
        {rings.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="rgba(139,151,138,.18)"
            strokeWidth={1}
          />
        ))}
        {TRAIT_ORDER.map((_, i) => {
          const [x, y] = point(i, 100);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="rgba(139,151,138,.16)"
              strokeWidth={1}
            />
          );
        })}

        <polygon
          points={shape}
          fill="rgba(23,185,92,.24)"
          stroke="#17b95c"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {TRAIT_ORDER.map((k, i) => {
          const [x, y] = point(i, traits[k]);
          return <circle key={k} cx={x} cy={y} r={3} fill="#17b95c" />;
        })}

        {TRAIT_ORDER.map((k, i) => {
          const [x, y] = point(i, 128);
          return (
            <text
              key={k}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fontWeight="700"
              fill="#8b978a"
            >
              {TRAIT_LABEL[k]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/* --------------------------------------------------------------- streaks -- */

export function StreakBadge({ weeks, longest }: { weeks: number; longest: number }) {
  if (weeks === 0) {
    return (
      <div className="rounded-xl border border-glass-border bg-glass p-3">
        <div className="text-[12px] text-ink-muted">Streak</div>
        <div className="mt-0.5 text-[15px] font-semibold text-ink-soft">Not playing</div>
        <div className="mt-0.5 text-[11.5px] text-ink-muted">Best: {longest} weeks</div>
      </div>
    );
  }

  const hot = weeks >= 8;
  return (
    <div
      className={`rounded-xl border p-3 ${
        hot ? "border-orange/35 bg-orange/10" : "border-green/25 bg-green/8"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
        <FlameIcon
          size={13}
          className={hot ? "animate-[flame_2.4s_ease-in-out_infinite] text-orange" : "text-green"}
        />
        Streak
      </div>
      <div className={`mt-0.5 text-[19px] font-extrabold ${hot ? "text-orange" : "text-green"}`}>
        {weeks} <span className="text-[13px] font-semibold">weeks</span>
      </div>
      <div className="mt-0.5 text-[11.5px] text-ink-muted">Best: {longest} weeks</div>
    </div>
  );
}

/** Punctuality as a ring — the number that decides if hosts want you. */
export function PunctualityRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const colour = score >= 90 ? "#17b95c" : score >= 75 ? "#f5a623" : "#ff5a45";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth={5}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[15px] font-bold" style={{ color: colour }}>
        {score}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------ full card --- */

const POSITION_LABEL: Record<string, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

export function PlayerCard({ player }: { player: PlayerProfile }) {
  const overall = Math.round(
    TRAIT_ORDER.reduce((s, k) => s + player.traits[k], 0) / TRAIT_ORDER.length,
  );

  return (
    <div className="card-t relative overflow-hidden p-6">
      <span className="spokes-t" />

      <div className="relative flex flex-col items-center text-center">
        <div className="relative">
          <span className="grid h-20 w-20 place-items-center rounded-full border-2 border-green bg-green/10 text-[26px] font-extrabold">
            {player.initials}
          </span>
          <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-bg-primary bg-green text-[12px] font-extrabold text-[#04150c]">
            {overall}
          </span>
        </div>

        <h2 className="mt-3 text-[21px] font-bold">{player.fullName}</h2>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-[13px] text-ink-soft">
          <span>@{player.handle}</span>
          {player.position && (
            <>
              <span className="text-ink-muted">·</span>
              <span>{POSITION_LABEL[player.position]}</span>
            </>
          )}
          {player.foot && (
            <>
              <span className="text-ink-muted">·</span>
              <span className="capitalize">{player.foot} footed</span>
            </>
          )}
        </div>
        {player.area && <div className="mt-1 text-[13px] text-ink-muted">{player.area}</div>}

        {player.bio && (
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-ink-soft">{player.bio}</p>
        )}
      </div>

      <div className="relative mt-6 flex justify-center">
        <TraitRadar traits={player.traits} />
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<BallIcon size={14} />} label="Games" value={String(player.gamesPlayed)} />
        <Stat
          icon={<StarIcon size={14} className="text-gold" />}
          label="Rating"
          value={player.peerRating ? player.peerRating.toFixed(1) : "—"}
          sub={player.peerRatingCount ? `${player.peerRatingCount} votes` : "No votes yet"}
        />
        <Stat icon={<ShieldIcon size={14} />} label="MOTM" value={String(player.motmCount)} />
        <div className="rounded-xl border border-glass-border bg-glass p-3">
          <div className="text-[12px] text-ink-muted">Punctuality</div>
          <div className="mt-1 flex items-center gap-2">
            <PunctualityRing score={player.punctualityScore} size={44} />
          </div>
        </div>
      </div>

      <div className="relative mt-3">
        <StreakBadge weeks={player.streakWeeks} longest={player.longestStreakWeeks} />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-glass-border bg-glass p-3">
      <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-[19px] font-extrabold">{value}</div>
      {sub && <div className="text-[11.5px] text-ink-muted">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------ mini card --- */

export function PlayerChip({ player, note }: { player: PlayerProfile; note?: string }) {
  return (
    <Link
      href={`/players/${player.handle}`}
      className="group flex items-center gap-2.5 rounded-xl border border-glass-border bg-glass p-2.5 transition hover:border-green/30 hover:bg-green/6"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-green/35 bg-green/10 text-[12px] font-bold">
        {player.initials}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[13.5px] font-semibold group-hover:text-green">
          {player.fullName}
        </span>
        <span className="block truncate text-[11.5px] text-ink-muted">
          {note ?? `${player.position ?? "—"} · ${player.gamesPlayed} games`}
        </span>
      </span>
      {player.streakWeeks >= 4 && (
        <FlameIcon size={13} className="ml-auto shrink-0 text-orange" />
      )}
    </Link>
  );
}
