import Image from "next/image";
import { QuoteIcon, StarIcon } from "@/components/icons";
import type { Testimonial } from "@/lib/mock/testimonials";

export function TestimonialCard({ quote, name, area, rating, avatarUrl }: Testimonial) {
  return (
    <div className="card-t p-6">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-orange text-[#2a0d06]">
        <QuoteIcon size={16} />
      </span>

      <div className="mt-3 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon key={i} size={13} className={i < rating ? "text-gold" : "text-ink-muted/40"} />
        ))}
      </div>

      <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">&ldquo;{quote}&rdquo;</p>

      <div className="mt-5 flex items-center gap-3 border-t border-glass-border pt-4">
        <Image
          src={avatarUrl}
          alt=""
          width={36}
          height={36}
          className="rounded-full"
          unoptimized
        />
        <div className="leading-tight">
          <div className="text-[13.5px] font-semibold">{name}</div>
          <div className="text-[12px] text-ink-muted">{area}</div>
        </div>
      </div>
    </div>
  );
}
