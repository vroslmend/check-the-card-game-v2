"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useState, useRef } from "react"
import { CheckCircle, Circle, Eye, Shuffle, Users, X } from "lucide-react"
import { useUI } from "@/components/providers/uiMachineProvider"
import { type UIMachineEvent } from "@/machines/uiMachine"
import Magnetic from "../ui/Magnetic";
import { PlayerActionType } from "shared-types"

// This defines the structure for a button in the action bar.
type ActionButton = {
  id: string; // A unique key for React
  label: string;
  icon: React.ElementType;
  event: UIMachineEvent;
  holdToConfirm?: boolean;
  variant?: 'ghost' | 'default' | 'destructive' | 'outline' | 'secondary' | 'link';
};

export function ActionBar() {
  const [state, send] = useUI();

  const {
    selectedHandCardIndex,
    localPlayerId,
    currentGameState,
  } = state.context;

  const localPlayer = localPlayerId && currentGameState?.players[localPlayerId];
  const isMyTurn = currentGameState?.currentPlayerId === localPlayerId;

  // State for the "hold to confirm" button feature
  const [holdingAction, setHoldingAction] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleAction = (event: UIMachineEvent) => {
    if (state.can(event)) {
      send(event);
    }
  };

  const startHold = (button: ActionButton) => {
    if (!state.can(button.event)) return;

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
    }, 20); // 50 updates per second for smooth progress

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

  // This function determines which action buttons are available based on the current game state.
  const getAvailableActions = (): ActionButton[] => {
    if (!currentGameState || !localPlayer || !localPlayerId) return [];

    const actions: ActionButton[] = [];
    const can = (event: UIMachineEvent) => state.can(event);

    // Initial Peek Phase
    if (currentGameState.currentPhase === 'awaitingPlayers' && !localPlayer.isReadyForInitialPeek) {
      const event: UIMachineEvent = { type: 'DECLARE_READY_FOR_PEEK_CLICKED' };
      if (can(event)) {
        actions.push({ id: 'ready-peek', label: 'Ready to Peek', icon: Eye, event });
      }
    }
    if (currentGameState.currentPhase === 'initialPeekPhase' && !localPlayer.hasCompletedInitialPeek) {
      const event: UIMachineEvent = { type: 'INITIAL_PEEK_ACKNOWLEDGED_CLICKED' };
      if (can(event)) {
        actions.push({ id: 'ack-peek', label: 'Acknowledge Peek', icon: CheckCircle, event });
      }
    }
    
    // Player's Turn Actions
    if (isMyTurn) {
      if (!localPlayer.pendingDrawnCard) {
        // Initial draw actions
        const drawDeckEvent: UIMachineEvent = { type: 'DRAW_FROM_DECK_CLICKED' };
        if (can(drawDeckEvent)) {
          actions.push({ id: 'draw-deck', label: 'Draw from Deck', icon: Circle, event: drawDeckEvent });
        }
        const drawDiscardEvent: UIMachineEvent = { type: 'DRAW_FROM_DISCARD_CLICKED' };
        if (can(drawDiscardEvent)) {
          actions.push({ id: 'draw-discard', label: 'Draw from Discard', icon: Eye, event: drawDiscardEvent });
        }
        const callCheckEvent: UIMachineEvent = { type: 'PLAYER_ACTION_CLICKED', action: { type: PlayerActionType.CALL_CHECK, playerId: localPlayerId } };
        if (can(callCheckEvent)) {
            actions.push({ id: 'call-check', label: 'Call Check!', icon: CheckCircle, event: callCheckEvent, holdToConfirm: true });
        }
      } else {
        // Post-draw actions
        const discardDrawnEvent: UIMachineEvent = { type: 'CONFIRM_DISCARD_PENDING_DRAWN_CARD' };
        if (can(discardDrawnEvent)) {
          actions.push({ id: 'discard-drawn', label: 'Discard Drawn Card', icon: X, event: discardDrawnEvent });
        }
        if (selectedHandCardIndex !== null) {
          const swapEvent: UIMachineEvent = { type: 'CONFIRM_SWAP_PENDING_CARD_WITH_HAND', handCardIndex: selectedHandCardIndex };
          if (can(swapEvent)) {
            actions.push({ id: 'swap-card', label: 'Swap with Selected', icon: Shuffle, event: swapEvent });
          }
        }
      }
    }

    // Matching Stage Actions
    if (currentGameState.currentPhase === 'matchingStage') {
        const passEvent: UIMachineEvent = { type: 'PLAYER_ACTION_CLICKED', action: { type: PlayerActionType.PASS_ON_MATCH_ATTEMPT, playerId: localPlayerId } };
        if(can(passEvent)) {
            actions.push({ id: 'pass-match', label: 'Pass', icon: Circle, event: passEvent });
        }
        if (selectedHandCardIndex !== null) {
            const matchEvent: UIMachineEvent = { type: 'PLAYER_ACTION_CLICKED', action: { type: PlayerActionType.ATTEMPT_MATCH, playerId: localPlayerId, handIndex: selectedHandCardIndex } };
            if (can(matchEvent)) {
                actions.push({ id: 'attempt-match', label: 'Attempt Match', icon: Users, event: matchEvent });
            }
        }
    }

    return actions.map(action => ({ ...action, variant: 'ghost' as const }));
  }

  // This function determines the instructional text based on the game state.
  const getInstructionText = () => {
    if (!currentGameState || !localPlayer) return "Loading...";

    if (currentGameState.currentPhase === 'awaitingPlayers' && !localPlayer.isReadyForInitialPeek) {
      return "Click when you're ready to see your initial cards.";
    }
    if (currentGameState.currentPhase === 'initialPeekPhase') {
      return "Memorize your two center cards, then click Acknowledge.";
    }
    if (currentGameState.currentPhase === 'matchingStage') {
        return "A card was discarded. Select one of your cards to attempt a match, or pass.";
    }
    if (isMyTurn) {
        if (!localPlayer.pendingDrawnCard) {
            return "It's your turn. Draw a card from the deck or discard pile, or call Check.";
        } else {
            return "You've drawn a card. Discard it, or select a card from your hand to swap with.";
        }
    }
    const currentPlayerName = currentGameState.players[currentGameState.currentPlayerId]?.name ?? 'Opponent';
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