import Link from "next/link";
import { BallDetailedIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6 py-20">
      <div className="text-center">
        <BallDetailedIcon size={72} className="mx-auto text-green/30" />
        <h1 className="mt-6 text-[clamp(28px,6vw,44px)] font-extrabold tracking-[-.02em]">
          Off target
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[16px] leading-relaxed text-ink-soft">
          That page doesn&apos;t exist. It might have been a game that&apos;s already
          been played, or a pitch we no longer list.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/pitches" className="btn-t btn-green-t">
            Find a pitch
          </Link>
          <Link href="/games" className="btn-t btn-ghost-t">
            Browse games
          </Link>
        </div>
      </div>
    </div>
  );
}
