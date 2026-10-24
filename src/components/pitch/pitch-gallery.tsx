"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronDownIcon, CloseIcon } from "@/components/icons";

export function PitchGallery({
  photos,
  badges,
}: {
  photos: string[];
  badges: React.ReactNode;
}) {
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const photo = photos[active];

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") setActive((i) => (i + 1) % photos.length);
      if (e.key === "ArrowLeft") setActive((i) => (i - 1 + photos.length) % photos.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxOpen, photos.length]);

  return (
    <div>
      <div className="relative h-[210px] md:h-[280px]">
        {photo && (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="View full-size photo"
            className="absolute inset-0 h-full w-full cursor-zoom-in"
          >
            <Image src={photo} alt="" fill unoptimized className="object-cover" />
          </button>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-card via-bg-card/10 to-transparent" />
        <div className="pointer-events-none absolute inset-x-5 top-5 flex flex-wrap gap-2">{badges}</div>
        {photo && (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1 text-[11.5px] font-semibold text-white transition hover:bg-black/70"
          >
            {photos.length > 1 ? `View all ${photos.length} photos` : "View full photo"}
          </button>
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

      {lightboxOpen && photo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-[2000] flex flex-col bg-black/92 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="flex items-center justify-between p-4 text-white">
            <span className="text-[13.5px] font-semibold">
              {active + 1} / {photos.length}
            </span>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
            >
              <CloseIcon size={16} />
            </button>
          </div>

          <div className="relative flex-1 px-4 pb-4">
            <Image src={photo} alt="" fill unoptimized className="object-contain" />

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActive((i) => (i - 1 + photos.length) % photos.length);
                  }}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6"
                >
                  <ChevronDownIcon size={18} className="rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActive((i) => (i + 1) % photos.length);
                  }}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6"
                >
                  <ChevronDownIcon size={18} className="-rotate-90" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
