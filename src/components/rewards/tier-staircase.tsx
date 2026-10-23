import type { HostTier } from "@/lib/types";
import { ShieldIcon } from "@/components/icons";

const TIERS = [
  { tier: "bronze" as HostTier, label: "Bronze", range: "1–4 games", perk: "Baseline — every host starts here" },
  { tier: "silver" as HostTier, label: "Silver", range: "5–9 games", perk: "Priority placement at the same kickoff time" },
  { tier: "gold" as HostTier, label: "Gold", range: "10–19 games", perk: "Priority placement + a monthly perk credit" },
  { tier: "elite" as HostTier, label: "Elite", range: "20+ games", perk: "Priority placement + a bigger monthly perk credit" },
];

// Ascending visual weight bronze -> elite: size, border and glow all step up
// together so the ladder reads as a climb, not four equal boxes.
const STYLE: Record<HostTier, { pad: string; text: string; box: string; icon: string }> = {
  bronze: { pad: "p-3.5", text: "text-[13.5px]", box: "border-glass-border bg-glass", icon: "text-ink-muted" },
  silver: { pad: "p-4", text: "text-[14px]", box: "border-green/30 bg-green/6", icon: "text-green" },
  gold: { pad: "p-[18px]", text: "text-[14.5px]", box: "border-gold/35 bg-gold/8", icon: "text-gold" },
  elite: {
    pad: "p-5",
    text: "text-[15px]",
    box: "border-orange/40 bg-orange/10 shadow-[0_0_60px_-12px_rgba(255,90,69,0.45)]",
    icon: "text-orange",
  },
};

export function TierStaircase({ currentTier }: { currentTier?: HostTier }) {
  return (
    <div className="flex flex-col gap-2.5">
      {TIERS.map(({ tier, label, range, perk }) => {
        const style = STYLE[tier];
        const isCurrent = currentTier === tier;
        return (
          <div
            key={tier}
            className={`rounded-xl border transition ${style.pad} ${style.box} ${
              isCurrent ? "ring-2 ring-green/60" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`flex items-center gap-2 font-bold ${style.text}`}>
                <ShieldIcon size={14} className={style.icon} />
                {label}
                {isCurrent && (
                  <span className="rounded-full bg-green/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-green">
                    You
                  </span>
                )}
              </span>
              <span className="text-[12.5px] text-ink-muted">{range}</span>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{perk}</p>
          </div>
        );
      })}
    </div>
  );
}
