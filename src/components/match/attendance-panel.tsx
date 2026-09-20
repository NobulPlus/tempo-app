"use client";

import { useActionState, useCallback, useContext, useState, useTransition } from "react";
import { markGameAttendanceAction, acceptGameSlotTransferAction, declinePlayerForFutureGamesAction, scanGameCheckInAction, type ActionState } from "@/app/actions";
import { CheckInQr, CheckInScanner } from "@/components/match/check-in-qr";
import { CheckIcon, ClockIcon, ShieldIcon, AlertIcon } from "@/components/icons";
import { useActionToast } from "@/components/toast/use-action-toast";
import { ToastContext } from "@/components/toast/toast-provider";
import type { GameParticipant, PlayerProfile } from "@/lib/types";

const initial: ActionState = {};

type Participant = GameParticipant & { player: PlayerProfile };

export function AttendancePanel({
  slug,
  canManage,
  mineCode,
  participants,
  checkInCodes,
}: {
  slug: string;
  canManage: boolean;
  mineCode: string | null;
  participants: Participant[];
  checkInCodes: Array<{ participantId: string; code: string }>;
}) {
  const [state, action, pending] = useActionState(markGameAttendanceAction, initial);
  const [transferState, transferAction, transferPending] = useActionState(acceptGameSlotTransferAction, initial);
  const [declineState, declineAction, declinePending] = useActionState(declinePlayerForFutureGamesAction, initial);
  const [scanCode, setScanCode] = useState("");
  const [scanning, startScan] = useTransition();
  const toast = useContext(ToastContext);
  const handleScannedCode = useCallback((code: string) => {
    const normalized = code.trim().toUpperCase().replace(/^TEMPO-CHECKIN:/, "");
    setScanCode(normalized);
    const match = checkInCodes.find((item) => item.code.toUpperCase() === normalized);
    if (!match) {
      toast?.push("error", "That QR pass does not belong to this game.");
      return;
    }
    startScan(async () => {
      const result = await scanGameCheckInAction(match.participantId, slug, normalized);
      if (result.error) toast?.push("error", result.error);
      else toast?.push("success", result.message ?? "Player checked in.");
    });
  }, [checkInCodes, slug, toast]);
  useActionToast(state);
  useActionToast(transferState);
  useActionToast(declineState);

  return (
    <section className="card-t mt-6 p-6 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[19px] font-bold">
            <ShieldIcon size={19} className="text-green" />
            Verified attendance
          </h2>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            Roster, check-in and replacement flow stay inside Tempo.
          </p>
        </div>

        {mineCode && <CheckInQr code={mineCode} label="My check-in pass" />}
      </div>

      <form action={transferAction} className="mt-4 flex flex-col gap-2 rounded-xl border border-glass-border bg-glass p-3 sm:flex-row">
        <input type="hidden" name="slug" value={slug} />
        <input
          name="code"
          placeholder="Enter transfer code"
          className="min-w-0 flex-1 rounded-full border border-glass-border bg-bg-primary px-4 py-2.5 text-[13.5px] outline-none transition focus:border-green/50"
        />
        <button type="submit" disabled={transferPending} className="btn-t btn-ghost-t !py-2.5 !text-[13px]">
          {transferPending ? "Checking..." : "Accept transfer"}
        </button>
      </form>

      {canManage && (
        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-glass-border bg-bg-primary/35 p-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
              <div>
                <div className="text-[12px] font-bold uppercase tracking-[.7px] text-ink-muted">
                  Check-in scanner
                </div>
                <input
                  value={scanCode}
                  onChange={(event) => setScanCode(event.target.value.trim().toUpperCase())}
                  placeholder="Scan or type player code"
                  className="mt-2 w-full rounded-full border border-glass-border bg-bg-primary px-4 py-2.5 font-mono text-[13.5px] uppercase outline-none transition focus:border-green/50"
                />
                <p className="mt-2 text-[12px] text-ink-muted">
                  Select a player below after scanning. Empty code still allows a manual manager mark.
                </p>
              </div>
              <CheckInScanner onCode={handleScannedCode} disabled={pending || scanning} />
            </div>
          </div>

          {participants.map((p) => (
            <div key={p.id} className="rounded-xl border border-glass-border bg-glass p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-bold">{p.player.fullName}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
                    <span>@{p.player.handle}</span>
                    <span className="capitalize">{(p.attendanceStatus ?? "booked").replaceAll("_", " ")}</span>
                    {p.checkedInAt && <span>Checked in</span>}
                  </div>
                </div>

                <form action={action} className="flex flex-wrap gap-1.5">
                  <input type="hidden" name="participantId" value={p.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="code" value={scanCode} />
                  <button
                    type="submit"
                    name="event"
                    value="checked_in"
                    disabled={pending}
                    className="btn-t btn-ghost-t !px-3 !py-2 !text-[12px]"
                    title="Mark checked in"
                  >
                    <CheckIcon size={14} />
                    In
                  </button>
                  <button
                    type="submit"
                    name="event"
                    value="late"
                    disabled={pending}
                    className="btn-t btn-ghost-t !px-3 !py-2 !text-[12px]"
                    title="Mark late"
                  >
                    <ClockIcon size={14} />
                    Late
                  </button>
                  <button
                    type="submit"
                    name="event"
                    value="no_show"
                    disabled={pending}
                    className="btn-t btn-ghost-t !px-3 !py-2 !text-[12px]"
                    title="Mark no-show"
                  >
                    No-show
                  </button>
                  <button
                    type="submit"
                    name="event"
                    value="flagged"
                    disabled={pending}
                    className="btn-t btn-ghost-t !px-3 !py-2 !text-[12px] !text-orange"
                    title="Flag attendance issue"
                  >
                    <AlertIcon size={14} />
                    Flag
                  </button>
                </form>
                {p.status === "no_show" && (
                  <form action={declineAction}>
                    <input type="hidden" name="playerId" value={p.player.id} />
                    <button
                      type="submit"
                      disabled={declinePending}
                      className="mt-2 text-[12px] font-semibold text-orange transition hover:text-ink"
                    >
                      {declinePending ? "Updating..." : "Decline future games after 3 no-shows"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
