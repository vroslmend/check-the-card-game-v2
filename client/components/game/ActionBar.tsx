"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useState, useRef } from "react"
import { CheckCircle, Circle, Eye, Shuffle, Users, X } from "lucide-react"
import { useUIMachineRef, useUIMachineSelector } from "@/machines/uiMachineProvider"
import { UIMachineEvent } from "@/machines/uiMachine"
import Magnetic from "../ui/Magnetic";

type Action = { 
  id: UIMachineEvent['type']; 
  label: string; 
  icon: React.ElementType; 
  holdToConfirm?: boolean; 
  payload?: Partial<Extract<UIMachineEvent, { type: UIMachineEvent['type'] }>>;
  variant?: 'ghost' | 'default' | 'destructive' | 'outline' | 'secondary' | 'link';
};

export function ActionBar() {
  const actorRef = useUIMachineRef();
  const uiState = useUIMachineSelector(state => state);
  const { send } = actorRef;

  const selectedHandCardIndex = useUIMachineSelector((state) => state.context.selectedHandCardIndex);
  const currentHand = useUIMachineSelector((state) => 
    state.context.localPlayerId && state.context.currentGameState?.players[state.context.localPlayerId]
      ? state.context.currentGameState.players[state.context.localPlayerId].hand
      : []
  );

  const [holdingAction, setHoldingAction] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleAction = (action: Action) => {
    const eventToSend = { type: action.id, ...action.payload };
    if (uiState.can(eventToSend as any)) {
      send(eventToSend as any);
    }
  };

  const startHold = (action: Action) => {
    const eventToSend = { type: action.id, ...action.payload };
    if (!uiState.can(eventToSend as any)) return;

    setHoldingAction(action.id);
    setHoldProgress(0);

    progressIntervalRef.current = setInterval(() => {
      setHoldProgress((prev) => {
        const newProgress = prev + 2;
        if (newProgress >= 100) {
          completeHold(action);
          return 100;
        }
        return newProgress;
      });
    }, 20);

    holdTimeoutRef.current = setTimeout(() => completeHold(action), 1000);
  };

  const completeHold = (action: Action) => {
    clearHold();
    handleAction(action);
  };

  const clearHold = () => {
    setHoldingAction(null);
    setHoldProgress(0);
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  const getAvailableActions = (): Action[] => {
    const actions: Action[] = [];
    
    // Helper function for type safety, though we call uiState.can directly.
    const can = (event: UIMachineEvent) => uiState.can(event);

    if (can({ type: 'READY_FOR_INITIAL_PEEK_CLICKED' })) {
        actions.push({ id: 'READY_FOR_INITIAL_PEEK_CLICKED', label: 'Ready to Peek', icon: Eye });
    }
    if (can({ type: 'INITIAL_PEEK_ACKNOWLEDGED_CLICKED' })) {
        actions.push({ id: 'INITIAL_PEEK_ACKNOWLEDGED_CLICKED', label: 'Acknowledge Peek', icon: CheckCircle });
    }
    if (can({ type: 'DRAW_FROM_DECK_CLICKED' })) {
        actions.push({ id: 'DRAW_FROM_DECK_CLICKED', label: 'Draw from Deck', icon: Circle });
    }
    if (can({ type: 'DRAW_FROM_DISCARD_CLICKED' })) {
        actions.push({ id: 'DRAW_FROM_DISCARD_CLICKED', label: 'Draw from Discard', icon: Eye });
    }
    if (can({ type: 'CALL_CHECK_CLICKED' })) {
        actions.push({ id: 'CALL_CHECK_CLICKED', label: 'Call Check!', icon: CheckCircle, holdToConfirm: true });
    }
    if (can({ type: 'CONFIRM_DISCARD_PENDING_DRAWN_CARD' })) {
        actions.push({ id: 'CONFIRM_DISCARD_PENDING_DRAWN_CARD', label: 'Discard Drawn Card', icon: X });
    }
    
    if (selectedHandCardIndex !== null) {
      // Check for SWAP action
      const swapEvent: UIMachineEvent = { type: 'CONFIRM_SWAP_PENDING_CARD_WITH_HAND', handCardIndex: selectedHandCardIndex };
      if (can(swapEvent)) {
          actions.push({ id: 'CONFIRM_SWAP_PENDING_CARD_WITH_HAND', label: 'Swap with Selected', icon: Shuffle, payload: { handCardIndex: selectedHandCardIndex } });
      }

      // Check for MATCH action
      const selectedCard = currentHand[selectedHandCardIndex];
      if (selectedCard) {
        const matchEvent: UIMachineEvent = { type: 'ATTEMPT_MATCH_WITH_SELECTED_CARD_CLICKED', cardId: selectedCard.id };
        if(can(matchEvent)) {
          actions.push({ id: 'ATTEMPT_MATCH_WITH_SELECTED_CARD_CLICKED', label: 'Attempt Match', icon: Users, payload: { cardId: selectedCard.id } });
        }
      }
    }

    if (can({ type: 'PASS_MATCH_CLICKED' })) {
        actions.push({ id: 'PASS_MATCH_CLICKED', label: 'Pass', icon: Circle });
    }

    // The type assertion for variant might not be ideal, but it works for now.
    return actions.map(action => ({ ...action, variant: 'ghost' }));
  }

  const actions = getAvailableActions();

  const getInstructionText = () => {
    if (uiState.matches({ initialSetup: 'awaitingPeekReadiness' })) return "Click when you're ready to see your initial cards.";
    if (uiState.matches({ initialSetup: 'peekingCards' })) return "Memorize your two cards, then acknowledge.";
    if (uiState.matches('idle')) return "It's your turn. Draw a card from the deck or discard pile.";
    if (uiState.matches({ playerAction: 'promptPendingCardDecision' })) return "You've drawn a card. Discard it or select a card to swap.";
    if (uiState.matches({ playerAction: 'promptMatchDecision' })) return "A card was discarded. Select one of your cards to attempt a match, or pass.";
    return "Waiting for opponent...";
  }

  return (
    <motion.div className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
       <AnimatePresence mode="wait">
        <motion.div
          key={getInstructionText()}
          className="rounded-lg border border-stone-200/30 bg-stone-100/20 p-3 text-center dark:border-stone-800/30 dark:bg-stone-900/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <p className="text-sm font-light text-stone-600 dark:text-stone-400">{getInstructionText()}</p>
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
                        onClick={() => handleAction(action)}
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