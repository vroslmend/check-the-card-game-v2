import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import ActionButton from "./ActionButton";
import { useActionController } from "./ActionController";

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
  progressFillClassName?: string;
  isCircularProgress?: boolean;
  progressLabelClassName?: string;
}

const ActionBarComponent: React.FC = () => {
  const { getActions, getPromptText, getTimedIndicator } =
    useActionController();
  const actions = getActions();
  const promptText = getPromptText();
  const timedIndicator = getTimedIndicator();
  const remainingMs = timedIndicator
    ? Math.max(0, timedIndicator.expireAt - Date.now())
    : 0;

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
          <ActionButton key={action.label || i} action={action} />
        ))}
      </motion.div>

      {/* Fixed-height slot: the prompt fades in place and can wrap to two
          lines without ever changing the bar's height (which would reflow
          the whole board). */}
      <div className="mt-2 flex h-10 items-start justify-center">
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
      <div className="mt-1 flex h-1 w-full items-center justify-center">
        <AnimatePresence>
          {timedIndicator && remainingMs > 0 && (
            <motion.div
              key={timedIndicator.expireAt}
              className="h-0.5 w-48 max-w-[60vw] overflow-hidden rounded-full bg-hairline"
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
