import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Action } from "./ActionBarComponent";
import { cn } from "@/lib/utils";
import { play } from "@/lib/sounds";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ActionButtonProps {
  action: Action;
}

const ActionButton: React.FC<ActionButtonProps> = ({ action }) => {
  const {
    label,
    variant = "secondary",
    onClick,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    disabled = false,
    icon,
    className = "",
    isLoading = false,
    isProgressButton = false,
    progressPercent = 0,
    progressFillClassName = "bg-accent/30",
    isCircularProgress = false,
  } = action;

  const buttonContent = (
    <>
      {icon ? (
        <span className="relative z-20">{icon}</span>
      ) : (
        <span className="relative z-20 text-xs font-semibold px-2">
          {label}
        </span>
      )}

      {isLoading && <Loader2 className="absolute h-4 w-4 animate-spin z-10" />}

      <AnimatePresence>
        {isProgressButton && progressPercent > 0 && !isCircularProgress && (
          <motion.div
            key="progress-fill"
            className={cn(
              "absolute inset-0 rounded-full z-10",
              progressFillClassName,
            )}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: `${progressPercent}%`, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "linear" }}
            style={{ transformOrigin: "left" }}
          />
        )}
      </AnimatePresence>

      {isCircularProgress && isProgressButton && (
        <svg
          className="absolute inset-0 z-10"
          viewBox="0 0 36 36"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="hsl(var(--hairline))"
            strokeWidth="3"
          />
          <motion.circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            transform="rotate(-90 18 18)"
            initial={{ pathLength: progressPercent / 100 }}
            animate={{ pathLength: 1 }}
            transition={{
              duration: (action.remainingMs ?? 0) / 1000,
              ease: "linear",
            }}
          />
        </svg>
      )}
    </>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            // CSS-only press/hover feedback: a whileTap pose can strand at
            // scale 0.9 when the pointer sequence breaks (Gecko), and CSS
            // pseudo-classes cannot. Tailwind v4 gates hover: to
            // hover-capable devices, covering the old isTouchDevice check.
            className={cn(
              "relative flex h-10 shrink-0 select-none items-center justify-center overflow-hidden rounded-full transition enabled:hover:scale-110 enabled:active:scale-90",
              icon ? "w-10" : "px-4",
              // One accent-filled primary; secondary label = hairline-outline
              // pill, secondary icon = bare ink-muted button.
              variant === "primary"
                ? "bg-accent text-accent-ink hover:brightness-110"
                : icon
                  ? "text-ink-muted hover:bg-surface-2 hover:text-ink"
                  : "border border-hairline bg-surface text-ink hover:bg-surface-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              isLoading && "cursor-wait",
              className,
            )}
            aria-label={label}
            disabled={disabled || isLoading}
            onClick={onClick}
            onPointerDown={(e) => {
              play("click");
              onPointerDown?.(e);
            }}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerLeave}
            // No remount pose: buttons are keyed by label and every phase
            // change swaps the whole set, so a mount fade dipped the entire
            // bar to transparent on each action (worst on Gecko, where each
            // spring churns compositor layers). Buttons appear in place; the
            // row's layout spring still animates the resize. The old exit
            // pose was dead code — no AnimatePresence wraps the list.
            initial={false}
          >
            {buttonContent}
          </motion.button>
        </TooltipTrigger>
        {icon && (
          <TooltipContent>
            <p>{label}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};

export default ActionButton;
