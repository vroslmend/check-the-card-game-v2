"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  Flag,
  Info,
  MessageCircle,
  ScrollText,
  Send,
  Shuffle,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useUIActorRef,
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { cn } from "@/lib/utils";

const MAX_CHAT_MESSAGE_LENGTH = 500;
const TAB_KEY = "check:panel-tab";
const GROUP_WINDOW_MS = 2 * 60 * 1000;

type Tab = "activity" | "chat";

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

// Same display-only glyph map as the caption rail.
const glyphFor = (message: string): LucideIcon => {
  const m = message.toLowerCase();
  if (m.includes("matched")) return Sparkles;
  if (m.includes("shuffl")) return Shuffle;
  if (m.includes("disqualified")) return Ban;
  if (m.includes("called check") || m.includes("final turn")) return Flag;
  return Info;
};

/** Keeps a scroll container pinned to the bottom as new entries arrive. */
const useStickToBottom = (dependency: number, active: boolean) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && active) el.scrollTop = el.scrollHeight;
  }, [dependency, active]);
  return ref;
};

const TabChip = ({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
      active
        ? "border border-hairline bg-surface text-ink"
        : "border border-transparent text-ink-muted hover:text-ink",
    )}
  >
    {children}
    {badge ? (
      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
        {badge > 9 ? "9+" : badge}
      </span>
    ) : null}
  </button>
);

export const SidePanel = () => {
  const { send } = useUIActorRef();
  const { isOpen, log, chat, localPlayerId } =
    useUISelector(selectSidePanelProps);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "activity";
    return (sessionStorage.getItem(TAB_KEY) as Tab) || "activity";
  });
  const chatCount = chat?.length ?? 0;

  // Chat-tab unread: counts messages that arrived while Chat wasn't visible.
  const seenRef = useRef<number>(chatCount);
  const chatVisible = isOpen && tab === "chat";
  useEffect(() => {
    if (chatVisible) seenRef.current = chatCount;
  }, [chatVisible, chatCount]);
  const unread = chatVisible ? 0 : Math.max(0, chatCount - seenRef.current);

  const pickTab = (next: Tab) => {
    setTab(next);
    sessionStorage.setItem(TAB_KEY, next);
  };

  const logRef = useStickToBottom(
    log?.length ?? 0,
    isOpen && tab === "activity",
  );
  const chatRef = useStickToBottom(chatCount, chatVisible);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (chatVisible && window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus();
    }
  }, [chatVisible]);

  const submitChat = (e: React.FormEvent) => {
    e.preventDefault();
    const message = draft.trim();
    if (!message) return;
    send({ type: "SUBMIT_CHAT_MESSAGE", message });
    setDraft("");
  };

  // Group consecutive same-sender messages within two minutes: one timestamp
  // per group, on its last message.
  const chatRows = useMemo(() => {
    const rows = chat ?? [];
    return rows.map((msg, i) => {
      const next = rows[i + 1];
      const endOfGroup =
        !next ||
        next.senderId !== msg.senderId ||
        new Date(next.timestamp).getTime() -
          new Date(msg.timestamp).getTime() >
          GROUP_WINDOW_MS;
      const prev = rows[i - 1];
      const startOfGroup =
        !prev ||
        prev.senderId !== msg.senderId ||
        new Date(msg.timestamp).getTime() -
          new Date(prev.timestamp).getTime() >
          GROUP_WINDOW_MS;
      return { msg, endOfGroup, startOfGroup };
    });
  }, [chat]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 40 }}
          className="absolute inset-y-0 right-0 z-[60] flex w-full max-w-sm flex-col border-l border-hairline bg-surface-2 font-game"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-3">
            <div className="flex items-center gap-1">
              <TabChip
                active={tab === "activity"}
                onClick={() => pickTab("activity")}
              >
                <ScrollText className="h-3.5 w-3.5" />
                Activity
              </TabChip>
              <TabChip
                active={tab === "chat"}
                onClick={() => pickTab("chat")}
                badge={unread}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Chat
              </TabChip>
            </div>
            <button
              onClick={() => send({ type: "TOGGLE_SIDE_PANEL" })}
              className="rounded-full p-2 text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              aria-label="Close side panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {tab === "activity" ? (
            <div
              ref={logRef}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3"
            >
              {log?.length ? (
                log.map((entry) => {
                  const Icon = glyphFor(entry.message);
                  return (
                    <div key={entry.id} className="flex items-start gap-2.5">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" />
                      <p className="min-w-0 flex-1 text-sm font-normal leading-snug text-ink-muted">
                        {entry.message}
                      </p>
                      <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-ink-muted/70">
                        {formatTime(entry.timestamp)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="pt-2 text-xs font-semibold uppercase tracking-widest text-ink-muted">
                  Nothing yet
                </p>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div
                ref={chatRef}
                className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3"
              >
                {chatRows.length ? (
                  chatRows.map(({ msg, endOfGroup, startOfGroup }) => {
                    const isMine = msg.senderId === localPlayerId;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex flex-col",
                          isMine ? "items-end" : "items-start",
                          endOfGroup && "pb-2",
                        )}
                      >
                        {!isMine && startOfGroup && (
                          <p className="px-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                            {msg.senderName}
                          </p>
                        )}
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-3 py-1.5",
                            isMine
                              ? "bg-ink text-ground"
                              : "border border-hairline bg-surface text-ink",
                          )}
                        >
                          <p className="break-words text-sm">{msg.message}</p>
                        </div>
                        {endOfGroup && (
                          <span className="px-1 pt-0.5 text-[10px] tabular-nums text-ink-muted/70">
                            {formatTime(msg.timestamp)}
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="pt-2 text-xs font-semibold uppercase tracking-widest text-ink-muted">
                    No messages yet
                  </p>
                )}
              </div>
              <form
                onSubmit={submitChat}
                className="flex shrink-0 items-center gap-2 border-t border-hairline p-3"
              >
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={MAX_CHAT_MESSAGE_LENGTH}
                  placeholder="Send a message..."
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
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default SidePanel;
