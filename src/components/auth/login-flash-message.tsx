"use client";

import { useContext, useEffect, useRef } from "react";
import { ToastContext } from "@/components/toast/toast-provider";

export function LoginFlashMessage({ verified }: { verified: boolean }) {
  const toast = useContext(ToastContext);
  const fired = useRef(false);

  useEffect(() => {
    // Strict Mode runs effects twice in dev; the URL-stripping below only
    // takes effect after the first run, so without this guard the toast
    // fires twice before `verified` has a chance to go stale.
    if (!verified || !toast || fired.current) return;
    fired.current = true;

    toast.push("success", "Email verified. Sign in to continue.");

    const url = new URL(window.location.href);
    url.searchParams.delete("verified");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [toast, verified]);

  return null;
}
