import type { Metadata } from "next";
import Link from "next/link";
import { ShieldIcon, PinIcon, LightsIcon, PhoneIcon, ClockIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "How verification works",
  description:
    "Every venue on Tempo is visited and inspected in person before it goes live, and re-checked every 6 months.",
};

const STEPS = [
  {
    Icon: PinIcon,
    h: "Someone visits, in person",
    p: "Before a pitch goes live on Tempo, someone from our team goes there — not a phone call, not a photo someone sent us.",
  },
  {
    Icon: LightsIcon,
    h: "The basics get checked",
    p: "Surface condition, floodlights (if the venue claims them), changing rooms and showers (if claimed), and that the space matches its listed size.",
  },
  {
    Icon: PhoneIcon,
    h: "Contact details confirmed",
    p: "We confirm the operator is reachable at the number and address listed, so \"the venue vanished\" isn't a thing that happens to you.",
  },
  {
    Icon: ClockIcon,
    h: "Re-checked every 6 months",
    p: "Verification isn't a one-time badge. Venues get re-inspected on a schedule, and sooner if players report something's off.",
  },
];

export default function VerificationPage() {
  return (
    <div className="py-12">
      <div className="container-t max-w-3xl">
        <span className="chip-t !border-green/30 !bg-green/10 !text-green">
          <ShieldIcon size={13} />
          Verified by Tempo
        </span>

        <h1 className="mt-4 text-[clamp(28px,5vw,42px)] font-extrabold tracking-[-.025em]">
          How verification works
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
          &ldquo;Verified&rdquo; is a claim we make publicly next to a venue&apos;s name, so it needs
          to mean something. Here&apos;s exactly what happens before that badge shows up.
        </p>

        <div className="mt-8 space-y-5">
          {STEPS.map(({ Icon, h, p }) => (
            <div key={h} className="card-t flex gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green/12 text-green">
                <Icon size={20} />
              </span>
              <div>
                <h3 className="text-[16px] font-bold">{h}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">{p}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[14.5px] leading-relaxed text-ink-soft">
          If a venue stops meeting the standard between checks — surface degrades,
          floodlights stop working, an operator goes unreachable — it loses the badge
          until it&apos;s re-inspected. Spotted something off at a verified venue?{" "}
          <a href="mailto:info@playtempo11.com" className="font-semibold text-green">
            Tell us
          </a>
          .
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/pitches" className="btn-t btn-green-t">
            Browse verified venues
          </Link>
          <Link href="/partner" className="btn-t btn-ghost-t">
            List your venue
          </Link>
        </div>
      </div>
    </div>
  );
}
