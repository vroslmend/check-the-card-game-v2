import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import ActionButton from "./ActionButton";
import { useActionController } from "./ActionController";
import {
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { play } from "@/lib/sounds";

// An action is "in flight" from emit until the next server state lands; cap
// the disable so a silently-rejected action (no broadcast) can't wedge the
// bar on a slow link.
const PENDING_UNSTICK_MS = 4000;
const selectPendingSince = (s: UIMachineSnapshot) =>
  s.context.pendingActionSince;

export interface Action {
  label: string;
  /** primary = the one accent-filled pill; secondary = hairline/bare. */
  variant?: "primary" | "secondary";
  onClick?: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerUp?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  isProgressButton?: boolean;
  progressPercent?: number;
  remainingMs?: number;
  /** Absolute deadline on THIS client's clock (server timestamp already
   *  converted through serverClockOffset). When set, a circular progress ring
   *  drives itself from the wall clock every frame, so it stays locked to the
   *  server's window regardless of latency, re-renders, or tab backgrounding —
   *  the fixed-duration tween drifted (ended ~75%) and flashed full on mount. */
  expireAt?: number;
  /** Full window length in ms, for the ring's fill fraction. */
  durationMs?: number;
  progressFillClassName?: string;
  isCircularProgress?: boolean;
  progressLabelClassName?: string;
}

// Long countdown windows only surface their bar for the final stretch; a
// full-length bar from second zero reads as pressure, not help. Windows
// shorter than this (the timed peeks) show start to end.
const COUNTDOWN_REVEAL_MS = 15_000;

const ActionBarComponent: React.FC = () => {
  const { getActions, getPromptText, getTimedIndicator } =
    useActionController();
  const actions = getActions();
  const promptText = getPromptText();
  const timedIndicator = getTimedIndicator();
  const pendingSince = useUISelector(selectPendingSince);
  // Re-render once when a hidden bar's reveal moment arrives — broadcasts
  // alone won't wake this component at the right time.
  const [, forceTick] = React.useReducer((n: number) => n + 1, 0);
  const revealAt = timedIndicator
    ? timedIndicator.expireAt -
      Math.min(COUNTDOWN_REVEAL_MS, timedIndicator.durationMs)
    : null;
  React.useEffect(() => {
    if (revealAt === null) return;
    const wait = revealAt - Date.now();
    if (wait <= 0) return;
    const t = setTimeout(() => {
      forceTick();
      play("timerTail");
    }, wait + 20);
    return () => clearTimeout(t);
  }, [revealAt]);
  const isPending =
    pendingSince !== null && Date.now() - pendingSince < PENDING_UNSTICK_MS;
  // Same wake-up trick for the unstick moment.
  React.useEffect(() => {
    if (pendingSince === null) return;
    const wait = pendingSince + PENDING_UNSTICK_MS - Date.now();
    if (wait <= 0) return;
    const t = setTimeout(forceTick, wait + 20);
    return () => clearTimeout(t);
  }, [pendingSince]);
  const remainingMs = timedIndicator
    ? Math.max(0, timedIndicator.expireAt - Date.now())
    : 0;
  const countdownRevealed = revealAt !== null && Date.now() >= revealAt;

  return (
    <motion.div
      className="flex flex-col items-center w-full"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        y: { type: "spring", stiffness: 400, damping: 28 },
        opacity: { duration: 0.2 },
      }}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        className="flex flex-row flex-wrap items-center justify-center gap-2 rounded-full border border-hairline bg-surface p-2 shadow-lg"
      >
        {actions.map((action, i) => (
          <ActionButton
            key={action.label || i}
            action={isPending ? { ...action, disabled: true } : action}
          />
        ))}
      </motion.div>

      {/* Fixed-height slot: the prompt fades in place and can wrap to two
          lines without ever changing the bar's height (which would reflow
          the whole board). */}
      <div
        className="mt-2 flex h-10 items-start justify-center"
        aria-live="polite"
      >
        <AnimatePresence>
          {promptText && (
            <motion.p
              key="prompt-text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="max-w-[min(92vw,40rem)] px-4 text-center text-sm font-semibold text-ink-muted text-balance"
            >
              {promptText}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Countdown for the active timed window. Pure CSS-driven animation
          keyed by deadline: no per-frame re-renders. Fixed-height slot for
          the same no-reflow reason. */}
      {/* Grid-stacked so a re-keyed bar and its exiting predecessor overlap
          in one cell. As flex siblings they sat side by side during the
          crossfade — the new bar mounted half a bar-width off-center and
          snapped back when the exit finished (the "teleporting" bar). */}
      <div className="mt-1 grid h-1 w-full items-center justify-items-center">
        <AnimatePresence>
          {timedIndicator && remainingMs > 0 && countdownRevealed && (
            <motion.div
              key={timedIndicator.expireAt}
              className="h-0.5 w-48 max-w-[60vw] overflow-hidden rounded-full bg-hairline [grid-area:1/1]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={{
                  width: `${(remainingMs / timedIndicator.durationMs) * 100}%`,
                }}
                animate={{ width: "0%" }}
                transition={{ duration: remainingMs / 1000, ease: "linear" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ActionBarComponent;
