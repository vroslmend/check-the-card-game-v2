import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import ActionButton from "./ActionButton";
import Magnetic from "@/components/ui/Magnetic";
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
          <Magnetic key={action.label || i} strength={20}>
            <ActionButton action={action} />
          </Magnetic>
        ))}
      </motion.div>

      <AnimatePresence mode="popLayout">
        {promptText && (
          <motion.div
            layout
            key="prompt-text"
            className="mt-2 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <p className="max-w-[min(92vw,40rem)] px-4 py-1 text-sm font-semibold text-ink-muted text-balance">
              {promptText}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Countdown for the active timed peek. Pure CSS-driven animation keyed
          by deadline: no per-frame re-renders. */}
      <AnimatePresence>
        {timedIndicator && remainingMs > 0 && (
          <motion.div
            key={timedIndicator.expireAt}
            className="mt-2 h-0.5 w-48 max-w-[60vw] overflow-hidden rounded-full bg-hairline"
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
    </motion.div>
  );
};

export default ActionBarComponent;
