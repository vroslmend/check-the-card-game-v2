import React from "react";
import { Action } from "./ActionBarComponent";
import {
  Circle,
  Eye,
  CheckCircle,
  X,
  Shuffle,
  SkipForward,
  Ban,
  Play,
  Layers,
  ArrowUpFromLine,
} from "lucide-react";

export const createDrawDeckAction = (
  onClick: () => void,
  disabled?: boolean,
): Action => ({
  label: "Draw from Deck",
  onClick,
  disabled,
  icon: <Layers className="h-5 w-5" />,
  className: "text-sky-200",
});

export const createDrawDiscardAction = (
  onClick: () => void,
  disabled?: boolean,
): Action => ({
  label: "Draw from Discard",
  onClick,
  disabled,
  icon: <ArrowUpFromLine className="h-5 w-5" />,
  className: "text-sky-200",
});

export const createDiscardDrawnCardAction = (
  onClick: () => void,
  disabled?: boolean,
): Action => ({
  label: "Discard Card",
  onClick,
  disabled,
  icon: <X className="h-5 w-5" />,
  className: "text-rose-300",
});

export const createCallCheckAction = (
  onPointerDown: React.PointerEventHandler<HTMLButtonElement>,
  onPointerUp: React.PointerEventHandler<HTMLButtonElement>,
  onPointerLeave: React.PointerEventHandler<HTMLButtonElement>,
  progressPercent: number = 0,
  remainingMs: number = 0,
  disabled?: boolean,
  showProgress?: boolean,
): Action => ({
  label: "CHECK!",
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  disabled,
  className:
    "bg-amber-400 text-black hover:bg-amber-300 dark:bg-amber-600 dark:text-white dark:hover:bg-amber-500 font-semibold tracking-wider",
  isProgressButton: showProgress,
  progressPercent,
  remainingMs,
  progressFillClassName: "bg-black/70 dark:bg-white/70",
});

export const createPassMatchAction = (
  onClick: () => void,
  progressPercent: number = 0,
  remainingMs: number = 0,
  disabled?: boolean,
  isPassed: boolean = false,
): Action => ({
  label: isPassed ? "Passed" : "Pass Match",
  onClick,
  disabled: disabled || isPassed,
  icon: <Ban className="h-5 w-5" />,
  className: "text-stone-300",
  isCircularProgress: true,
  isProgressButton: true,
  progressPercent,
  remainingMs,
});

export const createAttemptMatchAction = (
  onClick: () => void,
  disabled?: boolean,
  _hasSelection: boolean = false,
): Action => ({
  label: "Confirm Match",
  onClick,
  disabled,
  icon: <CheckCircle className="h-5 w-5" />,
  className: "text-teal-300",
});

export const createConfirmAbilityAction = (
  onClick: () => void,
  label: string,
  disabled?: boolean,
): Action => ({
  label,
  onClick,
  disabled,
  icon: <CheckCircle className="h-5 w-5" />,
  className: "text-fuchsia-300",
});

export const createSkipAbilityAction = (
  onClick: () => void,
  label: string,
  disabled?: boolean,
): Action => ({
  label,
  onClick,
  disabled,
  icon: <SkipForward className="h-5 w-5" />,
  className: "text-stone-300",
});

export const createCancelAbilityAction = (
  onClick: () => void,
  disabled?: boolean,
): Action => ({
  label: "Cancel Ability",
  onClick,
  disabled,
  icon: <Ban className="h-5 w-5" />,
  className: "text-rose-300",
});

export const createReadyForPeekAction = (
  onClick: () => void,
  disabled?: boolean,
): Action => ({
  label: "Ready for Peek",
  onClick,
  disabled,
  icon: <Eye className="h-5 w-5" />,
  className: "text-teal-300",
});

export const createPlayerReadyAction = (
  onClick: () => void,
  disabled?: boolean,
): Action => ({
  label: "Ready",
  onClick,
  disabled,
  icon: <CheckCircle className="h-5 w-5" />,
  className: "text-teal-300",
});

export const createStartGameAction = (
  onClick: () => void,
  disabled?: boolean,
): Action => ({
  label: "Start Game",
  onClick,
  disabled,
  icon: <Play className="h-5 w-5" />,
  className: "text-teal-300",
});

export const createAbilityPeekingAction = (timeLeft: number): Action => ({
  label: `Peeking... ${Math.ceil(timeLeft)}s`,
  onClick: () => {},
  disabled: true,
  className: "bg-purple-500/50 text-purple-200",
});
