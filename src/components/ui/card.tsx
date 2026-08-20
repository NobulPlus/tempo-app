import type { HTMLAttributes, ReactNode } from "react";

/**
 * The crisp bordered surface every card in v2 sits on — `.card-t` from
 * globals.css, typed and given a variant switch instead of hand-applied
 * classnames on every page (v1's pattern).
 */
export function Card({
  hover = false,
  accent = false,
  spokes = false,
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  hover?: boolean;
  /** Thin brand-green top edge — the "kit tag" detail that replaces v1's glass glow. */
  accent?: boolean;
  /** The decorative pitch-marking overlay. */
  spokes?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`card-t ${hover ? "card-t-hover" : ""} ${accent ? "border-t-[3px] !border-t-green" : ""} ${className}`}
      {...rest}
    >
      {spokes && <span className="spokes-t" />}
      {children}
    </div>
  );
}
