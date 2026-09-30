import type { Metadata } from "next";
import { TempoMark } from "@/components/icons";
import { LaunchNotifyForm } from "@/components/launch-notify-form";

export const metadata: Metadata = {
  title: "Coming soon",
  description: "Tempo is almost ready. Leave your email and we'll let you know the moment we launch.",
};

export default function ComingSoonPage() {
  return (
    <div className="grain-t relative flex min-h-[calc(100vh-71px)] items-center justify-center overflow-hidden px-6 py-20">
      <span className="spokes-t" />

      <div className="relative mx-auto max-w-xl text-center">
        <div className="mb-7 flex items-center justify-center gap-3">
          <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-green shadow-[0_4px_14px_rgba(76,141,255,.35)]">
            <TempoMark size={20} className="text-[#051530]" />
          </span>
          <span className="font-display text-[22px] font-extrabold tracking-[0.3px] text-green">
            TEMPO
          </span>
        </div>

        <p className="font-display text-[13px] font-bold tracking-[2px] text-orange">
          COMING SOON
        </p>
        <h1 className="mt-2 font-display text-[clamp(30px,5vw,46px)] font-extrabold leading-[1.1] tracking-[-.02em]">
          Lagos sport, <span className="text-gradient-brand">finally organised.</span>
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">
          We&apos;re putting the finishing touches on Tempo — find a facility,
          book a facility, and join a game, all in one place. Leave your
          email and we&apos;ll let you know the moment the doors open.
        </p>

        <div className="mt-8">
          <LaunchNotifyForm />
        </div>

        <p className="mt-10 text-[12px] text-ink-muted">
          Built in Lagos, for Lagos.
        </p>
      </div>
    </div>
  );
}
