import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, SelectField } from "@/components/ui/field";
import { StepBadge } from "@/components/ui/step-badge";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { testimonials } from "@/lib/mock/testimonials";
import { HeatPill, FillBar, GuaranteePill } from "@/components/match/match-day";
import { PinIcon, DoodleFindIcon } from "@/components/icons";
import type { MatchState } from "@/lib/types";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const COLORS: { name: string; token: string; className: string }[] = [
  { name: "Background", token: "--color-bg-primary", className: "bg-bg-primary" },
  { name: "Section band", token: "--color-bg-secondary", className: "bg-bg-secondary" },
  { name: "Card surface", token: "--color-bg-card", className: "bg-bg-card" },
  { name: "Green — brand", token: "--color-green", className: "bg-green" },
  { name: "Gold — floodlight", token: "--color-gold", className: "bg-gold" },
  { name: "Orange — hot", token: "--color-orange", className: "bg-orange" },
  { name: "Blue — cold/casual", token: "--color-blue", className: "bg-blue" },
  { name: "Purple — competitive", token: "--color-purple", className: "bg-purple" },
];

const heatState = (heat: MatchState["heat"], spotsLeft: number, filled: number, capacity: number): MatchState => ({
  filled,
  capacity,
  percent: Math.round((filled / capacity) * 100),
  spotsLeft,
  heat,
  guaranteed: heat !== "cold",
  label:
    heat === "full" ? "Locked in" : heat === "hot" ? `Filling fast — ${spotsLeft} left` : `${spotsLeft} spots open`,
  msToKickoff: 3_600_000,
  isLive: false,
  hasEnded: false,
});

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-14">
      <div className="mb-7 flex items-baseline gap-3 border-b border-glass-border pb-4">
        <span className="rounded bg-green/12 px-2 py-0.5 font-mono text-[13px] font-semibold text-green">
          {n}
        </span>
        <h2 className="font-display text-[22px] font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function SystemPage() {
  return (
    <div className="py-12">
      <div className="container-t max-w-5xl">
        <span className="chip-t !border-green/30 !bg-green/10 !text-green">Internal</span>
        <h1 className="mt-4 font-display text-[clamp(32px,6vw,50px)] font-extrabold tracking-[-.02em]">
          Tempo <span className="text-green">design system</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[17px] text-ink-soft">
          The tokens and components v2 is built from — &ldquo;matchday, not SaaS dashboard.&rdquo;
          Grounded in Footy Addicts, Playtomic, and Tempo&apos;s own pitch-green identity.
        </p>

        <Section n="01" title="Color">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {COLORS.map((c) => (
              <div key={c.token} className="card-t overflow-hidden">
                <div className={`h-20 ${c.className}`} />
                <div className="p-3">
                  <div className="text-[13px] font-semibold">{c.name}</div>
                  <div className="font-mono text-[11px] text-ink-muted">{c.token}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section n="02" title="Type">
          <div className="card-t space-y-6 p-7">
            <div>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                Display — Bricolage Grotesque
              </div>
              <div className="font-display text-[40px] font-extrabold leading-tight">
                Play football whenever you want
              </div>
            </div>
            <div>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                Accent — Caveat (sparing use, taglines only)
              </div>
              <div className="font-accent text-[32px] text-green">Lagos football, finally organised.</div>
            </div>
            <div>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                Body — Figtree
              </div>
              <div className="max-w-lg text-[16px] leading-relaxed text-ink-soft">
                Find a pitch near you. Book it in under a minute. Or join an open game
                with players who actually show up.
              </div>
            </div>
            <div>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                Mono — JetBrains Mono (prices, countdowns, tabular data)
              </div>
              <div className="font-mono text-[22px] tabular-nums">₦15,000 · 2h 14m · 7/10</div>
            </div>
          </div>
        </Section>

        <Section n="03" title="Buttons">
          <div className="card-t flex flex-wrap gap-3 p-7">
            <Button variant="primary">Join game — ₦15,000</Button>
            <Button variant="ghost">Host a game</Button>
            <Button variant="outline" size="md">
              View verification
            </Button>
            <Button variant="primary" disabled>
              Sold out
            </Button>
          </div>
        </Section>

        <Section n="04" title="Badges &amp; heat states">
          <div className="card-t flex flex-col gap-5 p-7">
            <div className="flex flex-wrap gap-2">
              <Badge tone="green" icon={<PinIcon size={12} />}>Lekki Phase 1</Badge>
              <Badge tone="gold">Warm</Badge>
              <Badge tone="orange">Hot</Badge>
              <Badge tone="blue">Casual</Badge>
              <Badge tone="purple">Competitive</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <HeatPill state={heatState("cold", 6, 4, 10)} />
              <HeatPill state={heatState("warm", 4, 6, 10)} />
              <HeatPill state={heatState("hot", 1, 9, 10)} />
              <HeatPill state={heatState("full", 0, 10, 10)} />
              <GuaranteePill guaranteed minimum={8} />
              <GuaranteePill guaranteed={false} minimum={8} />
            </div>
            <div className="max-w-sm">
              <FillBar percent={75} heat="hot" />
            </div>
          </div>
        </Section>

        <Section n="05" title="Numbered steps">
          <div className="card-t flex flex-wrap items-center gap-6 p-7">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-3">
                <StepBadge n={n} />
                <DoodleFindIcon size={26} className="text-green/70" />
              </div>
            ))}
          </div>
        </Section>

        <Section n="06" title="Cards">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card hover>
              <div className="p-5">
                <div className="text-[13px] font-semibold text-ink-soft">Default</div>
                <p className="mt-1 text-[13px] text-ink-muted">Hairline border, hover lift.</p>
              </div>
            </Card>
            <Card hover accent spokes>
              <div className="p-5">
                <div className="text-[13px] font-semibold text-ink-soft">Accent + spokes</div>
                <p className="mt-1 text-[13px] text-ink-muted">Top edge + pitch-marking overlay.</p>
              </div>
            </Card>
            <TestimonialCard {...testimonials[0]} />
          </div>
        </Section>

        <Section n="07" title="Form fields">
          <div className="card-t grid gap-5 p-7 sm:grid-cols-2">
            <Field label="Your name" placeholder="Tomiwa Adisa" />
            <SelectField label="Skill level" defaultValue="intermediate">
              <option value="casual">Casual</option>
              <option value="intermediate">Intermediate</option>
              <option value="competitive">Competitive</option>
            </SelectField>
          </div>
        </Section>
      </div>
    </div>
  );
}
