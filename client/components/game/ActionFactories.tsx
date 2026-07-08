import React from "react";
import { Action } from "./ActionBarComponent";
import {
  Eye,
  CheckCircle,
  X,
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
  variant: "primary",
  onClick,
  disabled,
  icon: <Layers className="h-5 w-5" />,
});

export const createDrawDiscardAction = (
  onClick: () => void,
  disabled?: boolean,
): Action => ({
  label: "Draw from Discard",
  onClick,
  disabled,
  icon: <ArrowUpFromLine className="h-5 w-5" />,
});

export const createDiscardDrawnCardAction = (
  onClick: () => void,
  disabled?: boolean,
): Action => ({
  label: "Discard Card",
  onClick,
  disabled,
  icon: <X className="h-5 w-5" />,
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
  // Hold-to-confirm: the accent fill animates while the pointer is held so an
  // accidental click can't end your round. The label says so, otherwise a
  // quick click reads as a broken loading animation.
  label: "Hold to Check!",
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  disabled,
  className: "font-semibold tracking-wide",
  isProgressButton: showProgress,
  progressPercent,
  remainingMs,
  progressFillClassName: "bg-accent/40",
});

export const createPassMatchAction = (
  onClick: () => void,
  progressPercent: number = 0,
  remainingMs: number = 0,
  disabled?: boolean,
  isPassed: boolean = false,
  expireAt?: number,
  durationMs?: number,
): Action => ({
  label: isPassed ? "Passed" : "Pass Match",
  onClick,
  disabled: disabled || isPassed,
  icon: <Ban className="h-5 w-5" />,
  isCircularProgress: true,
  isProgressButton: true,
  progressPercent,
  remainingMs,
  expireAt,
  durationMs,
});

export const createAttemptMatchAction = (
  onClick: () => void,
  disabled?: boolean,
  _hasSelection: boolean = false,
): Action => ({
  label: "Confirm Match",
  variant: "primary",
  onClick,
  disabled,
  icon: <CheckCircle className="h-5 w-5" />,
});

export const createConfirmAbilityAction = (
  onClick: () => void,
  label: string,
  disabled?: boolean,
): Action => ({
  label,
  variant: "primary",
  onClick,
  disabled,
  icon: <CheckCircle className="h-5 w-5" />,
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
});

export const createReadyForPeekAction = (
  onClick: () => void,
  disabled?: boolean,
): Action => ({
  label: "Ready for Peek",
  variant: "primary",
  onClick,
  disabled,
  icon: <Eye className="h-5 w-5" />,
});

export const createPlayerReadyAction = (
  onClick: () => void,
  disabled?: boolean,
): Action => ({
  label: "Ready",
  variant: "primary",
  onClick,
  disabled,
  icon: <CheckCircle className="h-5 w-5" />,
});

export const createStartGameAction = (
  onClick: () => void,
  disabled?: boolean,
): Action => ({
  label: "Start Game",
  variant: "primary",
  onClick,
  disabled,
  icon: <Play className="h-5 w-5" />,
});
