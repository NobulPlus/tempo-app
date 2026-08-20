/** Playtomic-style numbered circle — used for "Find. Book. Play." and any step flow. */
export function StepBadge({ n, size = 40 }: { n: number; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-green font-display text-[16px] font-extrabold text-[#04150c]"
      style={{ width: size, height: size }}
    >
      {n}
    </span>
  );
}
