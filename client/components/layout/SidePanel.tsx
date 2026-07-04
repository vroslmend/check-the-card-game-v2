"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, ScrollText, MessageCircle } from "lucide-react";
import {
  useUISelector,
  useUIActorRef,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { cn } from "@/lib/utils";

const MAX_CHAT_MESSAGE_LENGTH = 500;

const selectSidePanelProps = (state: UIMachineSnapshot) => ({
  isOpen: state.context.isSidePanelOpen,
  log: state.context.currentGameState?.log,
  chat: state.context.currentGameState?.chat,
  localPlayerId: state.context.localPlayerId,
});

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/** Keeps a scroll container pinned to the bottom as new entries arrive. */
const useStickToBottom = (dependency: number) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dependency]);
  return ref;
};

export const SidePanel = () => {
  const { send } = useUIActorRef();
  const { isOpen, log, chat, localPlayerId } =
    useUISelector(selectSidePanelProps);
  const [draft, setDraft] = useState("");

  const logRef = useStickToBottom(log?.length ?? 0);
  const chatRef = useStickToBottom(chat?.length ?? 0);

  const submitChat = (e: React.FormEvent) => {
    e.preventDefault();
    const message = draft.trim();
    if (!message) return;
    send({ type: "SUBMIT_CHAT_MESSAGE", message });
    setDraft("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 40 }}
          className="absolute inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-hairline bg-surface-2"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-4">
            <h2 className="font-game text-lg text-ink">Activity</h2>
            <button
              onClick={() => send({ type: "TOGGLE_SIDE_PANEL" })}
              className="rounded-full p-2 text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              aria-label="Close side panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Game log */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <ScrollText className="h-3.5 w-3.5" />
              Game Log
            </div>
            <div
              ref={logRef}
              className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-2"
            >
              {log?.length ? (
                log.map((entry) => (
                  <div key={entry.id} className="flex items-baseline gap-2">
                    <span className="shrink-0 font-mono text-[10px] text-ink-muted">
                      {formatTime(entry.timestamp)}
                    </span>
                    <p className="text-sm font-normal text-ink-muted">
                      {entry.message}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-muted">
                  Nothing has happened yet.
                </p>
              )}
            </div>
          </div>

          {/* Chat */}
          <div className="flex min-h-0 flex-1 flex-col border-t border-hairline">
            <div className="flex items-center gap-2 px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <MessageCircle className="h-3.5 w-3.5" />
              Chat
            </div>
            <div
              ref={chatRef}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-2"
            >
              {chat?.length ? (
                chat.map((msg) => {
                  const isMine = msg.senderId === localPlayerId;
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-1.5",
                        isMine
                          ? "ml-auto bg-ink text-ground"
                          : "border border-hairline bg-surface text-ink",
                      )}
                    >
                      {!isMine && (
                        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
                          {msg.senderName}
                        </p>
                      )}
                      <p className="break-words text-sm">{msg.message}</p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-ink-muted">No messages yet.</p>
              )}
            </div>
            <form
              onSubmit={submitChat}
              className="flex shrink-0 items-center gap-2 border-t border-hairline p-3"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={MAX_CHAT_MESSAGE_LENGTH}
                placeholder="Send a message…"
                className="h-9 min-w-0 flex-1 rounded-full border border-hairline bg-surface px-4 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-accent"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-ground transition-opacity disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default SidePanel;
