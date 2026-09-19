"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { sendGameChatMessageAction, type ActionState } from "@/app/actions";
import { ReportMessageButton } from "@/components/moderation/report-message-button";
import { useTableInserts } from "@/lib/supabase/realtime";
import { camelize } from "@/lib/data/case";
import { formatTime } from "@/lib/format";
import { ChatIcon } from "@/components/icons";
import type { GameChatMessage } from "@/lib/types";

const initial: ActionState = {};

export function GameChatPanel({
  gameId,
  gameSlug,
  currentUserId,
  initialMessages,
}: {
  gameId: string;
  gameSlug: string;
  currentUserId: string;
  initialMessages: GameChatMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [state, formAction, pending] = useActionState(sendGameChatMessageAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef(new Set(initialMessages.map((m) => m.id)));
  // Own messages sent optimistically, keyed by body, waiting to be reconciled
  // with the real row once realtime (or the next load) confirms it — a
  // subscription can take a moment to finish its auth handshake after
  // mount, and the sender should never have to wait on that to see their
  // own message.
  const pendingOwn = useRef<string[]>([]);

  useTableInserts<Record<string, unknown>>("game_chat_messages", `game_id=eq.${gameId}`, (raw) => {
    const row = camelize<GameChatMessage>(raw);
    if (seenIds.current.has(row.id)) return;
    seenIds.current.add(row.id);

    if (row.userId === currentUserId) {
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
      { id: `optimistic-${Date.now()}`, gameId, userId: currentUserId, body, createdAt: new Date().toISOString() },
    ]);
  }

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  // Derived, not an effect+setState: a failed send drops its optimistic
  // entry from what's rendered without needing to mutate `messages` itself
  // (state.ok stays false until the next submit, so this stays stable).
  const visibleMessages = state.ok === false ? messages.filter((m) => !m.id.startsWith("optimistic-")) : messages;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [visibleMessages.length]);

  return (
    <section className="card-t mt-6 p-6 md:p-7">
      <h2 className="flex items-center gap-2 text-[19px] font-bold">
        <ChatIcon size={19} className="text-green" />
        Match chat
      </h2>
      <p className="mt-1 text-[12.5px] text-ink-muted">
        Visible to everyone in this match. Deleted automatically 48 hours after kickoff ends.
      </p>

      <div ref={listRef} className="mt-4 max-h-[360px] space-y-3 overflow-y-auto rounded-xl border border-glass-border bg-glass/40 p-4">
        {visibleMessages.length === 0 && (
          <p className="py-6 text-center text-[13px] text-ink-muted">No messages yet — say hello.</p>
        )}
        {visibleMessages.map((m) => {
          const mine = m.userId === currentUserId;
          return (
            <div key={m.id} className={`group flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                {!mine && <span className="font-semibold text-ink-soft">{m.player?.fullName ?? "Player"}</span>}
                <span>{formatTime(m.createdAt)}</span>
              </div>
              <div
                className={`mt-0.5 max-w-[85%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug ${
                  mine ? "bg-green text-[#051530]" : "bg-white/6 text-ink"
                }`}
              >
                {m.body}
              </div>
              {!mine && (
                <ReportMessageButton
                  reportedUserId={m.userId}
                  source="game_chat"
                  contextId={gameId}
                  messageSnapshot={m.body}
                />
              )}
            </div>
          );
        })}
      </div>

      <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
        <input type="hidden" name="gameId" value={gameId} />
        <input type="hidden" name="gameSlug" value={gameSlug} />
        <input
          name="body"
          required
          maxLength={2000}
          placeholder="Message the group…"
          className="min-w-0 flex-1 rounded-full border border-glass-border bg-glass px-4 py-2.5 text-[13.5px] outline-none transition focus:border-green/50"
        />
        <button type="submit" disabled={pending} className="btn-t btn-green-t !px-5 !py-2.5 !text-[13px]">
          {pending ? "…" : "Send"}
        </button>
      </form>
      {state.ok === false && <p className="mt-2 text-[12px] text-orange">{state.error}</p>}
    </section>
  );
}
