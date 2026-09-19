"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { sendDmMessageAction, markDmThreadReadAction, toggleBlockUserAction, type ActionState } from "@/app/actions";
import { ReportMessageButton } from "@/components/moderation/report-message-button";
import { useTableInserts } from "@/lib/supabase/realtime";
import { camelize } from "@/lib/data/case";
import { useActionToast } from "@/components/toast/use-action-toast";
import { formatTime, formatDayShort } from "@/lib/format";
import { ArrowRightIcon } from "@/components/icons";
import type { DmMessage, DmThread } from "@/lib/types";

const sendInitial: ActionState = {};
const blockInitial: ActionState = {};

export function DmThreadPanel({
  thread,
  currentUserId,
  initialMessages,
  isBlocked,
}: {
  thread: DmThread;
  currentUserId: string;
  initialMessages: DmMessage[];
  isBlocked: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [state, formAction, pending] = useActionState(sendDmMessageAction, sendInitial);
  const [blockState, blockAction] = useActionState(toggleBlockUserAction, blockInitial);
  const [blocked, setBlocked] = useState(isBlocked);
  useActionToast(blockState, { skipSuccess: true });

  const formRef = useRef<HTMLFormElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef(new Set(initialMessages.map((m) => m.id)));
  const pendingOwn = useRef<string[]>([]);

  useTableInserts<Record<string, unknown>>("dm_messages", `thread_id=eq.${thread.id}`, (raw) => {
    const row = camelize<DmMessage>(raw);
    if (seenIds.current.has(row.id)) return;
    seenIds.current.add(row.id);

    if (row.senderId === currentUserId) {
      const pendingIndex = pendingOwn.current.indexOf(row.body);
      if (pendingIndex !== -1) {
        pendingOwn.current.splice(pendingIndex, 1);
        setMessages((prev) => prev.map((m) => (m.id.startsWith("optimistic-") && m.body === row.body ? row : m)));
        return;
      }
    }
    setMessages((prev) => [...prev, row]);
  });

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const body = new FormData(e.currentTarget).get("body");
    if (typeof body !== "string" || !body.trim()) return;
    pendingOwn.current.push(body);
    setMessages((prev) => [
      ...prev,
      { id: `optimistic-${Date.now()}`, threadId: thread.id, senderId: currentUserId, body, createdAt: new Date().toISOString() },
    ]);
  }

  useEffect(() => {
    markDmThreadReadAction(thread.id);
  }, [thread.id]);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const visibleMessages = state.ok === false ? messages.filter((m) => !m.id.startsWith("optimistic-")) : messages;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [visibleMessages.length]);

  return (
    <div className="py-12">
      <div className="container-t max-w-2xl">
        <Link href="/messages" className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
          <ArrowRightIcon size={13} className="rotate-180" />
          Messages
        </Link>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {thread.otherPlayer.avatarUrl ? (
              <img src={thread.otherPlayer.avatarUrl} alt={thread.otherPlayer.fullName} className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-full bg-green/10 text-[13px] font-bold">
                {thread.otherPlayer.initials}
              </span>
            )}
            <div>
              <div className="text-[16px] font-bold">{thread.otherPlayer.fullName}</div>
              <div className="text-[12px] text-ink-muted">@{thread.otherPlayer.handle}</div>
            </div>
          </div>
          <form action={blockAction}>
            <input type="hidden" name="blockedId" value={thread.otherPlayer.id} />
            <input type="hidden" name="threadId" value={thread.id} />
            <button
              type="submit"
              onClick={() => setBlocked((prev) => !prev)}
              className="btn-t btn-ghost-t !px-3 !py-2 !text-[12px]"
            >
              {blocked ? "Unblock" : "Block"}
            </button>
          </form>
        </div>

        {blocked && (
          <p className="mt-3 rounded-lg border border-orange/30 bg-orange/10 px-4 py-2.5 text-[12.5px] text-orange">
            You&apos;ve blocked this player. Unblock them to send new messages.
          </p>
        )}

        <div ref={listRef} className="mt-5 max-h-[480px] space-y-3 overflow-y-auto rounded-xl border border-glass-border bg-glass/40 p-4">
          {visibleMessages.length === 0 && (
            <p className="py-8 text-center text-[13px] text-ink-muted">No messages yet — say hello.</p>
          )}
          {visibleMessages.map((m) => {
            const mine = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`group flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div className="mt-0.5 flex max-w-[85%] items-end gap-2">
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug ${
                      mine ? "bg-green text-[#051530]" : "bg-white/6 text-ink"
                    }`}
                  >
                    {m.body}
                  </div>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-muted">
                  {formatDayShort(m.createdAt)} · {formatTime(m.createdAt)}
                  {!mine && (
                    <ReportMessageButton
                      reportedUserId={m.senderId}
                      source="direct_message"
                      contextId={thread.id}
                      messageSnapshot={m.body}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
          <input type="hidden" name="threadId" value={thread.id} />
          <input
            name="body"
            required
            maxLength={2000}
            disabled={blocked}
            placeholder={blocked ? "Unblock to send a message" : "Type a message…"}
            className="min-w-0 flex-1 rounded-full border border-glass-border bg-glass px-4 py-2.5 text-[13.5px] outline-none transition focus:border-green/50 disabled:opacity-50"
          />
          <button type="submit" disabled={pending || blocked} className="btn-t btn-green-t !px-5 !py-2.5 !text-[13px]">
            {pending ? "…" : "Send"}
          </button>
        </form>
        {state.ok === false && <p className="mt-2 text-[12px] text-orange">{state.error}</p>}
      </div>
    </div>
  );
}
