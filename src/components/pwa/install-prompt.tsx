"use client";

import { useEffect, useState } from "react";
import { TempoMark, CloseIcon } from "@/components/icons";

const DISMISS_KEY = "tempo-install-dismissed-at";
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 2000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  const ua = window.navigator.userAgent;
  const isIPhoneFamily = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  const isTouchIPad = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return isIPhoneFamily || isTouchIPad;
}

function recentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures (private browsing, quota) — banner just
    // re-shows next visit, which is a harmless fallback.
  }
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal — the app works fully without the service worker,
        // it only improves installability and repeat-load speed.
      });
    }

    if (isStandalone() || recentlyDismissed()) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    const onInstalled = () => {
      setDeferredPrompt(null);
      setShowIOSBanner(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIOS()) {
      timer = setTimeout(() => setShowIOSBanner(true), SHOW_DELAY_MS);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "dismissed") dismiss();
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    dismiss();
    setDeferredPrompt(null);
    setShowIOSBanner(false);
  };

  if (!deferredPrompt && !showIOSBanner) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[1050] flex justify-center px-4 pt-0"
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      <div className="card-t relative flex w-full max-w-md items-start gap-3 p-4 shadow-2xl">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#06210f]"
          style={{ background: "linear-gradient(135deg, #00e676, #00c853)" }}
        >
          <TempoMark size={20} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold">Install Tempo</p>
          {deferredPrompt ? (
            <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
              Add it to your home screen for one-tap access — no browser tab required.
            </p>
          ) : (
            <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
              Tap the Share icon, then &ldquo;Add to Home Screen&rdquo; for one-tap access.
            </p>
          )}

          {deferredPrompt && (
            <button
              onClick={handleInstall}
              disabled={installing}
              className="btn-t btn-green-t mt-3 !px-4 !py-2 !text-[13px]"
            >
              {installing ? "Installing…" : "Install"}
            </button>
          )}
        </div>

        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-muted transition hover:bg-glass hover:text-ink"
        >
          <CloseIcon size={14} />
        </button>
      </div>
    </div>
  );
}
