import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ClientCheckGameState, Card, ClientPlayerState, InitialPlayerSetupData, ClientCard } from 'shared-types'; 
import { Rank } from 'shared-types'; 
import PlayerHandComponent from './PlayerHandComponent';
import DrawPileComponent from './DrawPileComponent';
import DiscardPileComponent from './DiscardPileComponent';
import CardComponent from './CardComponent';
import ActionBarComponent, { createDrawDeckAction, createDrawDiscardAction } from './ActionBarComponent'; 
import EndOfGameModal from './EndOfGameModal';
import { motion, AnimatePresence } from 'motion/react';

const PEEK_COUNTDOWN_SECONDS = 3; 
const PEEK_REVEAL_SECONDS = 5;    

// New constants for initial peek visual staging
const INITIAL_PEEK_GET_READY_DURATION_S = 3;
const INITIAL_PEEK_REVEAL_DURATION_S = 5;

interface FeedbackMessage {
  text: string;
  type: 'success' | 'error' | 'info';
}

interface AbilityClientArgs {
  peekTargets?: Array<{ playerID: string; cardIndex: number }>;
  // swapTargets are typically built from multiSelectedCardLocations right before sending
  peekSkipped?: boolean; 
}

interface CheckGameBoardProps {
  gameState: ClientCheckGameState;
  playerId: string; 
  onPlayerAction: (type: string, payload?: any, clientCallback?: (message: string, isError: boolean) => void) => void; 
  gameId: string; 
  showDebugPanel: boolean;
  onReturnToLobby: () => void;
}

// Define a local type for a single ability target for clarity
type AbilityTarget = { playerID: string; cardIndex: number; type: 'peek' | 'swap' };

const useEndModal = (gameover: ClientCheckGameState['gameover'], onReturnToLobby: () => void) => {
    const [showEndModal, setShowEndModal] = useState(false);
    useEffect(() => {
        setShowEndModal(!!gameover);
    }, [gameover]); 

    const handlePlayAgain = () => {
        onReturnToLobby();
        setShowEndModal(false);
    };
    return { showEndModal, setShowEndModal, handlePlayAgain };
}

const suitSymbols: { [key: string]: string } = {
  H: '♥',
  D: '♦',
  C: '♣',
  S: '♠',
};

const CheckGameBoard: React.FC<CheckGameBoardProps> = ({ gameState, playerId, onPlayerAction, gameId, showDebugPanel, onReturnToLobby }) => {
  const clientPlayerState = gameState.players[playerId]; 
  const [selectedHandCardIndex, setSelectedHandCardIndex] = useState<number | null>(null);
  const [revealedCardLocations, setRevealedCardLocations] = useState<{ [playerID: string]: { [cardIndex: number]: boolean } }>({});
  const [multiSelectedCardLocations, setMultiSelectedCardLocations] = useState<{ playerID: string, cardIndex: number }[]>([]);
  const [abilityArgs, setAbilityArgs] = useState<AbilityClientArgs | null>(null); 
  const [swappingOutCardId, setSwappingOutCardId] = useState<string | null>(null);
  const swappingOutCardIdClearTimerRef = useRef<NodeJS.Timeout | null>(null);

  // New state variables for peek visual staging
  const [peekGetReadyTimer, setPeekGetReadyTimer] = useState<number | null>(null);
  const [peekRevealTimer, setPeekRevealTimer] = useState<number | null>(null);
  const [showPeekedCards, setShowPeekedCards] = useState<boolean>(false);
  const processedCardsToPeekRef = useRef<ClientCard[] | null>(null);

  const [feedbackMessage, setFeedbackMessage] = useState<FeedbackMessage | null>(null);

  // New state for King/Queen ability peek timed reveal
  const [abilityPeekSelectionsConfirmed, setAbilityPeekSelectionsConfirmed] = useState<Array<{ playerID: string; cardIndex: number }> | null>(null);
  const [isAbilityPeekTimerActive, setIsAbilityPeekTimerActive] = useState<boolean>(false);
  const [abilityPeekTimeLeft, setAbilityPeekTimeLeft] = useState<number | null>(null);

  // const countdownTimerRef = useRef<NodeJS.Timeout | null>(null); // Replaced by specific refs
  const getReadyIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const revealIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevSignatureRef = React.useRef<string | null>(null);
  
  const { showEndModal, setShowEndModal, handlePlayAgain } = useEndModal(gameState.gameover, onReturnToLobby);

  // LOGGING GLOBAL ABILITY TARGETS
  useEffect(() => {
    if (gameState.currentPhase === 'abilityResolutionPhase' && gameState.pendingAbilities && gameState.pendingAbilities.length > 0) {
      console.log(`[DEBUG_GAT] PlayerID: ${playerId}, Phase: ${gameState.currentPhase}, PendingAbility: ${gameState.pendingAbilities[0].card.rank} by ${gameState.pendingAbilities[0].playerId}, GlobalTargets:`, JSON.stringify(gameState.globalAbilityTargets));
    }
  }, [gameState.currentPhase, gameState.pendingAbilities, gameState.globalAbilityTargets, playerId]);

  // New state for matching stage UI
  const [playerHasUITriggeredPass, setPlayerHasUITriggeredPass] = useState<boolean>(false);

  // Ref to store the key of the current matching opportunity to detect changes
  const currentMatchingOpportunityKeyRef = useRef<string | null>(null);

  const isResolvingPlayerForAbility = gameState.currentPhase === 'abilityResolutionPhase' && 
                                   gameState.pendingAbilities && 
                                   gameState.pendingAbilities.length > 0 &&
                                   gameState.pendingAbilities[0].playerId === playerId;

  const canPlayerPerformAbilityAction = useCallback(() => {
    if (!isResolvingPlayerForAbility || !gameState.pendingAbilities || !gameState.pendingAbilities[0]) {
      return false; 
    }
    const abilityToResolve = gameState.pendingAbilities[0];
    const abilityCard = abilityToResolve.card;
    const serverStage = abilityToResolve.currentAbilityStage;
    const currentSelectionsCount = multiSelectedCardLocations.length;

    switch (abilityCard.rank) {
      case Rank.King:
        if (serverStage === 'peek') { 
          return currentSelectionsCount === 2;
        } else if (serverStage === 'swap') { 
          return currentSelectionsCount === 2;
        }
        return false; // Should have a stage
      case Rank.Queen:
        if (serverStage === 'peek') { 
          return currentSelectionsCount === 1;
        } else if (serverStage === 'swap') { 
          return currentSelectionsCount === 2;
        }
        return false; // Should have a stage
      case Rank.Jack: // Jack is implicitly 'swap' or serverStage will be 'swap'
        return currentSelectionsCount === 2; 
      default:
        return false; 
    }
  }, [isResolvingPlayerForAbility, gameState.pendingAbilities, multiSelectedCardLocations]);

  const handleSkipAbility = useCallback(() => {
    if (isResolvingPlayerForAbility && gameState.pendingAbilities && gameState.pendingAbilities.length > 0) {
      const abilityToResolve = gameState.pendingAbilities[0];
      const abilityRank = abilityToResolve.card.rank;
      const serverStage = abilityToResolve.currentAbilityStage;
      let skipType = 'full'; 

      if ((abilityRank === Rank.King || abilityRank === Rank.Queen) && serverStage === 'peek') {
        skipType = 'peek';
      } 
      // If serverStage is 'swap' (for K/Q) or it's a Jack, skipType remains 'full' (which server handles as skipping current/final stage)
      
      console.log(`[Client] Skipping ability: ${abilityRank}, Server Stage: ${serverStage}, Effective Skip Type: ${skipType}`);
      onPlayerAction('resolveSpecialAbility', {
        abilityCard: abilityToResolve.card,
        args: { skipAbility: true, skipType: skipType } 
      });
      // Rely on useEffect to clear local states upon gameState update
    }
  }, [isResolvingPlayerForAbility, gameState.pendingAbilities, onPlayerAction]);

  // Effect to reset ability selection state if the pending ability changes OR player changes
  useEffect(() => {
    const currentPendingAbility = gameState.pendingAbilities && gameState.pendingAbilities.length > 0 ? gameState.pendingAbilities[0] : null;
    const pendingAbilitySignature = currentPendingAbility
      ? `${currentPendingAbility.playerId}-${currentPendingAbility.card.rank}-${currentPendingAbility.card.suit}-${currentPendingAbility.source}-${currentPendingAbility.currentAbilityStage || 'initial'}`
      : null;

    const shouldReset = prevSignatureRef.current !== pendingAbilitySignature || !isResolvingPlayerForAbility;

    if (shouldReset && (abilityArgs !== null || multiSelectedCardLocations.length > 0)) {
      console.log('[AbilityResetEffect] Conditions met for resetting ability selections.', { 
        prevSig: prevSignatureRef.current, 
        newSig: pendingAbilitySignature, 
        isResolving: isResolvingPlayerForAbility,
        oldAbilityArgs: JSON.stringify(abilityArgs),
        oldMultiSelect: JSON.stringify(multiSelectedCardLocations) 
      });
      setAbilityArgs(null);
      setMultiSelectedCardLocations([]);
    }
    prevSignatureRef.current = pendingAbilitySignature;
  }, [gameState.pendingAbilities, isResolvingPlayerForAbility, abilityArgs, multiSelectedCardLocations]);

  // Helper to clear peek interval timers
  const clearAllPeekIntervals = useCallback(() => {
    if (getReadyIntervalRef.current) clearInterval(getReadyIntervalRef.current);
    getReadyIntervalRef.current = null;
    if (revealIntervalRef.current) clearInterval(revealIntervalRef.current);
    revealIntervalRef.current = null;
    // Clear swap animation timer as well if active during a phase change or unmount
    if (swappingOutCardIdClearTimerRef.current) {
      clearTimeout(swappingOutCardIdClearTimerRef.current);
      swappingOutCardIdClearTimerRef.current = null;
    }
  }, []);

  // Main useEffect to manage peek phase initiation and completion from server state
  useEffect(() => {
    if (!clientPlayerState) {
      clearAllPeekIntervals();
      setPeekGetReadyTimer(null);
      setPeekRevealTimer(null);
      setShowPeekedCards(false);
      processedCardsToPeekRef.current = null;
      return;
    }

    if (gameState.currentPhase === 'initialPeekPhase' && !clientPlayerState.hasCompletedInitialPeek) {
      if (
        clientPlayerState.cardsToPeek &&
        clientPlayerState.cardsToPeek !== processedCardsToPeekRef.current && 
        peekGetReadyTimer === null &&
        peekRevealTimer === null
      ) {
        console.log('[PeekSystem-MainEffect-DEBUG] Initiating GET READY countdown. Conditions met:',
          {
            cardsToPeekExists: !!clientPlayerState.cardsToPeek,
            cardsToPeekChanged: clientPlayerState.cardsToPeek !== processedCardsToPeekRef.current,
            peekGetReadyTimerIsNull: peekGetReadyTimer === null,
            peekRevealTimerIsNull: peekRevealTimer === null,
            processedCardsToPeekRefCurrent: JSON.stringify(processedCardsToPeekRef.current),
            clientPlayerStateCardsToPeek: JSON.stringify(clientPlayerState.cardsToPeek)
          }
        );
        setPeekGetReadyTimer(INITIAL_PEEK_GET_READY_DURATION_S);
        setShowPeekedCards(false); 
        clearAllPeekIntervals(); 
        processedCardsToPeekRef.current = clientPlayerState.cardsToPeek; 
      } else if (!clientPlayerState.cardsToPeek) {
        processedCardsToPeekRef.current = null; // Clear ref if server clears cardsToPeek
        // If timers were somehow active but cardsToPeek became null, ensure cleanup
        if (peekGetReadyTimer !== null || peekRevealTimer !== null || showPeekedCards) {
            clearAllPeekIntervals();
            setPeekGetReadyTimer(null);
            setPeekRevealTimer(null);
            setShowPeekedCards(false);
        }
      } else {
        // console.log('[PeekSystem-MainEffect] In initialPeekPhase but conditions to start countdown not met or already started/active for current cardsToPeek.');
      }
    } else {
      if (peekGetReadyTimer !== null || peekRevealTimer !== null || showPeekedCards) {
        // console.log('[PeekSystem-MainEffect] Peek phase ended or not active. CLEANING UP.', {
        //   currentPhase: gameState.currentPhase,
        //   hasCompletedInitialPeek: clientPlayerState?.hasCompletedInitialPeek,
        //   wasShowingPeekedCards: showPeekedCards
        // });
        clearAllPeekIntervals();
        setPeekGetReadyTimer(null);
        setPeekRevealTimer(null);
        setShowPeekedCards(false);
      }
      processedCardsToPeekRef.current = null; // Reset ref when peek phase is truly over or not active
      // console.log('[PeekSystem-MainEffect] Not in initial peek phase or peek completed. No new timers started, ref reset.');
    }
    return clearAllPeekIntervals;
  }, [
    gameState.currentPhase, 
    clientPlayerState?.hasCompletedInitialPeek, 
    clientPlayerState?.cardsToPeek, 
    clearAllPeekIntervals, 
    showPeekedCards, peekGetReadyTimer, peekRevealTimer 
  ]);

  // useEffect for "Get Ready" countdown timer
  useEffect(() => {
    if (peekGetReadyTimer === null) return;

    if (peekGetReadyTimer > 0) {
      // console.log('[PeekSystem-GetReadyTimerEffect] Countdown: ', peekGetReadyTimer);
      getReadyIntervalRef.current = setInterval(() => {
        setPeekGetReadyTimer(prev => (prev !== null ? Math.max(0, prev - 1) : null));
      }, 1000);
    } else if (peekGetReadyTimer === 0) {
      // console.log('[PeekSystem-GetReadyTimerEffect] GET READY finished. Initiating REVEAL. Clearing getReadyInterval.');
      if (getReadyIntervalRef.current) clearInterval(getReadyIntervalRef.current); // Clear this interval
      getReadyIntervalRef.current = null;
      setPeekGetReadyTimer(null); // Mark as finished
      setPeekRevealTimer(INITIAL_PEEK_REVEAL_DURATION_S); // Start reveal timer
      setShowPeekedCards(true); // << SHOW CARDS NOW
      // console.log('[PeekSystem-GetReadyTimerEffect] setShowPeekedCards(true) called.');
    }
    return () => {
      if (getReadyIntervalRef.current) {
        // console.log('[PeekSystem-GetReadyTimerEffect] Cleanup: Clearing getReadyInterval.');
        clearInterval(getReadyIntervalRef.current);
        getReadyIntervalRef.current = null;
      }
    };
  }, [peekGetReadyTimer]);

  // useEffect for "Reveal" countdown timer
  useEffect(() => {
    if (peekRevealTimer === null) return;

    if (peekRevealTimer > 0) {
      // console.log('[PeekSystem-RevealTimerEffect] Countdown: ', peekRevealTimer);
      revealIntervalRef.current = setInterval(() => {
        setPeekRevealTimer(prev => (prev !== null ? Math.max(0, prev - 1) : null));
      }, 1000);
    } else if (peekRevealTimer === 0) {
      // console.log('[PeekSystem-RevealTimerEffect] REVEAL finished. Hiding cards. Clearing revealInterval.');
      if (revealIntervalRef.current) clearInterval(revealIntervalRef.current);
      revealIntervalRef.current = null;
      setPeekRevealTimer(null); // Mark as finished
      setShowPeekedCards(false); // << HIDE CARDS NOW
      // console.log('[PeekSystem-RevealTimerEffect] setShowPeekedCards(false) called.');
      // Client now waits for server to advance the game phase via hasCompletedInitialPeek or phase change.
    }
    return () => {
      if (revealIntervalRef.current) {
        // console.log('[PeekSystem-RevealTimerEffect] Cleanup: Clearing revealInterval.');
        clearInterval(revealIntervalRef.current);
        revealIntervalRef.current = null;
      }
    };
  }, [peekRevealTimer]);

  // useEffect for King/Queen Ability Peek Reveal Timer
  useEffect(() => {
    if (!isAbilityPeekTimerActive || abilityPeekTimeLeft === null) return;

    if (abilityPeekTimeLeft > 0) {
      const timerId = setInterval(() => {
        setAbilityPeekTimeLeft(prev => (prev !== null ? Math.max(0, prev - 1) : null));
      }, 1000);
      return () => clearInterval(timerId);
    } else if (abilityPeekTimeLeft === 0) {
      setIsAbilityPeekTimerActive(false);
      setAbilityPeekTimeLeft(null);
      
      const abilityToResolve = gameState.pendingAbilities && gameState.pendingAbilities.length > 0 ? gameState.pendingAbilities[0] : null;
      if (abilityToResolve && abilityPeekSelectionsConfirmed) {
        console.log(`[Client-AbilityPeek] Timed reveal finished for ${abilityToResolve.card.rank}. Sending peek completion to server with targets:`, abilityPeekSelectionsConfirmed);
        onPlayerAction('resolveSpecialAbility', { 
          abilityCard: abilityToResolve.card, 
          args: { peekTargets: abilityPeekSelectionsConfirmed } 
        });
      }
      setAbilityPeekSelectionsConfirmed(null); // Clear revealed cards
      // multiSelectedCardLocations should persist for the upcoming swap stage if any
    }
  }, [isAbilityPeekTimerActive, abilityPeekTimeLeft, gameState.pendingAbilities, abilityPeekSelectionsConfirmed, onPlayerAction]);

  useEffect(() => {
    const newOppKey = gameState.matchingOpportunityInfo 
      ? `${gameState.matchingOpportunityInfo.originalPlayerID}-${gameState.matchingOpportunityInfo.cardToMatch.rank}-${gameState.matchingOpportunityInfo.cardToMatch.suit}` 
      : null;

    if (currentMatchingOpportunityKeyRef.current !== newOppKey) {
      console.log('[MatchUIResetEffect] New matching opportunity detected or current one ended. Resetting UI pass status and card selection.');
      setPlayerHasUITriggeredPass(false);
      setSelectedHandCardIndex(null); // Also clear card selected for match attempt
    }
    currentMatchingOpportunityKeyRef.current = newOppKey;

    // Additionally, if the player is no longer in activePlayers for matching, ensure their local pass state is false (unless a new opportunity just started)
    // This handles cases where the server processes their action and removes them from active matchers.
    if (gameState.matchingOpportunityInfo && 
        !gameState.activePlayers[playerId] && 
        playerHasUITriggeredPass &&
        newOppKey === currentMatchingOpportunityKeyRef.current // only if the opportunity itself hasn't changed
      ) {
      // This case might be tricky: if the player successfully matched, they are removed from activePlayers.
      // We want the selected card to clear, and pass status to clear, which should happen via key change mostly.
      // If they passed, their UI state (playerHasUITriggeredPass) should ideally persist until the opportunity changes.
      // The current logic: if they are NOT an active player for the CURRENT opportunity AND their UI says they passed, that implies the server processed it.
      // We might not need to explicitly reset playerHasUITriggeredPass here IF the opportunity key change handles it cleanly.
      // Let's rely on the opportunity key change for resetting playerHasUITriggeredPass primarily.
      // But definitely clear selected card if they are no longer active.
      if (selectedHandCardIndex !== null) {
          // setSelectedHandCardIndex(null);
      }
    }

  }, [gameState.matchingOpportunityInfo, gameState.activePlayers, playerId, playerHasUITriggeredPass, selectedHandCardIndex]);

  // Effect to clear feedback message after a delay
  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => {
        setFeedbackMessage(null);
      }, 3000); // Display message for 3 seconds
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  if (!gameState || !gameState.players || !clientPlayerState) {
    return <div className="h-screen flex justify-center items-center p-4 text-center text-gray-500">Loading player data...</div>;
  }

  const handleDeclareReadyForPeek = useCallback(() => {
    if (clientPlayerState && !clientPlayerState.isReadyForInitialPeek && gameState.currentPhase === 'initialPeekPhase') {
      onPlayerAction('declareReadyForPeek');
    }
  }, [onPlayerAction, clientPlayerState, gameState.currentPhase]);
  
  const isCurrentPlayer = gameState.currentPlayerId === playerId;
  const isInMatchingStage = gameState.currentPhase === 'matchingStage' && !!gameState.matchingOpportunityInfo;
  
  useEffect(() => {
    if (isInMatchingStage) {
      console.log(`[Client] Player ${playerId} detected isInMatchingStage. Opportunity:`, gameState.matchingOpportunityInfo);
    }
  }, [isInMatchingStage, playerId, gameState.matchingOpportunityInfo]);

  const canPerformStandardPlayPhaseActions = isCurrentPlayer &&
                                        (gameState.currentPhase === 'playPhase' || gameState.currentPhase === 'finalTurnsPhase') &&
                                        !clientPlayerState?.pendingDrawnCard &&
                                        !(gameState.pendingAbilities && gameState.pendingAbilities.length > 0);

  const canDrawFromDeck = canPerformStandardPlayPhaseActions;
  const canDrawFromDiscard = canPerformStandardPlayPhaseActions && 
                             !gameState.topDiscardIsSpecialOrUnusable && 
                             gameState.discardPile.length > 0;
  const canCallCheck = canPerformStandardPlayPhaseActions && gameState.currentPhase === 'playPhase' && !clientPlayerState?.hasCalledCheck;

  const handleDrawFromDeck = () => {
    if (canDrawFromDeck) {
      onPlayerAction('drawFromDeck');
      setSelectedHandCardIndex(null);
      setFeedbackMessage(null); // Clear previous messages on new action
    }
  };

  const handleDrawFromDiscard = () => {
    if (canDrawFromDiscard) {
      onPlayerAction('drawFromDiscard');
      setSelectedHandCardIndex(null);
      setFeedbackMessage(null); // Clear previous messages on new action
    }
  };

  const handleSwapAndDiscard = (handIndex: number) => {
    if (isCurrentPlayer && clientPlayerState?.pendingDrawnCard && (gameState.currentPhase === 'playPhase' || gameState.currentPhase === 'finalTurnsPhase')) {
      const cardToSwap = clientPlayerState.hand[handIndex];
      if (cardToSwap && !('isHidden' in cardToSwap) && cardToSwap.id) {
        // Clear any existing timer before setting a new one
        if (swappingOutCardIdClearTimerRef.current) {
          clearTimeout(swappingOutCardIdClearTimerRef.current);
        }
        setSwappingOutCardId(cardToSwap.id); // Set ID of the card being swapped
        console.log(`[SwapAnim] Setting swappingOutCardId to ${cardToSwap.id} for card at handIndex ${handIndex}`);
        swappingOutCardIdClearTimerRef.current = setTimeout(() => {
          setSwappingOutCardId(null); // Clear after animation duration
          swappingOutCardIdClearTimerRef.current = null;
          console.log(`[SwapAnim] Cleared swappingOutCardId (was ${cardToSwap.id}) after timeout.`);
        }, 600); // Duration should be slightly longer than animation
      } else {
        console.warn('[SwapAnim] Could not set swappingOutCardId: Card not found or has no ID.', { card: cardToSwap });
      }
      onPlayerAction('swapAndDiscard', { handIndex });
      setSelectedHandCardIndex(null);
      setFeedbackMessage(null); 
    }
  };

  const handleDiscardDrawnCard = () => {
    if (isCurrentPlayer && clientPlayerState?.pendingDrawnCard && (gameState.currentPhase === 'playPhase' || gameState.currentPhase === 'finalTurnsPhase')) {
      onPlayerAction('discardDrawnCard');
      setSelectedHandCardIndex(null);
      setFeedbackMessage(null); 
    }
  };

  const handleAttemptMatch = (handIndex: number) => {
    if (isInMatchingStage && gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId)) {
      // Simulating receiving a message from server via onPlayerAction's eventual callback handling
      // In a real setup, page.tsx would get this from socket.emit callback and pass it down.
      // For now, we assume onPlayerAction in page.tsx might update a shared state or CheckGameBoard gets it directly.
      // Let's assume onPlayerAction will be enhanced to return a promise with the server message.
      // This is a placeholder for where you'd set the feedback message based on server response.
      // For now, we rely on gameState changes to know if it was successful, or the server sends a specific message for penalty.
      
      // This onPlayerAction is the one passed from page.tsx. We can't directly get its return value here to set feedback.
      // The feedback setting logic will be more indirect, likely via gameState changes or if onPlayerAction itself could set it.
      // For now, specific messages like "Match successful!" or "Penalty!" will be set if server sends them via game state update or direct message.
      // Let's clear previous general feedback and wait for server-driven updates for action results.
      setFeedbackMessage(null); 
      onPlayerAction('attemptMatch', { handIndex }, (responseMessage: string, isError: boolean) => {
        if(responseMessage) {
          setFeedbackMessage({ text: responseMessage, type: isError ? 'error' : 'success' });
        }
      });
      setSelectedHandCardIndex(null); 
    }
  };

  const handlePassMatch = useCallback(() => {
    if (isInMatchingStage && 
        gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId) && 
        !playerHasUITriggeredPass && 
        gameState.activePlayers[playerId] === 'awaitingMatchAction' 
      ) {
      setFeedbackMessage(null); 
      onPlayerAction('passMatch', undefined, (responseMessage: string, isError: boolean) => {
        if(responseMessage) {
         setFeedbackMessage({ text: responseMessage, type: isError ? 'error' : 'info' });
        } else {
          // Default pass message if server doesn't send one for pass
          setFeedbackMessage({ text: "You passed the match.", type: 'info' });
        }
      });
      setPlayerHasUITriggeredPass(true); 
      setSelectedHandCardIndex(null); 
    } else {
      console.warn(`[Client] Player ${playerId} WILL NOT call passMatch. Conditions: isInMatchingStage=${isInMatchingStage}, isPotentialMatcher=${gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId)}, playerHasUITriggeredPass=${playerHasUITriggeredPass}, serverActive=${gameState.activePlayers[playerId] === 'awaitingMatchAction'}`);
    }
  }, [onPlayerAction, playerId, gameState.currentPhase, gameState.matchingOpportunityInfo, isInMatchingStage, playerHasUITriggeredPass, gameState.activePlayers]);

  const handleCallCheck = () => {
    if (canCallCheck) {
      onPlayerAction('callCheck');
      setFeedbackMessage(null); 
    }
  };
  
  const handleResolveSpecialAbility = () => {
    if (isResolvingPlayerForAbility && gameState.pendingAbilities && gameState.pendingAbilities.length > 0) {
      const abilityToResolve = gameState.pendingAbilities[0];
      const serverStage = abilityToResolve.currentAbilityStage; // authoritative stage from server
      const currentSelections = multiSelectedCardLocations;
      let finalArgs: any = {};
      let actionToSend = false;

      if (abilityToResolve.card.rank === Rank.King) {
        if (serverStage === 'peek' && currentSelections.length === 2) {
          finalArgs = { peekTargets: currentSelections };
          actionToSend = true;
        } else if (serverStage === 'swap' && currentSelections.length === 2) {
          finalArgs = { swapTargets: currentSelections };
          actionToSend = true;
        }
      } else if (abilityToResolve.card.rank === Rank.Queen) {
        if (serverStage === 'peek' && currentSelections.length === 1) {
          finalArgs = { peekTargets: currentSelections };
          actionToSend = true;
        } else if (serverStage === 'swap' && currentSelections.length === 2) {
          finalArgs = { swapTargets: currentSelections };
          actionToSend = true;
        }
      } else if (abilityToResolve.card.rank === Rank.Jack) { 
        // Jacks are implicitly 'swap' or server might set currentAbilityStage to 'swap'
        // Server-side, Jack abilities are processed in one go, expecting swapTargets.
        if (currentSelections.length === 2) { 
          finalArgs = { swapTargets: currentSelections };
          actionToSend = true;
        }
      }
      
      if (actionToSend) {
        console.log(`[Client] Resolving ability: ${abilityToResolve.card.rank} (Server Stage: ${serverStage}). Sending args:`, finalArgs);
        onPlayerAction('resolveSpecialAbility', { abilityCard: abilityToResolve.card, args: finalArgs });
        // Local selection state (multiSelectedCardLocations and abilityArgs)
        // will be cleared by the useEffect when the new gameState arrives.
      } else {
        console.warn(`[Client] handleResolveSpecialAbility: Action NOT sent. Conditions not met. ServerStage: ${serverStage}, Selections: ${currentSelections.length}, Ability: ${abilityToResolve.card.rank}`);
      }
    }
  };

  const handleCardClick = (clickedPlayerID: string, cardIndex: number) => {
    if (!playerId || !clientPlayerState) return; 
    const isOwnCard = clickedPlayerID === playerId;
    const currentPhase = gameState.currentPhase;
    const currentPlayerPendingAbilityDetails = isResolvingPlayerForAbility && gameState.pendingAbilities && gameState.pendingAbilities.length > 0 ? gameState.pendingAbilities[0] : null;
    const pendingAbilityRank = currentPlayerPendingAbilityDetails?.card.rank;

    console.log('[CardClick]', { clickedPlayerID, cardIndex, isOwnCard, currentPhase, isCurrentPlayer, pendingAbilityRank, isResolvingPlayerForAbility, pendingDrawnCard: clientPlayerState.pendingDrawnCard, multiSelectedCardLocations, selectedHandCardIndex });

    if (gameState.gameover) return;
    if (currentPhase === 'initialPeekPhase') return; // No general card clicks during initial peek

    // Scenario 1: Player has drawn a card, clicks their own card to select it for swap
    if (clientPlayerState.pendingDrawnCard && isOwnCard && isCurrentPlayer && (currentPhase === 'playPhase' || currentPhase === 'finalTurnsPhase')) {
      handleSwapAndDiscard(cardIndex); // Directly trigger swap if card is clicked
      return;
    }

    // Updated Scenario 2: Matching stage, player clicks own card to SELECT it for a match attempt
    if (currentPhase === 'matchingStage' && 
        isOwnCard && 
        gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId) && 
        !playerHasUITriggeredPass && // Player has not already clicked "Pass Match" via UI
        gameState.activePlayers[playerId] === 'awaitingMatchAction' // Server still expects action from player
      ) {
      setSelectedHandCardIndex(prev => prev === cardIndex ? null : cardIndex); // Select/deselect card
      return; // Card click is for selection, not direct action
    }

    // Scenario 3: Ability resolution stage, selecting targets
    if (currentPhase === 'abilityResolutionPhase' && isResolvingPlayerForAbility && pendingAbilityRank) {
      const ability = currentPlayerPendingAbilityDetails.card; // This is just the card, not the full pendingAbility object
      const serverStage = currentPlayerPendingAbilityDetails.currentAbilityStage;
      const selection = { playerID: clickedPlayerID, cardIndex };
      const alreadySelected = multiSelectedCardLocations.some(s => s.playerID === clickedPlayerID && s.cardIndex === cardIndex);
      
      if (gameState.players[clickedPlayerID]?.isLocked) {
        console.warn(`[CardClick] Attempted to select card from locked player ${clickedPlayerID}. Selection prevented.`);
        return;
      }

      setMultiSelectedCardLocations(prev => {
        let newState: Array<{ playerID: string; cardIndex: number }> = [...prev]; // Start with a copy

        if (alreadySelected) {
          newState = prev.filter(s => !(s.playerID === clickedPlayerID && s.cardIndex === cardIndex));
        } else {
          if (pendingAbilityRank === Rank.King) {
            if (serverStage === 'peek') {
              if (prev.length < 2) newState = [...prev, selection];
              else newState = [...prev.slice(1), selection]; 
            } else if (serverStage === 'swap') {
              if (prev.length < 2) newState = [...prev, selection];
              else newState = [...prev.slice(1), selection]; 
            } 
          } else if (pendingAbilityRank === Rank.Queen) {
            if (serverStage === 'peek') {
              if (prev.length < 1) newState = [...prev, selection];
              else newState = [selection]; 
            } else if (serverStage === 'swap') {
              if (prev.length < 2) newState = [...prev, selection];
              else newState = [...prev.slice(1), selection]; 
            }
          } else if (pendingAbilityRank === Rank.Jack) {
            // Jack is always effectively in 'swap' stage for selection purposes
            if (prev.length < 2) newState = [...prev, selection];
            else newState = [...prev.slice(1), selection]; 
          }
        }
        console.log('[CardClickMultiSelect] Ability:', pendingAbilityRank, 'ServerStage:', serverStage, 'prev:', JSON.stringify(prev), 'selection:', JSON.stringify(selection), 'newState:', JSON.stringify(newState));
        return newState;
      });
      return;
    }
    
    // Fallback general selection removed. Card clicks only processed if they match an action context.
    // if (isOwnCard) {
    //     setSelectedHandCardIndex(prev => prev === cardIndex ? null : cardIndex); // For general selection feedback
    // }
    console.log('[CardClick] Click did not match any specific action criteria and was not processed for general selection.');
  };

  const getOwnCardsToShowFaceUp = useCallback(() => {
    if (!playerId || !clientPlayerState) return {};
    const cardsToShow: { [cardIndex: number]: boolean } = {};
    const pendingAbility = gameState.pendingAbilities && gameState.pendingAbilities.length > 0 ? gameState.pendingAbilities[0] : null;

    // Initial Peek reveal
    if (gameState.currentPhase === 'initialPeekPhase' && showPeekedCards && clientPlayerState.cardsToPeek && clientPlayerState.hand.length === 4) {
      // console.log('[PeekSystem-getOwnCardsToShowFaceUp] APPLYING initial peek visual. Cards to peek:', JSON.stringify(clientPlayerState.cardsToPeek));
      // Show cards at fixed indices 2 (bottom-left) and 3 (bottom-right) for a 4-card hand.
      // This assumes clientPlayerState.hand is ordered consistently with the server's 2x2 grid.
      // (0: TL, 1: TR, 2: BL, 3: BR)
      if (clientPlayerState.hand[2] && !('isHidden' in clientPlayerState.hand[2])) {
        cardsToShow[2] = true;
      }
      if (clientPlayerState.hand[3] && !('isHidden' in clientPlayerState.hand[3])) {
        cardsToShow[3] = true;
      }
    } else if (gameState.currentPhase === 'initialPeekPhase' && showPeekedCards) {
      // console.warn('[PeekSystem-getOwnCardsToShowFaceUp] In initial peek phase & showPeekedCards is true, but cardsToPeek is null or hand length is not 4. cardsToPeek:', clientPlayerState.cardsToPeek, 'Hand length:', clientPlayerState.hand.length);
    } else {
      // console.log('[PeekSystem-getOwnCardsToShowFaceUp] NOT applying initial peek. Phase:', gameState.currentPhase, 'showPeekedCards:', showPeekedCards, 'hasCompletedInitialPeek:', clientPlayerState?.hasCompletedInitialPeek);
    }
    
    // Ability Peek reveal (King/Queen) - show cards *after confirmation* and during client-side timer
    if (isResolvingPlayerForAbility &&
        pendingAbility &&
        (pendingAbility.card.rank === Rank.King || pendingAbility.card.rank === Rank.Queen) &&
        isAbilityPeekTimerActive && abilityPeekSelectionsConfirmed) {
        
        abilityPeekSelectionsConfirmed.forEach((loc) => {
            if (loc.playerID === playerId) { 
                 cardsToShow[loc.cardIndex] = true;
            }
        });
    }
    return cardsToShow;
  }, [playerId, clientPlayerState, gameState.currentPhase, showPeekedCards, isResolvingPlayerForAbility, gameState.pendingAbilities, abilityPeekSelectionsConfirmed, isAbilityPeekTimerActive]);

  const isViewingPlayerInitialPeekActive = gameState.currentPhase === 'initialPeekPhase' &&
                                         showPeekedCards &&
                                         !!clientPlayerState?.cardsToPeek &&
                                         !clientPlayerState?.hasCompletedInitialPeek;

  useEffect(() => {
    // console.log('[PeekSystem-Debug] isViewingPlayerInitialPeekActive changed:', isViewingPlayerInitialPeekActive);
  }, [isViewingPlayerInitialPeekActive]);

  const phaseBannerText = gameState.currentPhase.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

  const phaseBanner = (
    <div className="flex justify-center mt-1 mb-1 md:mb-1.5">
      <span className="px-3 py-0.5 rounded-full bg-neutral-700/80 text-neutral-200 text-xs font-medium shadow-sm backdrop-blur-sm">
        {phaseBannerText}
      </span>
    </div>
  );

  const turnIndicatorForPlayer = useCallback((pid: string) => (
    <span className={`block mt-0.5 mx-auto h-1.5 w-6 rounded-full ${(gameState.currentPlayerId === pid ? 'bg-accent shadow-sm shadow-accent animate-pulse' : 'bg-neutral-300 dark:bg-neutral-600')}`} />
  ), [gameState.currentPlayerId]);
  
  const opponentPlayerIds = Object.keys(gameState.players).filter(pid => pid !== playerId).sort((a,b) => gameState.turnOrder.indexOf(a) - gameState.turnOrder.indexOf(b));
  
  const opponentsArea = (
    <div 
      className={`w-full max-w-3xl px-1 ${ 
        opponentPlayerIds.length === 1 
          ? 'flex justify-center' 
          : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 justify-items-center'
      }`}
    >
      {opponentPlayerIds.length === 0 && <div className="italic text-gray-400 text-sm py-2 text-center col-span-full">Waiting for opponents...</div>}
      {opponentPlayerIds.map(opId => {
        const pState = gameState.players[opId];
        if (!pState) return <div key={opId} className="text-red-500 text-xs">Err: {opId.slice(-4)}</div>;
        
        let opponentCardsToForceShow = { ...(revealedCardLocations[opId] || {}) };
        const pendingAbility = gameState.pendingAbilities && gameState.pendingAbilities.length > 0 ? gameState.pendingAbilities[0] : null;

        // Show opponent cards selected for timed peek if timer is active
        if (isResolvingPlayerForAbility && 
            pendingAbility &&
            (pendingAbility.card.rank === Rank.King || pendingAbility.card.rank === Rank.Queen) &&
            isAbilityPeekTimerActive && abilityPeekSelectionsConfirmed) {
            
            abilityPeekSelectionsConfirmed.forEach((loc) => {
                if (loc.playerID === opId) {
                    opponentCardsToForceShow[loc.cardIndex] = true;
                }
            });
        }

        const abilityTargetsOnThisHand: AbilityTarget[] | undefined = 
          (isResolvingPlayerForAbility || 
           (gameState.lastPlayerToResolveAbility === playerId && gameState.globalAbilityTargets?.some(t => t.type === 'swap'))
          ) 
            ? undefined 
            : gameState.globalAbilityTargets?.filter(target => target.playerID === opId) as AbilityTarget[] | undefined;

        return (
          <div key={opId} className="flex flex-col items-center">
            <PlayerHandComponent
              playerID={opId}
              playerState={pState}
              actualHandForDisplay={pState.hand}
              onCardClick={(playerID: string, cardIndex: number) => handleCardClick(playerID, cardIndex)}
              isViewingPlayer={false}
              multiSelectedCardIndices={multiSelectedCardLocations.filter(loc => loc.playerID === opId).map(loc => loc.cardIndex)}
              cardsToForceShowFaceUp={opponentCardsToForceShow}
              abilityTargetsOnThisHand={abilityTargetsOnThisHand}
              isLocked={pState.isLocked}
              hasCalledCheck={pState.hasCalledCheck}
              lastRegularSwapInfo={gameState.lastRegularSwapInfo}
            />
            {turnIndicatorForPlayer(opId)}
          </div>
        );
      })}
    </div>
  );

  const getActions = () => {
    let currentActions = [];
    if (gameState.currentPhase === 'initialPeekPhase' && clientPlayerState && !clientPlayerState.isReadyForInitialPeek && !clientPlayerState.hasCompletedInitialPeek) {
      currentActions.push({ label: 'Ready for Peek', onClick: handleDeclareReadyForPeek, className: 'bg-sky-500 hover:bg-sky-600 text-white' });
    }
    
    if (clientPlayerState?.pendingDrawnCard) {
      const drawnCard = clientPlayerState.pendingDrawnCard;
      const drawnCardDetails = !('isHidden' in drawnCard) && drawnCard.rank && drawnCard.suit
        ? `${drawnCard.rank}${suitSymbols[drawnCard.suit]}` 
        : 'Card';
      
      // Only allow discarding if the card was drawn from the deck
      if (clientPlayerState.pendingDrawnCardSource === 'deck') {
        currentActions.push({ 
          label: `Discard Drawn ${drawnCardDetails}`, 
          onClick: handleDiscardDrawnCard, 
          className: 'bg-red-700/70 hover:bg-red-600/80 text-red-100 border border-red-600/50 text-xs px-2.5 py-1.5 md:px-3 md:py-2'
        });
      }
    } else if (isCurrentPlayer && (gameState.currentPhase === 'playPhase' || gameState.currentPhase === 'finalTurnsPhase') && !(gameState.pendingAbilities && gameState.pendingAbilities.length > 0)) {
      currentActions.push(createDrawDeckAction(handleDrawFromDeck, !canDrawFromDeck));
      currentActions.push(createDrawDiscardAction(handleDrawFromDiscard, !canDrawFromDiscard));
    }

    if (isInMatchingStage && gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId) && gameState.activePlayers[playerId] === 'awaitingMatchAction') {
      const canAttemptMatch = selectedHandCardIndex !== null;
      currentActions.push({
        label: playerHasUITriggeredPass ? "Passed - Waiting" : "Pass Match", 
        onClick: handlePassMatch, 
        disabled: playerHasUITriggeredPass || !(gameState.activePlayers[playerId] === 'awaitingMatchAction'),
        className: playerHasUITriggeredPass ? 'bg-neutral-500 text-neutral-300' : 'bg-yellow-500/80 hover:bg-yellow-600/90 text-neutral-800'
      });

      // New "Attempt Match" button
      if (!playerHasUITriggeredPass) { // Only show if player hasn't passed via UI
        currentActions.push({
          label: selectedHandCardIndex !== null && 
                 clientPlayerState?.hand[selectedHandCardIndex] // Check if card exists at index
            ? "Confirm Match with Selected?"
            : "Attempt Match",
          onClick: () => {
            if (selectedHandCardIndex !== null) {
              // The existing handleAttemptMatch function will be called by GameBoard
              handleAttemptMatch(selectedHandCardIndex);
            }
          },
          disabled: !canAttemptMatch,
          className: 'bg-green-500/80 hover:bg-green-600/90 text-white' 
        });
      }
    }

    if (isResolvingPlayerForAbility) {
      const abilityDetails = gameState.pendingAbilities?.[0];
      if (abilityDetails) {
        const abilityRank = abilityDetails.card.rank;
        const serverStage = abilityDetails.currentAbilityStage; // Use server stage for UI
        console.log(`[CheckGameBoard-getActions] Rendering actions for ${abilityRank}. Server stage: ${serverStage}`);
        const mainActionEnabled = canPlayerPerformAbilityAction();
        let mainActionLabel = "Resolve Ability";
        const currentSelections = multiSelectedCardLocations.length;

        // Determine Main Action Button Label and Disabled State based on serverStage
        if (abilityRank === Rank.King) {
          if (serverStage === 'peek') {
            // Peek stage now has its own confirmation
            if (isAbilityPeekTimerActive) {
              mainActionLabel = `Peeking... ${abilityPeekTimeLeft}s`;
            } else {
              mainActionLabel = `King - PEEK: Confirm ${currentSelections === 2 ? 'Selections' : `${2-currentSelections} more`}`;
            }
          } else if (serverStage === 'swap') { 
            mainActionLabel = `King - SWAP: Confirm ${currentSelections === 2 ? 'Selections' : `${2-currentSelections} more`}`;
          } else { mainActionLabel = `King: Finalize (Stage: ${serverStage || 'undefined'})`; } 
        } else if (abilityRank === Rank.Queen) {
          if (serverStage === 'peek') {
            if (isAbilityPeekTimerActive) {
              mainActionLabel = `Peeking... ${abilityPeekTimeLeft}s`;
            } else {
              mainActionLabel = `Queen - PEEK: Confirm ${currentSelections === 1 ? 'Selection' : `${1-currentSelections} more`}`;
            }
          } else if (serverStage === 'swap') { 
            mainActionLabel = `Queen - SWAP: Confirm ${currentSelections === 2 ? 'Selections' : `${2-currentSelections} more`}`;
          } else { mainActionLabel = `Queen: Finalize (Stage: ${serverStage || 'undefined'})`; } 
        } else if (abilityRank === Rank.Jack) { 
          mainActionLabel = `Jack - SWAP: Confirm ${currentSelections === 2 ? 'Selections' : `${2-currentSelections} more`}`;
        }

        currentActions.push({
          label: mainActionLabel,
          onClick: () => {
            if (isResolvingPlayerForAbility && abilityDetails && serverStage === 'peek' && (abilityRank === Rank.King || abilityRank === Rank.Queen) && !isAbilityPeekTimerActive) {
              if (canPlayerPerformAbilityAction()) { // Ensure correct number of selections
                console.log("[Client-AbilityPeek] Requesting server reveal for peek selections:", multiSelectedCardLocations);
                // First, request the server to send reveal data for these targets
                onPlayerAction('requestPeekReveal', { peekTargets: multiSelectedCardLocations }, (responseMessage, isError) => {
                  if (isError) {
                    setFeedbackMessage({ text: responseMessage || "Error requesting peek reveal from server.", type: 'error' });
                    return; // Don't start local timer if server request failed
                  }
                  // Server will send a gameStateUpdate with revealed cards if successful.
                  // Now, start the local timer for display duration.
                  console.log("[Client-AbilityPeek] Server ack for peek reveal request. Starting local display timer.");
                  setAbilityPeekSelectionsConfirmed([...multiSelectedCardLocations]);
                  setIsAbilityPeekTimerActive(true);
                  setAbilityPeekTimeLeft(PEEK_REVEAL_SECONDS); 
                });
              }
            } else if (serverStage === 'swap' || abilityRank === Rank.Jack) { // Handle regular swap
              handleResolveSpecialAbility(); // This is the original function that sends swapTargets
            }
          },
          disabled: (serverStage === 'peek' && (isAbilityPeekTimerActive || !mainActionEnabled)) || (serverStage !== 'peek' && !mainActionEnabled),
          className: 'bg-purple-500/80 hover:bg-purple-600/90 text-white text-xs px-2.5 py-1.5 md:px-3 md:py-2'
        });

        // Determine Skip Button Label based on serverStage
        let skipLabel = `Skip Full ${abilityRank} Ability`;
        if ((abilityRank === Rank.King || abilityRank === Rank.Queen)) {
          if (serverStage === 'peek') {
            skipLabel = `Skip ${abilityRank} PEEK Stage`;
          } else if (serverStage === 'swap') {
            skipLabel = `Skip ${abilityRank} SWAP Stage`;
          }
        } // For Jack, default 'Skip Full Ability' is fine, server handles it as skipping its single stage.
        currentActions.push({
          label: skipLabel,
          onClick: handleSkipAbility,
          disabled: isAbilityPeekTimerActive, // Disable skip if local peek reveal is active
          className: 'bg-gray-500 hover:bg-gray-600 text-white text-xs px-2.5 py-1.5 md:px-3 md:py-2'
        });
      }
    }
    
    if (canCallCheck) { 
      currentActions.push({ label: 'Call Check', onClick: handleCallCheck, className: 'bg-orange-500/90 hover:bg-orange-600 text-white' }); 
    }
    return currentActions;
  };
  
  const currentActionPhase = () => {
    if (gameState.currentPhase === 'initialPeekPhase') return 'Initial Peek';
    if (gameState.currentPhase === 'playPhase') return `Play: ${(gameState.players[gameState.currentPlayerId]?.name || `P-${gameState.currentPlayerId.slice(-4)}`)}\'s Turn`;
    if (gameState.currentPhase === 'matchingStage') return 'Matching Stage';
    if (gameState.currentPhase === 'abilityResolutionPhase') {
        const abilityPlayerName = gameState.pendingAbilities && gameState.pendingAbilities.length > 0 ? (gameState.players[gameState.pendingAbilities[0].playerId]?.name || `P-${gameState.pendingAbilities[0].playerId.slice(-4)}`) : '';
        const abilityCardRank = gameState.pendingAbilities && gameState.pendingAbilities.length > 0 ? gameState.pendingAbilities[0].card.rank : '';
        return `Resolve ${abilityCardRank} by ${abilityPlayerName}`;
    }
    if (gameState.currentPhase === 'finalTurnsPhase') return `Final Turn: ${(gameState.players[gameState.currentPlayerId]?.name || `P-${gameState.currentPlayerId.slice(-4)}`)}`;
    if (gameState.currentPhase === 'scoringPhase') return 'Scoring';
    if (gameState.currentPhase === 'gameOver') return 'Game Over';
    return gameState.currentPhase.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  };

  let actionBarPrompt = "";
  if (isInMatchingStage && gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId)) {
    if (playerHasUITriggeredPass) {
      actionBarPrompt = "You have passed for this match. Waiting for others...";
    } else if (selectedHandCardIndex !== null && clientPlayerState?.hand[selectedHandCardIndex]) {
      actionBarPrompt = `Selected card at position ${selectedHandCardIndex + 1}. Click 'Confirm Match' or select another card, or pass.`;
    } else {
      actionBarPrompt = "MATCH STAGE: Click a card from your hand to select it for a match, then confirm. Or 'Pass Match'.";
    }
  } else if (isResolvingPlayerForAbility) {
    const ability = gameState.pendingAbilities[0];
    const serverStage = ability.currentAbilityStage; 
    console.log(`[CheckGameBoard-actionBarPrompt] Rendering prompt for ${ability.card.rank}. Server stage: ${serverStage}`);
    const currentSelections = multiSelectedCardLocations.length;

    if (isAbilityPeekTimerActive && abilityPeekSelectionsConfirmed) {
      actionBarPrompt = `Revealing peeked cards... ${abilityPeekTimeLeft}s`;
    } else if (ability.card.rank === Rank.King) {
        if (serverStage === 'peek') actionBarPrompt = `King - PEEK: Select ${Math.max(0, 2 - currentSelections)} card(s) to peek. Confirm selection.`;
        else if (serverStage === 'swap') actionBarPrompt = `King - SWAP: Select ${Math.max(0, 2 - currentSelections)} card(s) to swap.`;
        else actionBarPrompt = `King: Complete action. (Stage: ${serverStage || 'undefined'})`; 
    } else if (ability.card.rank === Rank.Queen) {
        if (serverStage === 'peek') actionBarPrompt = `Queen - PEEK: Select ${Math.max(0, 1 - currentSelections)} card to peek. Confirm selection.`;
        else if (serverStage === 'swap') actionBarPrompt = `Queen - SWAP: Select ${Math.max(0, 2 - currentSelections)} card(s) to swap.`;
        else actionBarPrompt = `Queen: Complete action. (Stage: ${serverStage || 'undefined'})`; 
    } else if (ability.card.rank === Rank.Jack) {
        actionBarPrompt = `Jack - SWAP: Select ${Math.max(0, 2 - currentSelections)} card(s) to swap.`;
    } else {
        actionBarPrompt = "Resolve your pending ability.";
    }
  }
  
  // Log the discard pile state just before rendering, for debugging the visual glitch
  console.log(
    '[CheckGameBoard] About to render. Discard Pile (top 5):',
    JSON.stringify(
      gameState.discardPile
        ?.map(c => ({ rank: c.rank, suit: c.suit, isHidden: (c as any).isHidden ?? false }))
        .slice(0, 5)
    )
  );

  const transformedScores = gameState.gameover?.scores 
    ? Object.entries(gameState.gameover.scores).map(([pId, score]) => ({
        name: gameState.players[pId]?.name || `P-${pId.slice(-6)}`, 
        score: typeof score === 'number' ? score : 0, 
      }))
    : [];
  
  const winnerName = gameState.gameover?.winner
    ? (Array.isArray(gameState.gameover.winner)
        ? gameState.gameover.winner.map(wId => gameState.players[wId]?.name || `P-${wId.slice(-6)}`).join(' & ')
        : gameState.players[gameState.gameover.winner]?.name || `P-${gameState.gameover.winner.slice(-6)}`)
    : "";

  const finalHandsForModal = gameState.gameover?.finalHands 
    ? Object.entries(gameState.gameover.finalHands).map(([pId, hand]) => ({
        playerName: gameState.players[pId]?.name || `P-${pId.slice(-6)}`,
        cards: hand, 
      }))
    : [];

  const totalTurnsForModal = gameState.gameover?.totalTurns;
  const playerStatsForModal = gameState.gameover?.playerStats
    ? Object.entries(gameState.gameover.playerStats).map(([pId, stats]) => ({
        name: stats.name || `P-${pId.slice(-6)}`, // Already has name from server
        numMatches: stats.numMatches,
        numPenalties: stats.numPenalties,
      }))
    : [];

  // Determine if the discard pile should be visually locked for the current player
  let displayDiscardPileAsLocked = !!gameState.topDiscardIsSpecialOrUnusable;
  if (playerId === gameState.currentPlayerId && 
      gameState.currentPhase === 'abilityResolutionPhase' && 
      gameState.pendingAbilities && gameState.pendingAbilities.length > 0 && 
      gameState.pendingAbilities[0].playerId === playerId) {
    
    const currentAbility = gameState.pendingAbilities[0];
    const topDiscard = gameState.discardPile.length > 0 ? gameState.discardPile[0] : null;

    if (topDiscard && 
        topDiscard.rank === currentAbility.card.rank && 
        topDiscard.suit === currentAbility.card.suit &&
        (currentAbility.source === 'discard' || currentAbility.source === 'stackSecondOfPair')) {
      // If the player is resolving their own special card that just went to discard (and isn't sealed by a separate match)
      // don't show the lock *just* because it's a K,Q,J.
      // If `gameState.discardPileIsSealed` is true (due to a match), it should remain locked.
      if (!gameState.discardPileIsSealed) {
        displayDiscardPileAsLocked = false;
      }
    }
  }

  // ---- START DEBUG LOG ----
  const shouldHideForSelfAfterSwap = gameState.lastPlayerToResolveAbility === playerId && gameState.globalAbilityTargets?.some(t => t.type === 'swap');
  const finalHideCondition = isResolvingPlayerForAbility || shouldHideForSelfAfterSwap;
  console.log(`[IconDebug-OwnHand] PlayerID: ${playerId.slice(-4)}, lastResolver: ${gameState.lastPlayerToResolveAbility ? gameState.lastPlayerToResolveAbility.slice(-4) : 'null'}, GATs: ${JSON.stringify(gameState.globalAbilityTargets)}, isResolving: ${isResolvingPlayerForAbility}, shouldHideForSelfAfterSwap: ${shouldHideForSelfAfterSwap}, finalHide: ${finalHideCondition}`);
  // ---- END DEBUG LOG ----

  return (
    <div className="flex flex-col flex-grow w-full items-center font-sans select-none px-1 sm:px-2 md:px-3">
      <div className="w-full flex flex-col flex-grow items-center overflow-y-auto">
        <div className="w-full flex flex-col items-center flex-shrink-0 pt-0.5 md:pt-1">
          {phaseBanner}
          {opponentsArea}
        </div>
        <div className="flex flex-col items-center justify-center w-full py-1 md:py-1.5 my-1 md:my-2 flex-shrink-0">
          <div className="flex flex-row items-end justify-center gap-2 md:gap-3">
            <DrawPileComponent 
              numberOfCards={gameState.deckSize} 
              canDraw={canDrawFromDeck}
              onClick={handleDrawFromDeck}
            />
            {/* Held Card Display Area */}
            <AnimatePresence>
              {clientPlayerState?.pendingDrawnCard && (
                <motion.div
                  className="pb-1"
                  initial={{ opacity: 0, y: -20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <div className="flex flex-col items-center p-1">
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-0.5 font-medium">Holding:</p>
                    <div className="w-14 md:w-16 aspect-[2.5/3.5] ring-2 ring-accent rounded-lg shadow-md">
                      <CardComponent card={clientPlayerState.pendingDrawnCard} isFaceUp={true} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Log the discard pile before rendering the component */}
            {/* {console.log('[CheckGameBoard] Rendering DiscardPile. gameState.discardPile:', JSON.stringify(gameState.discardPile?.map(c => ({rank: c.rank, suit: c.suit, isHidden: (c as any).isHidden ?? false })).slice(0,5)) )} */}
            <DiscardPileComponent
              topCard={gameState.discardPile.length > 0 ? gameState.discardPile[0] : null}
              numberOfCards={gameState.discardPile.length}
              isSealed={displayDiscardPileAsLocked}
              canDraw={canDrawFromDiscard}
              onClick={handleDrawFromDiscard}
            />
          </div>
          {!isCurrentPlayer && !clientPlayerState?.pendingDrawnCard && gameState.currentPhase !== 'matchingStage' && gameState.currentPhase !== 'abilityResolutionPhase' && gameState.currentPhase !== 'gameOver' && gameState.currentPhase !== 'scoringPhase' && (
             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Waiting for {gameState.players[gameState.currentPlayerId]?.name || `P-${gameState.currentPlayerId.slice(-4)}`}\'s turn...</p>
           )}
        </div>
        <div className="w-full flex flex-col items-center mt-auto pb-24 sm:pb-28 md:pb-32 flex-shrink-0">
          {/* Prompt specifically for hand interaction when card is held - THIS WILL BE MOVED TO ACTION BAR */}
          {/* {clientPlayerState?.pendingDrawnCard && isCurrentPlayer && (
            <p className="text-sm text-center text-neutral-700 dark:text-neutral-300 mb-1.5 p-1.5 bg-black/5 dark:bg-white/5 rounded-md shadow">
              Click a card in your hand to swap, or use 'Discard Drawn Card' action.
            </p>
          )} */}
          <PlayerHandComponent
            playerID={playerId}
            playerState={clientPlayerState}
            actualHandForDisplay={clientPlayerState.hand}
            onCardClick={(playerID: string, cardIndex: number) => handleCardClick(playerID, cardIndex)}
            isViewingPlayer={true}
            selectedCardIndices={selectedHandCardIndex !== null ? [selectedHandCardIndex] : []}
            multiSelectedCardIndices={multiSelectedCardLocations.filter(loc => loc.playerID === playerId).map(loc => loc.cardIndex)}
            cardsToForceShowFaceUp={getOwnCardsToShowFaceUp()}
            abilityTargetsOnThisHand={ (
              finalHideCondition // Use the logged combined condition
            ) 
              ? undefined 
              : gameState.globalAbilityTargets?.filter(target => target.playerID === playerId) as AbilityTarget[] | undefined
            }
            isLocked={clientPlayerState.isLocked}
            hasCalledCheck={clientPlayerState.hasCalledCheck}
            cardsBeingPeeked={isViewingPlayerInitialPeekActive ? clientPlayerState.cardsToPeek : null}
            isInitialPeekActive={isViewingPlayerInitialPeekActive}
            swappingOutCardId={swappingOutCardId}
            lastRegularSwapInfo={gameState.lastRegularSwapInfo}
          />
           {turnIndicatorForPlayer(playerId)}
        </div>
      </div>

      <ActionBarComponent 
        actions={getActions()} 
      >
        {/* Updated logic for displaying the correct prompt via ActionBarComponent's children */} 
        {(peekGetReadyTimer !== null) 
          ? <p className="text-center text-xs text-neutral-300 px-2">Get Ready to Peek: {peekGetReadyTimer}s</p>
          : (peekRevealTimer !== null && showPeekedCards)
          ? <p className="text-center text-xs text-neutral-300 px-2">Memorize Your Cards: {peekRevealTimer}s</p>
          : feedbackMessage 
          ? <p className={`text-center text-xs px-2 ${feedbackMessage.type === 'error' ? 'text-red-400' : feedbackMessage.type === 'success' ? 'text-green-400' : 'text-sky-400'}`}>{feedbackMessage.text}</p>
          : (clientPlayerState?.pendingDrawnCard && isCurrentPlayer) 
          ? <p className="text-center text-xs text-neutral-300 px-2">Click a card in your hand to swap, or use 'Discard Drawn Card' action.</p>
          : actionBarPrompt && <p className="text-center text-xs text-neutral-300 px-2">{actionBarPrompt}</p>}
      </ActionBarComponent>
      
      <AnimatePresence>
        {showEndModal && (
          <EndOfGameModal
            open={showEndModal}
            onClose={() => setShowEndModal(false)} 
            winner={winnerName} 
            scores={transformedScores} 
            finalHands={finalHandsForModal}
            onPlayAgain={handlePlayAgain}
            totalTurns={totalTurnsForModal}
            playerStats={playerStatsForModal}
          />
        )}
      </AnimatePresence>
      
      {/* Conditionally rendered debug panel at the bottom of this component */}
      {showDebugPanel && (
        <div className="w-full mt-2 p-1 bg-neutral-700/80 text-neutral-200 text-[0.5rem] leading-tight rounded shadow max-h-32 overflow-auto">
          <h4 className="font-semibold text-xs mb-0.5">Debug State:</h4>
          <pre className="text-[0.45rem]" style={{backgroundColor: 'rgba(0,0,0,0.6)'}}>
            {JSON.stringify({ 
              pId: playerId.slice(-4), cur: isCurrentPlayer, phase: gameState.currentPhase.slice(0,10),
              turn: (gameState.players[gameState.currentPlayerId]?.name || `P-${gameState.currentPlayerId.slice(-4)}`),
              dk: gameState.deckSize, dcP: gameState.discardPile.length, myH: clientPlayerState.hand.length,
              passUI: playerHasUITriggeredPass,
              modal: showEndModal,
              draw: clientPlayerState.pendingDrawnCard ? (!('isHidden' in clientPlayerState.pendingDrawnCard) ? `${clientPlayerState.pendingDrawnCard.rank}${clientPlayerState.pendingDrawnCard.suit}`: 'H') : 'N',
              match: gameState.matchingOpportunityInfo ? gameState.matchingOpportunityInfo.cardToMatch.rank : 'N',
              abil: gameState.pendingAbilities?.map(a => a.card.rank).join(','),
              selH: selectedHandCardIndex,
              msl: multiSelectedCardLocations.map(l => `${l.playerID.slice(-1)}${l.cardIndex}`).join(','),
              abilA: abilityArgs ? JSON.stringify(abilityArgs).length : 0,
            }, null, 1)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default CheckGameBoard;