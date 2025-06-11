"use client"

import React from 'react';
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useState, useRef } from "react"
import { CheckCircle, Circle, Eye, Shuffle, Ban, X, GitCommitHorizontal, SkipForward, Search, Flag, Check, HelpCircle, AlertTriangle } from "lucide-react"
import { useUI } from "@/components/providers/UIMachineProvider"
import { type UIMachineEvents } from "@/machines/uiMachine"
import Magnetic from "../ui/Magnetic";
import { GameStage, TurnPhase, CardRank, PlayerActionType } from "shared-types"
import { toast } from 'sonner';
import logger from '@/lib/logger';

type ActionButton = {
  id: string;
  label: string; 
  icon: React.ElementType; 
  event: UIMachineEvents;
  holdToConfirm?: boolean; 
  variant?: 'ghost' | 'default' | 'destructive' | 'outline' | 'secondary' | 'link';
  disabled?: boolean;
};

export function GameActionControls() {
  const [state, send] = useUI();
  const { localPlayerId, currentGameState, abilityContext } = state.context;

  if (!currentGameState || !currentGameState.players || !localPlayerId) {
    return null;
  }

  const localPlayer = currentGameState.players[localPlayerId];
  if (!localPlayer) return null;

  const isMyTurn = currentGameState.currentPlayerId === localPlayerId;
  const isAbilityPlayer = abilityContext?.playerId === localPlayerId;

  const [holdingAction, setHoldingAction] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleAction = (event: UIMachineEvents) => {
    logger.debug({ event }, 'Game action sent');
    send(event);
  };

  const startHold = (button: ActionButton) => {
    if (button.disabled) return;
    logger.debug({ buttonId: button.id }, 'Hold action started');
    setHoldingAction(button.id);
    setHoldProgress(0);

    progressIntervalRef.current = setInterval(() => {
      setHoldProgress((prev) => {
        const newProgress = prev + 2;
        if (newProgress >= 100) {
          completeHold(button.event);
          return 100;
        }
        return newProgress;
      });
    }, 20);

    holdTimeoutRef.current = setTimeout(() => completeHold(button.event), 1000);
  };

  const completeHold = (event: UIMachineEvents) => {
    clearHold();
    handleAction(event);
  };

  const clearHold = () => {
    setHoldingAction(null);
    setHoldProgress(0);
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  const getAvailableActions = (): ActionButton[] => {
    const actions: ActionButton[] = [];

    // Check for ability state using the current state value
    const stateValue = state.value as any;
    const inAbilityState = stateValue?.inGame?.playing === 'ability';

    // --- Ability Actions ---
    if (inAbilityState && isAbilityPlayer && abilityContext) {
      const abilityActions: ActionButton[] = [];
      if (abilityContext.stage === 'peeking') {
        const requiredCount = abilityContext.maxPeekTargets;
        const selectedCount = abilityContext.selectedPeekTargets.length;
        abilityActions.push({
          id: 'confirm-peek',
          label: `Confirm Peek (${selectedCount}/${requiredCount})`,
          icon: CheckCircle,
          event: { type: 'CONFIRM_ABILITY_ACTION' },
          disabled: selectedCount !== requiredCount,
        });
        if (abilityContext.type === 'king' || abilityContext.type === 'peek') {
            abilityActions.push({ id: 'skip-peek', label: 'Skip Peek', icon: SkipForward, event: { type: 'SKIP_ABILITY_STAGE' } });
        }
      } else if (abilityContext.stage === 'swapping') {
        const requiredCount = 2;
        const selectedCount = abilityContext.selectedSwapTargets.length;
        abilityActions.push({
          id: 'confirm-swap',
          label: `Confirm Swap (${selectedCount}/${requiredCount})`,
          icon: Shuffle,
          event: { type: 'CONFIRM_ABILITY_ACTION' },
          disabled: selectedCount !== requiredCount,
        });
        abilityActions.push({ id: 'skip-swap', label: 'Skip Swap', icon: SkipForward, event: { type: 'SKIP_ABILITY_STAGE' } });
      }

      abilityActions.push({ id: 'cancel-ability', label: 'Cancel', icon: Ban, event: { type: 'CANCEL_ABILITY' } });
      return abilityActions;
    }

    // --- Matching Phase Actions ---
    if (currentGameState.turnPhase === TurnPhase.MATCHING) {
      actions.push({
        id: 'pass-on-match',
        label: 'Pass',
        icon: Ban,
        event: { type: 'PASS_ON_MATCH' },
      });
    }

    // --- Lobby Actions ---
    if (currentGameState.gameStage === GameStage.WAITING_FOR_PLAYERS) {
      if (!localPlayer.isReady) {
        actions.push({ id: 'player-ready', label: 'Declare Ready', icon: CheckCircle, event: { type: 'PLAYER_READY' } });
      }
      if (currentGameState.gameMasterId === localPlayerId) {
        const allPlayersReady = Object.values(currentGameState.players).every(p => p.isReady);
        actions.push({ id: 'start-game', label: 'Start Game', icon: CheckCircle, event: { type: 'START_GAME' }, disabled: !allPlayersReady });
      }
    }
    
    // --- Initial Peek Action ---
    if (currentGameState.gameStage === GameStage.INITIAL_PEEK && !localPlayer.isReady) {
      actions.push({ id: 'ready-peek', label: 'Done Peeking', icon: Eye, event: { type: 'DECLARE_READY_FOR_PEEK_CLICKED' } });
    }

    // --- Turn-based Actions ---
    if (isMyTurn && currentGameState.turnPhase) {
      const turnPhase = currentGameState.turnPhase;
      if (turnPhase === TurnPhase.DRAW) {
        actions.push({ id: 'draw-deck', label: 'Draw from Deck', icon: Circle, event: { type: 'DRAW_FROM_DECK' } });
        
        const topOfDiscard = currentGameState.discardPile[currentGameState.discardPile.length - 1];
        const isDiscardDrawable = topOfDiscard && !new Set([CardRank.King, CardRank.Queen, CardRank.Jack]).has(topOfDiscard.rank);
        actions.push({
          id: 'draw-discard',
          label: 'Draw from Discard',
          icon: Eye,
          event: { type: 'DRAW_FROM_DISCARD' },
          disabled: !isDiscardDrawable
        });

        actions.push({
            id: 'call-check',
            label: 'Call Check!',
            icon: CheckCircle,
            event: { type: 'CALL_CHECK' },
            holdToConfirm: true
        });
      } else if (turnPhase === TurnPhase.DISCARD && localPlayer.pendingDrawnCard) {
        actions.push({
            id: 'discard-drawn',
            label: 'Discard Drawn Card',
            icon: X,
            event: { type: 'DISCARD_DRAWN_CARD' }
        });
      }
    }

    return actions;
  }

  const getInstructionText = (): string => {
    const stateValue = state.value as any;
    const inAbilityState = stateValue?.inGame?.playing === 'ability';

    if (inAbilityState && isAbilityPlayer && abilityContext) {
      if (abilityContext.stage === 'peeking') {
        return `You used a ${abilityContext.type}. Select ${abilityContext.maxPeekTargets} card(s) to peek at.`;
      }
      if (abilityContext.stage === 'swapping') {
        const selectedCount = abilityContext.selectedSwapTargets.length;
        if (selectedCount === 0) return `You used a ${abilityContext.type}. Select the first card to swap.`;
        if (selectedCount === 1) return `First card selected. Now select the second card to swap.`;
        return `Confirm or cancel your swap.`;
      }
    }

    if (currentGameState.gameStage === GameStage.WAITING_FOR_PLAYERS) {
      return "Waiting for players to ready up...";
    }
    if (currentGameState.gameStage === GameStage.INITIAL_PEEK) {
      if (!localPlayer.isReady) return "Memorize your bottom two cards.";
      return "Waiting for other players to finish peeking...";
    }
    if (currentGameState.gameStage === GameStage.PLAYING) {
      if (currentGameState.turnPhase === TurnPhase.MATCHING) {
        const cardToMatch = currentGameState.matchingOpportunity?.cardToMatch;
        return `Matching opportunity on a ${cardToMatch?.rank}. Click a card to match, or pass.`;
      }
      if (isMyTurn) {
        if (currentGameState.turnPhase === TurnPhase.DRAW) {
          return "It's your turn. Draw a card, or call Check.";
        }
        if (currentGameState.turnPhase === TurnPhase.DISCARD) {
          return "You've drawn a card. Discard it, or click a card from your hand to swap with it.";
        }
      }
    }
    
    const currentPlayerId = currentGameState.currentPlayerId;
    if (!currentPlayerId) return "Waiting for game to start...";
    
    const currentPlayerName = currentGameState.players[currentPlayerId]?.name ?? 'Opponent';
    return `Waiting for ${currentPlayerName}...`;
  }

  const actions = getAvailableActions().map(action => ({ ...action, variant: 'ghost' as const, disabled: action.disabled }));
  const instructionText = getInstructionText();

  const handleCallCheck = () => {
    if (!localPlayerId) return;
    logger.debug('Call Check button clicked');
    send({ type: 'CALL_CHECK' });
  };
  
  const handleShowRules = () => {
    send({ type: 'TOGGLE_SIDE_PANEL' });
  };

  return (
    <motion.div className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
       <AnimatePresence mode="wait">
        <motion.div
          key={instructionText}
          className="rounded-lg border border-stone-200/30 bg-stone-100/20 p-3 text-center dark:border-stone-800/30 dark:bg-stone-900/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <p className="text-sm font-light text-stone-600 dark:text-stone-400">{instructionText}</p>
        </motion.div>
      </AnimatePresence>

      <div className="rounded-lg border border-stone-200/50 bg-stone-100/10 p-4 dark:border-stone-800/50 dark:bg-stone-900/10 min-h-[80px]">
        <div className="flex flex-wrap justify-center gap-3">
          <AnimatePresence>
            {actions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <Magnetic key={action.id}>
                  <motion.div
                    layout
                    className="relative"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2, type: 'spring', stiffness: 260, damping: 20 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {action.holdToConfirm ? (
                      <div className="relative">
                        <Button
                          variant={action.variant}
                          disabled={action.disabled}
                          className="relative min-w-[140px] overflow-hidden text-sm font-light transition-all duration-200"
                          onMouseDown={() => startHold(action)}
                          onMouseUp={clearHold}
                          onMouseLeave={clearHold}
                          onTouchStart={() => startHold(action)}
                          onTouchEnd={clearHold}
                        >
                          <span className="relative z-10 flex items-center gap-2">
                            {holdingAction === action.id ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}><ActionIcon className="h-3 w-3" /></motion.div> : <><ActionIcon className="h-3 w-3" />{action.label}</>}
                          </span>
                          <motion.div
                            className="absolute bottom-0 left-0 top-0 bg-stone-900/10 dark:bg-stone-100/10"
                            initial={{ width: "0%" }}
                            animate={{ width: holdingAction === action.id ? `${holdProgress}%` : "0%" }}
                            transition={{ duration: 0.1, ease: "linear" }}
                          />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant={action.variant}
                        disabled={action.disabled}
                        className="min-w-[140px] text-sm font-light"
                        onClick={() => handleAction(action.event)}
                      >
                         <ActionIcon className="h-3 w-3 mr-2" />
                        {action.label}
                      </Button>
                    )}
                  </motion.div>
                </Magnetic>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex justify-center w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={`controls-${currentGameState.gameStage}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex gap-3">
              {!isMyTurn && currentGameState.gameStage === GameStage.PLAYING && (
                <Button 
                  variant="outline" 
                  size="lg"
                  className="flex items-center gap-1.5 border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50" 
                  onClick={handleCallCheck}
                >
                  <Flag className="h-4 w-4" />
                  <span>Call Check!</span>
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="sm"
                className="flex items-center gap-1.5" 
                onClick={handleShowRules}
              >
                <HelpCircle className="h-4 w-4" />
                <span>Rules</span>
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}