import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listPitches, getSlotsForPitch, getWalletBalance } from "@/lib/data/repo";
import { formatNaira, formatRelativeDay, formatTime } from "@/lib/format";
import { HostForm, type HostSlotOption } from "@/components/host/host-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Host a game",
  description:
    "List a game in under two minutes. Tempo handles the roster, the waitlist and the money, so you stop chasing people on WhatsApp.",
};

export default async function HostPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/host");
  const { slot: initialSlotId } = await searchParams;

  const [pitches, walletBalanceKobo] = await Promise.all([
    listPitches({ sort: "rated" }),
    getWalletBalance(user.id),
  ]);

  const slotLists = await Promise.all(
    pitches.map(async (p) => {
      const slots = await getSlotsForPitch(p.id, 30);
      return slots
        .filter((s) => s.status === "open")
        .map<HostSlotOption>((s) => ({
          ...s,
          venueName: p.venue.name,
          area: p.venue.area,
          pitchName: p.name,
          size: p.size,
        }));
    }),
  );

  const slots = slotLists
    .flat()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 240);
  const venueCount = new Set(slots.map((s) => s.venueName)).size;
  const areaCount = new Set(slots.map((s) => s.area)).size;
  const lowestPrice = slots.reduce<number | null>((min, s) => (min === null ? s.priceKobo : Math.min(min, s.priceKobo)), null);
  const nextSlot = slots[0] ?? null;

  return (
    <div className="py-12">
      <div className="container-t">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr] lg:items-end">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[.14em] text-orange">Create demand</p>
            <h1 className="mt-2 text-[clamp(34px,6vw,58px)] font-extrabold tracking-[-.035em]">
              Host a <span className="text-orange">game</span>
            </h1>
            <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
              Pick an open pitch from the calendar, pay to reserve it, set the price per player, and publish a public game players can join.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/host/manage" className="btn-t btn-ghost-t !py-2.5 !text-[13.5px]">
                Manage hosted games
              </Link>
              <Link href="/games" className="btn-t btn-ghost-t !py-2.5 !text-[13.5px]">
                See public games
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <HostStat label="Open slots" value={String(slots.length)} sub="Next 30 days" />
            <HostStat label="Venues available" value={String(venueCount)} sub={`${areaCount} area${areaCount === 1 ? "" : "s"}`} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <HostInsight
            label="Lowest pitch hire"
            value={lowestPrice === null ? "No slots" : formatNaira(lowestPrice)}
            sub="Before the 5% host service fee"
          />
          <HostInsight
            label="Next opening"
            value={nextSlot ? `${formatRelativeDay(nextSlot.startsAt)} ${formatTime(nextSlot.startsAt)}` : "No open slot"}
            sub={nextSlot ? `${nextSlot.venueName} · ${nextSlot.area}` : "Generate availability from venue dashboard"}
          />
          <HostInsight
            label="Host flow"
            value="Pay, publish, monitor"
            sub="One action reserves the pitch and creates the public game"
          />
        </div>

        <div className="mt-10">
          <HostForm slots={slots} initialSlotId={initialSlotId} walletBalanceKobo={walletBalanceKobo} />
        </div>
      </div>
    </div>
  );
}

function HostStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card-t p-5">
      <div className="text-[12px] font-semibold uppercase tracking-[.08em] text-ink-muted">{label}</div>
      <div className="mt-1 text-[30px] font-extrabold">{value}</div>
      <div className="text-[12.5px] text-ink-soft">{sub}</div>
    </div>
  );
}

function HostInsight({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-glass-border bg-glass p-4">
      <div className="text-[11px] font-bold uppercase tracking-[.1em] text-ink-muted">{label}</div>
      <div className="mt-1 text-[16px] font-extrabold">{value}</div>
      <div className="mt-0.5 text-[12px] text-ink-soft">{sub}</div>
    </div>
  );
}
