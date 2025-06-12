import React from 'react';
import { Action } from './ActionBarComponent';
import { Circle, Eye, CheckCircle, X, Shuffle, SkipForward, Ban } from 'lucide-react';

// Card draw actions
export const createDrawDeckAction = (onClick: () => void, disabled?: boolean): Action => ({
  label: 'Draw from Deck',
  onClick,
  disabled,
  icon: <Circle className="h-5 w-5" />,
  className: 'bg-blue-600/70 hover:bg-blue-500/90 text-white',
});

export const createDrawDiscardAction = (onClick: () => void, disabled?: boolean): Action => ({
  label: 'Draw from Discard',
  onClick,
  disabled,
  icon: <Eye className="h-5 w-5" />,
  className: 'bg-indigo-600/70 hover:bg-indigo-500/90 text-white',
});

// Card discard actions
export const createDiscardDrawnCardAction = (onClick: () => void, disabled?: boolean): Action => ({
  label: 'Discard Card',
  onClick,
  disabled,
  icon: <X className="h-5 w-5" />,
  className: 'bg-red-600/70 hover:bg-red-500/90 text-white',
});

// Game control actions
export const createCallCheckAction = (
  onClick: () => void, 
  progressPercent: number = 0,
  disabled?: boolean, 
  showProgress?: boolean
): Action => ({
  label: 'Call Check',
  onClick,
  disabled,
  icon: <CheckCircle className="h-5 w-5" />,
  className: 'bg-orange-500/90 hover:bg-orange-600 text-white',
  isProgressButton: showProgress,
  progressPercent,
  progressFillClassName: 'bg-orange-400/80',
});

export const createPassMatchAction = (
  onClick: () => void, 
  progressPercent: number = 0,
  disabled?: boolean,
  isPassed: boolean = false
): Action => ({
  label: isPassed ? 'Passed - Waiting' : 'Pass Match',
  onClick,
  disabled: disabled || isPassed,
  icon: <Ban className="h-5 w-5" />,
  className: isPassed 
    ? 'bg-neutral-500 text-neutral-300' 
    : 'bg-neutral-700/70 hover:bg-neutral-600/90 text-neutral-100',
  isProgressButton: !isPassed,
  progressPercent,
  progressFillClassName: 'bg-yellow-500/80',
  progressLabelClassName: 'text-neutral-100 font-medium',
});

export const createAttemptMatchAction = (
  onClick: () => void, 
  disabled?: boolean,
  hasSelection: boolean = false
): Action => ({
  label: hasSelection ? 'Confirm Match' : 'Attempt Match',
  onClick,
  disabled,
  icon: <CheckCircle className="h-5 w-5" />,
  className: 'bg-green-500/80 hover:bg-green-600/90 text-white'
});

// Special ability actions
export const createConfirmAbilityAction = (
  onClick: () => void, 
  abilityType: string,
  stage: string,
  selectionCount: number, 
  requiredCount: number,
  disabled?: boolean
): Action => ({
  label: `${abilityType} - ${stage.toUpperCase()}: Confirm ${selectionCount}/${requiredCount}`,
  onClick,
  disabled,
  icon: <CheckCircle className="h-5 w-5" />,
  className: 'bg-purple-500/80 hover:bg-purple-600/90 text-white',
});

export const createSkipAbilityAction = (
  onClick: () => void, 
  abilityType: string,
  stage: string,
  disabled?: boolean
): Action => ({
  label: `Skip ${abilityType} ${stage}`,
  onClick,
  disabled,
  icon: <SkipForward className="h-5 w-5" />,
  className: 'bg-gray-500 hover:bg-gray-600 text-white',
});

export const createCancelAbilityAction = (onClick: () => void, disabled?: boolean): Action => ({
  label: 'Cancel Ability',
  onClick,
  disabled,
  icon: <Ban className="h-5 w-5" />,
  className: 'bg-red-500/80 hover:bg-red-600/90 text-white',
});

// Initial setup actions
export const createReadyForPeekAction = (onClick: () => void, disabled?: boolean): Action => ({
  label: 'Ready for Peek',
  onClick,
  disabled,
  icon: <Eye className="h-5 w-5" />,
  className: 'bg-sky-500 hover:bg-sky-600 text-white',
});

export const createPlayerReadyAction = (onClick: () => void, disabled?: boolean): Action => ({
  label: 'Ready',
  onClick,
  disabled,
  icon: <CheckCircle className="h-5 w-5" />,
  className: 'bg-emerald-500 hover:bg-emerald-600 text-white',
});

export const createStartGameAction = (onClick: () => void, disabled?: boolean): Action => ({
  label: 'Start Game',
  onClick,
  disabled,
  icon: <CheckCircle className="h-5 w-5" />,
  className: disabled 
    ? 'bg-neutral-500 text-neutral-300' 
    : 'bg-emerald-500 hover:bg-emerald-600 text-white',
});

export const createAbilityPeekingAction = (
  timeLeft: number
): Action => ({
  label: `Peeking... ${Math.ceil(timeLeft)}s`,
  onClick: () => {},
  disabled: true,
  className: 'bg-purple-500/50 text-purple-200',
}); 