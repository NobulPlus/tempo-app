"use client";

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "./icons";

const STORAGE_KEY = "tempo-theme";

export function ThemeToggle() {
  // Starts null so the server-rendered markup matches the client's first
  // render exactly — the anti-flash script in layout.tsx already set the
  // real attribute on <html> before this ever paints, we're just reading it.
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);

  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as "dark" | "light") || "dark");
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(STORAGE_KEY, next);
    setTheme(next);
  };

  return (
    <button
      onClick={toggle}
      className="grid h-[34px] w-[34px] place-items-center rounded-full text-ink-soft transition hover:bg-glass hover:text-ink"
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      {theme === "light" ? <MoonIcon size={17} /> : <SunIcon size={17} />}
    </button>
  );
}
