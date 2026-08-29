"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type ElementType } from "react";

/**
 * Scroll-triggered fade-up, paired with the `.reveal-on-t` CSS in globals.css.
 * Falls back to already-revealed if IntersectionObserver is unavailable so a
 * script failure never leaves content permanently invisible.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  /** Stagger delay in ms, applied via the --reveal-delay CSS var. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  // Starts false on both server and client — the server has no
  // IntersectionObserver global either, so seeding this from feature
  // detection at initial-state time causes a hydration mismatch.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // Defer so this isn't a synchronous setState inside the effect body.
      const id = setTimeout(() => setRevealed(true), 0);
      return () => clearTimeout(id);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-revealed={revealed}
      className={`reveal-on-t${className ? ` ${className}` : ""}`}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
