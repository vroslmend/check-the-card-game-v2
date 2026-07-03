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
          className="absolute inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-stone-200 bg-white/95 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 px-4 dark:border-zinc-800">
            <h2 className="font-serif text-lg text-stone-900 dark:text-stone-100">
              Activity
            </h2>
            <button
              onClick={() => send({ type: "TOGGLE_SIDE_PANEL" })}
              className="rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-zinc-900 dark:hover:text-stone-100"
              aria-label="Close side panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Game log */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
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
                    <span className="shrink-0 font-mono text-[10px] text-stone-400 dark:text-stone-500">
                      {formatTime(entry.timestamp)}
                    </span>
                    <p className="text-sm text-stone-700 dark:text-stone-300">
                      {entry.message}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-stone-400 dark:text-stone-500">
                  Nothing has happened yet.
                </p>
              )}
            </div>
          </div>

          {/* Chat */}
          <div className="flex min-h-0 flex-1 flex-col border-t border-stone-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
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
                          ? "ml-auto bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900"
                          : "bg-stone-100 text-stone-800 dark:bg-zinc-900 dark:text-stone-200",
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
                <p className="text-sm text-stone-400 dark:text-stone-500">
                  No messages yet.
                </p>
              )}
            </div>
            <form
              onSubmit={submitChat}
              className="flex shrink-0 items-center gap-2 border-t border-stone-200 p-3 dark:border-zinc-800"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={MAX_CHAT_MESSAGE_LENGTH}
                placeholder="Send a message…"
                className="h-9 min-w-0 flex-1 rounded-full border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-stone-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-stone-100 dark:focus:border-zinc-600"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white transition-opacity disabled:opacity-40 dark:bg-stone-100 dark:text-stone-900"
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
