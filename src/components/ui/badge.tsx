import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "green" | "gold" | "orange" | "blue" | "purple";

const TONE: Record<BadgeTone, string> = {
  neutral: "",
  green: "!border-green/35 !bg-green/12 !text-green",
  gold: "!border-gold/35 !bg-gold/12 !text-gold",
  orange: "!border-orange/40 !bg-orange/14 !text-orange",
  blue: "!border-blue/30 !bg-blue/10 !text-blue",
  purple: "!border-purple/35 !bg-purple/14 !text-purple",
};

export function Badge({
  tone = "neutral",
  icon,
  className = "",
  children,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`chip-t !border ${TONE[tone]} ${className}`}>
      {icon}
      {children}
    </span>
  );
}
