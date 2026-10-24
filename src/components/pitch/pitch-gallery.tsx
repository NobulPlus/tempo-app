"use client";

import { useState } from "react";
import Image from "next/image";

export function PitchGallery({
  photos,
  badges,
}: {
  photos: string[];
  badges: React.ReactNode;
}) {
  const [active, setActive] = useState(0);
  const photo = photos[active];

  return (
    <div>
      <div className="relative h-[210px] md:h-[280px]">
        {photo && <Image src={photo} alt="" fill unoptimized className="object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-bg-card/10 to-transparent" />
        <div className="absolute inset-x-5 top-5 flex flex-wrap gap-2">{badges}</div>
        {photos.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] font-semibold text-white">
            {active + 1} / {photos.length}
          </span>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-b border-glass-border bg-glass p-3">
          {photos.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1} of ${photos.length}`}
              aria-current={active === i}
              className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                active === i ? "border-green" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <Image src={src} alt="" fill unoptimized className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
