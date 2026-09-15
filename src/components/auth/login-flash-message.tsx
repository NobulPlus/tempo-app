"use client";

import { useContext, useEffect } from "react";
import { ToastContext } from "@/components/toast/toast-provider";

export function LoginFlashMessage({ verified }: { verified: boolean }) {
  const toast = useContext(ToastContext);

  useEffect(() => {
    if (!verified || !toast) return;

    toast.push("success", "Email verified. Sign in to continue.");

    const url = new URL(window.location.href);
    url.searchParams.delete("verified");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [toast, verified]);

  return null;
}
