"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  TempoMark,
  HomeIcon,
  PitchIcon,
  BallIcon,
  UserIcon,
  MenuIcon,
  CloseIcon,
  BellIcon,
} from "./icons";
import type { PlayerProfile } from "@/lib/types";

const LINKS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/pitches", label: "Pitches", Icon: PitchIcon },
  { href: "/games", label: "Games", Icon: BallIcon },
];

export function Nav({ user }: { user: PlayerProfile | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer on navigation — the prototype's burger had no handler at all
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock scroll behind the drawer
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[1100] h-[71px] border-b border-white/8 bg-white/5 backdrop-blur-[20px]">
        <div className="mx-auto flex h-full max-w-[1400px] items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="Tempo home">
            <span className="grid h-[38px] w-[38px] place-items-center rounded-[11px] bg-gradient-to-br from-[#00e676] to-[#00c853] shadow-[0_4px_14px_rgba(0,200,83,.35)]">
              <TempoMark size={20} className="text-[#06210f]" />
            </span>
            <span className="text-[22px] font-extrabold tracking-[0.5px] text-green">TEMPO</span>
          </Link>

          {/* Desktop nav */}
          <nav className="mx-auto hidden items-center gap-1 rounded-full bg-white/3 p-1 md:flex">
            {LINKS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full px-[18px] py-[9px] text-[14.5px] transition ${
                  isActive(href)
                    ? "bg-green/14 font-semibold text-green"
                    : "font-medium text-ink-soft hover:bg-white/5 hover:text-ink"
                }`}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
            <Link
              href={user ? "/dashboard" : "/login"}
              aria-current={isActive("/dashboard") ? "page" : undefined}
              className={`flex items-center gap-2 rounded-full px-[18px] py-[9px] text-[14.5px] transition ${
                isActive("/dashboard")
                  ? "bg-green/14 font-semibold text-green"
                  : "font-medium text-ink-soft hover:bg-white/5 hover:text-ink"
              }`}
            >
              <UserIcon size={17} />
              {user ? "My Games" : "Sign in"}
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="hidden h-[34px] w-[34px] place-items-center rounded-full text-ink-soft transition hover:bg-white/6 hover:text-ink sm:grid"
                  aria-label="Notifications"
                >
                  <BellIcon size={18} />
                </Link>
                <Link
                  href={`/players/${user.handle}`}
                  className="grid h-9 w-9 place-items-center rounded-full border-[1.5px] border-green bg-green/8 text-[13px] font-bold"
                  aria-label={`Your profile, ${user.fullName}`}
                >
                  {user.initials}
                </Link>
              </>
            ) : (
              <Link href="/signup" className="btn-t btn-green-t hidden !px-6 !py-2.5 !text-sm sm:inline-flex">
                Get started
              </Link>
            )}

            <button
              className="grid h-[34px] w-[34px] place-items-center rounded-full text-ink-soft transition hover:bg-white/6 hover:text-ink md:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer — this is the feature the prototype advertised and never wired up */}
      {open && (
        <div className="fixed inset-0 z-[1090] md:hidden">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <nav className="absolute inset-x-0 top-[71px] border-b border-white/10 bg-[#0d1425]/95 p-4 backdrop-blur-xl">
            <ul className="flex flex-col gap-1">
              {[...LINKS, { href: user ? "/dashboard" : "/login", label: user ? "My Games" : "Sign in", Icon: UserIcon }].map(
                ({ href, label, Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-[15px] transition ${
                        isActive(href)
                          ? "bg-green/14 font-semibold text-green"
                          : "text-ink-soft hover:bg-white/5"
                      }`}
                    >
                      <Icon size={19} />
                      {label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
            <div className="mt-3 grid gap-2">
              <Link href="/host" className="btn-t btn-ghost-t w-full !py-3.5 !text-sm">
                Host a game
              </Link>
              {!user && (
                <Link href="/signup" className="btn-t btn-green-t w-full !py-3.5 !text-sm">
                  Create account
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
