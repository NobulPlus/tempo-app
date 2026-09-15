"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

export function CheckInQr({ code, label }: { code: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, code, {
      width: 148,
      margin: 1,
      color: {
        dark: "#0b1f17",
        light: "#f8fff7",
      },
    }).catch(() => undefined);
  }, [code]);

  return (
    <div className="rounded-xl border border-green/25 bg-green/8 p-3 text-center">
      <div className="mx-auto grid h-[164px] w-[164px] place-items-center rounded-lg bg-[#f8fff7] p-2">
        <canvas ref={canvasRef} width={148} height={148} aria-label={`${label} QR code`} />
      </div>
      <div className="mt-2 text-[11px] font-bold uppercase tracking-[.7px] text-ink-muted">{label}</div>
      <div className="mt-1 font-mono text-[18px] font-extrabold text-green">{code}</div>
    </div>
  );
}

type BarcodeDetectorLike = {
  detect(video: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

export function CheckInScanner({
  onCode,
  disabled,
}: {
  onCode: (code: string) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    if (!active || !supported || !videoRef.current) return;

    let cancelled = false;
    let raf = 0;
    const Detector = window.BarcodeDetector;
    if (!Detector) return;
    const detector = new Detector({ formats: ["qr_code"] });

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera access is not available here. Enter the code manually.");
          setActive(false);
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const tick = async () => {
          if (cancelled || !videoRef.current || !detector) return;
          try {
            const results = await detector.detect(videoRef.current);
            const value = results[0]?.rawValue;
            if (value) {
              onCode(value);
              setActive(false);
              return;
            }
          } catch {
            setError("Could not scan that code. Try typing it instead.");
          }
          raf = window.requestAnimationFrame(tick);
        };
        raf = window.requestAnimationFrame(tick);
      } catch {
        setError("Camera access was blocked. You can still enter the code manually.");
        setActive(false);
      }
    }

    start();

    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [active, onCode, supported]);

  if (!supported) {
    return (
      <p className="text-[12px] text-ink-muted">
        Camera QR scanning is not available in this browser. Enter the code manually.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setError(null);
          setActive((value) => !value);
        }}
        className="btn-t btn-ghost-t w-full !py-2.5 !text-[13px]"
      >
        {active ? "Stop scanner" : "Scan QR code"}
      </button>
      {active && (
        <video
          ref={videoRef}
          muted
          playsInline
          className="mt-3 aspect-video w-full rounded-xl border border-glass-border bg-black object-cover"
        />
      )}
      {error && <p className="mt-2 text-[12px] text-orange">{error}</p>}
    </div>
  );
}
