"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useState, useRef } from "react"
import { CheckCircle, Circle, Eye, Shuffle, Ban, X, Search, GitCommitHorizontal } from "lucide-react"
import { useUI } from "@/components/providers/UIMachineProvider"
import { type UIMachineEvent } from "@/machines/uiMachine"
import Magnetic from "../ui/Magnetic";
import { CardRank, GameStage, TurnPhase } from "shared-types"

type ActionButton = {
  id: string;
  label: string; 
  icon: React.ElementType; 
  event: UIMachineEvent;
  holdToConfirm?: boolean; 
  variant?: 'ghost' | 'default' | 'destructive' | 'outline' | 'secondary' | 'link';
  disabled?: boolean;
};

export function GameActionControls() {
  const [state, send] = useUI();

  const {
    localPlayerId,
    currentGameState,
    abilityContext,
  } = state.context;

  // Comprehensive guard to prevent crashes on initial render
  if (!currentGameState || !currentGameState.players) {
    return null; // Or a loading spinner, but null is safest for now
  }

  const localPlayer = localPlayerId ? currentGameState.players[localPlayerId] : null;
  const isMyTurn = currentGameState.currentPlayerId === localPlayerId;

  const [holdingAction, setHoldingAction] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleAction = (event: UIMachineEvent) => {
    send(event);
  };

  const startHold = (button: ActionButton) => {
    if (button.disabled) return;
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

  const completeHold = (event: UIMachineEvent) => {
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
    if (!currentGameState || !localPlayer || !localPlayerId) return [];

    const actions: ActionButton[] = [];
    
    if (state.matches({ inGame: { connected: { ability: 'collectingInput' } } }) || state.matches({ inGame: { connected: { ability: 'confirming' } } })) {
      if (abilityContext?.type === 'peek') {
        const { payload } = abilityContext;
        const requiredCount = 1;
        const selectedCount = payload.targetPlayerId ? 1 : 0;
        actions.push({
          id: 'confirm-peek',
          label: `Confirm Peek (${selectedCount}/${requiredCount})`,
          icon: CheckCircle,
          event: { type: 'ABILITY_CONFIRM_ACTION' },
          disabled: selectedCount !== requiredCount,
        });
      } else if (abilityContext?.type === 'swap') {
        const { payload } = abilityContext;
        const selectedCount = ('sourcePlayerId' in payload ? 1 : 0) + ('targetPlayerId' in payload ? 1 : 0);
        actions.push({
          id: 'confirm-swap',
          label: `Confirm Swap (${selectedCount}/2)`,
          icon: Shuffle,
          event: { type: 'ABILITY_CONFIRM_ACTION' },
          disabled: selectedCount !== 2,
        });
      }
      actions.push({ id: 'cancel-ability', label: 'Cancel', icon: Ban, event: { type: 'ABILITY_CANCEL_ACTION' } });
      return actions.map(action => ({ ...action, variant: 'ghost' as const, disabled: action.disabled || !state.can(action.event) }));
    }

    if (currentGameState.gameStage === GameStage.DEALING && !localPlayer.isReady) {
      actions.push({ id: 'ready-peek', label: 'Ready', icon: Eye, event: { type: 'DECLARE_READY_FOR_PEEK_CLICKED' } });
    }
    
    if (isMyTurn && currentGameState.turnPhase) {
      const turnPhase = currentGameState.turnPhase;
      if (turnPhase === TurnPhase.DRAW) {
        actions.push({ id: 'draw-deck', label: 'Draw from Deck', icon: Circle, event: { type: 'DRAW_FROM_DECK_CLICKED' } });
        
        const topOfDiscard = currentGameState.discardPile[currentGameState.discardPile.length - 1];
        const isDiscardDrawable = topOfDiscard && !new Set([CardRank.King, CardRank.Queen, CardRank.Jack]).has(topOfDiscard.rank);
        actions.push({ id: 'draw-discard', label: 'Draw from Discard', icon: Eye, event: { type: 'DRAW_FROM_DISCARD_CLICKED' }, disabled: !isDiscardDrawable });

        actions.push({ id: 'call-check', label: 'Call Check!', icon: CheckCircle, event: { type: 'CALL_CHECK_CLICKED' }, holdToConfirm: true });
      } else if (turnPhase === TurnPhase.DISCARD) {
        actions.push({ id: 'discard-drawn', label: 'Discard Drawn Card', icon: X, event: { type: 'CONFIRM_DISCARD_PENDING_DRAWN_CARD' } });
        if (state.context.selectedHandCardIndex !== null) {
          actions.push({ id: 'swap-card', label: 'Swap with Selected', icon: Shuffle, event: { type: 'CONFIRM_SWAP_PENDING_CARD_WITH_HAND', handCardIndex: state.context.selectedHandCardIndex } });
        }
      } else if (turnPhase === TurnPhase.ACTION) {
        actions.push({
          id: 'use-peek',
          label: 'Peek (King)',
          icon: Search,
          event: { type: 'START_ABILITY', abilityType: 'peek', payload: { type: 'peek' } },
        });
        actions.push({
          id: 'use-swap',
          label: 'Swap (Queen)',
          icon: GitCommitHorizontal,
          event: { type: 'START_ABILITY', abilityType: 'swap', payload: { type: 'swap' } },
        });
        actions.push({
          id: 'end-turn',
          label: 'End Turn',
          icon: CheckCircle,
          event: { type: 'CONFIRM_DISCARD_PENDING_DRAWN_CARD' }
        });
      }
    }

    return actions.map(action => ({ ...action, variant: 'ghost' as const, disabled: action.disabled || !state.can(action.event) }));
  }

  const getInstructionText = () => {
    if (!currentGameState || !localPlayer || !currentGameState.players) return "Loading...";

    if (state.matches({ inGame: { connected: { ability: 'collectingInput' } } })) {
      if (abilityContext?.type === 'peek') {
        return `You played a King. Select one card from any player to peek at.`;
      }
      if (abilityContext?.type === 'swap') {
        const selected = ('sourcePlayerId' in abilityContext.payload ? 1 : 0) + ('targetPlayerId' in abilityContext.payload ? 1 : 0);
        if (selected === 0) return `You played a Queen. Select the first card to swap.`;
        if (selected === 1) return `First card selected. Now select the second card to swap.`;
      }
    }

    if (currentGameState.gameStage === GameStage.DEALING && !localPlayer.isReady) {
      return "The dealer is dealing. Click when you're ready to peek at your cards.";
    }
    if (currentGameState.gameStage === GameStage.DEALING && localPlayer.isReady) {
      return "Waiting for other players to be ready for the peek...";
    }
    if (isMyTurn) {
        if (currentGameState.turnPhase === TurnPhase.DRAW) {
            return "It's your turn. Draw a card, or call Check.";
        } else if (currentGameState.turnPhase === TurnPhase.DISCARD) {
            return "You've drawn a card. Discard it, or select a card from your hand to swap with.";
        } else if (currentGameState.turnPhase === TurnPhase.ACTION) {
            return "You discarded a special card. Choose an ability to use, or end your turn.";
        }
    }
    const currentPlayerId = currentGameState.currentPlayerId;
    if (!currentPlayerId) return "Waiting for game to start...";
    
    const currentPlayerName = currentGameState.players[currentPlayerId]?.name ?? 'Opponent';
    return `Waiting for ${currentPlayerName}...`;
  }

  const actions = getAvailableActions();
  const instructionText = getInstructionText();

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
                        <ActionIcon className="mr-2 h-3 w-3" />
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
    </motion.div>
  );
}