import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ClientCheckGameState, Card, ClientPlayerState, InitialPlayerSetupData, ClientCard } from 'shared-types'; 
import { Rank } from 'shared-types'; 
import PlayerHandComponent from './PlayerHandComponent';
import DrawPileComponent from './DrawPileComponent';
import DiscardPileComponent from './DiscardPileComponent';
import CardComponent from './CardComponent';
import ActionBarComponent, { createDrawDeckAction, createDrawDiscardAction } from './ActionBarComponent'; 
import EndOfGameModal from './EndOfGameModal';
import PlayerStatusDisplay from './PlayerStatusDisplay';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';

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
  turnSegmentTrigger: string | number; 
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

const CheckGameBoard: React.FC<CheckGameBoardProps> = ({ 
  gameState, 
  playerId, 
  onPlayerAction, 
  gameId, 
  showDebugPanel, 
  onReturnToLobby,
  turnSegmentTrigger
}) => {
  const clientPlayerState = gameState.players[playerId]; 
  const [selectedHandCardIndex, setSelectedHandCardIndex] = useState<number | null>(null);
  const [revealedCardLocations, setRevealedCardLocations] = useState<{ [playerID: string]: { [cardIndex: number]: boolean } }>({});
  const [multiSelectedCardLocations, setMultiSelectedCardLocations] = useState<{ playerID: string, cardIndex: number }[]>([]);
  const [abilityArgs, setAbilityArgs] = useState<AbilityClientArgs | null>(null); 
  const [swappingOutCardId, setSwappingOutCardId] = useState<string | null>(null);
  const swappingOutCardIdClearTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isAnimatingCardFromDeck, setIsAnimatingCardFromDeck] = useState(false);
  const [revealDrawnCardFace, setRevealDrawnCardFace] = useState(false);

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
  const [matchingStageTimeLeft, setMatchingStageTimeLeft] = useState<number | null>(null);

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
      
      console.log(`[Client] Skipping ability: ${abilityRank}, Server Stage: ${serverStage}, Effective Skip Type: ${skipType}`);
      onPlayerAction('resolveSpecialAbility', {
        abilityCard: abilityToResolve.card,
        args: { skipAbility: true, skipType: skipType } 
      });
    }
  }, [isResolvingPlayerForAbility, gameState.pendingAbilities, onPlayerAction]);

  useEffect(() => {
    const currentPendingAbility = gameState.pendingAbilities && gameState.pendingAbilities.length > 0 ? gameState.pendingAbilities[0] : null;
    const pendingAbilitySignature = currentPendingAbility
      ? `${currentPendingAbility.playerId}-${currentPendingAbility.card.rank}-${currentPendingAbility.card.suit}-${currentPendingAbility.source}-${currentPendingAbility.currentAbilityStage || 'initial'}`
      : null;

    const shouldReset = prevSignatureRef.current !== pendingAbilitySignature || !isResolvingPlayerForAbility;

    if (shouldReset && (abilityArgs !== null || multiSelectedCardLocations.length > 0)) {
      console.log('[AbilityResetEffect] Conditions met for resetting ability selections.');
      setAbilityArgs(null);
      setMultiSelectedCardLocations([]);
    }
    prevSignatureRef.current = pendingAbilitySignature;
  }, [gameState.pendingAbilities, isResolvingPlayerForAbility, abilityArgs, multiSelectedCardLocations]);

  const clearAllPeekIntervals = useCallback(() => {
    if (getReadyIntervalRef.current) clearInterval(getReadyIntervalRef.current);
    getReadyIntervalRef.current = null;
    if (revealIntervalRef.current) clearInterval(revealIntervalRef.current);
    revealIntervalRef.current = null;
    if (swappingOutCardIdClearTimerRef.current) {
      clearTimeout(swappingOutCardIdClearTimerRef.current);
      swappingOutCardIdClearTimerRef.current = null;
    }
  }, []);

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
        console.log('[PeekSystem-MainEffect-DEBUG] Initiating GET READY countdown.');
        setPeekGetReadyTimer(INITIAL_PEEK_GET_READY_DURATION_S);
        setShowPeekedCards(false); 
        clearAllPeekIntervals(); 
        processedCardsToPeekRef.current = clientPlayerState.cardsToPeek; 
      } else if (!clientPlayerState.cardsToPeek) {
        processedCardsToPeekRef.current = null; 
        if (peekGetReadyTimer !== null || peekRevealTimer !== null || showPeekedCards) {
            clearAllPeekIntervals();
            setPeekGetReadyTimer(null);
            setPeekRevealTimer(null);
            setShowPeekedCards(false);
        }
      }
    } else {
      if (peekGetReadyTimer !== null || peekRevealTimer !== null || showPeekedCards) {
        clearAllPeekIntervals();
        setPeekGetReadyTimer(null);
        setPeekRevealTimer(null);
        setShowPeekedCards(false);
      }
      processedCardsToPeekRef.current = null; 
    }
    return clearAllPeekIntervals;
  }, [
    gameState.currentPhase, 
    clientPlayerState?.hasCompletedInitialPeek, 
    clientPlayerState?.cardsToPeek, 
    clearAllPeekIntervals, 
    showPeekedCards, peekGetReadyTimer, peekRevealTimer 
  ]);

  useEffect(() => {
    let flipTimerId: NodeJS.Timeout | null = null;
    if (clientPlayerState?.pendingDrawnCard && !isAnimatingCardFromDeck && !revealDrawnCardFace) {
      flipTimerId = setTimeout(() => {
        setRevealDrawnCardFace(true);
      }, 150); 
    } else if (!clientPlayerState?.pendingDrawnCard) {
      setRevealDrawnCardFace(false);
    }
    return () => {
      if (flipTimerId) clearTimeout(flipTimerId);
    };
  }, [clientPlayerState?.pendingDrawnCard, isAnimatingCardFromDeck, revealDrawnCardFace]);

  useEffect(() => {
    if (peekGetReadyTimer === null) return;
    if (peekGetReadyTimer > 0) {
      getReadyIntervalRef.current = setInterval(() => {
        setPeekGetReadyTimer(prev => (prev !== null ? Math.max(0, prev - 1) : null));
      }, 1000);
    } else if (peekGetReadyTimer === 0) {
      if (getReadyIntervalRef.current) clearInterval(getReadyIntervalRef.current); 
      getReadyIntervalRef.current = null;
      setPeekGetReadyTimer(null); 
      setPeekRevealTimer(INITIAL_PEEK_REVEAL_DURATION_S); 
      setShowPeekedCards(true); 
    }
    return () => {
      if (getReadyIntervalRef.current) {
        clearInterval(getReadyIntervalRef.current);
        getReadyIntervalRef.current = null;
      }
    };
  }, [peekGetReadyTimer]);

  useEffect(() => {
    if (peekRevealTimer === null) return;
    if (peekRevealTimer > 0) {
      revealIntervalRef.current = setInterval(() => {
        setPeekRevealTimer(prev => (prev !== null ? Math.max(0, prev - 1) : null));
      }, 1000);
    } else if (peekRevealTimer === 0) {
      if (revealIntervalRef.current) clearInterval(revealIntervalRef.current);
      revealIntervalRef.current = null;
      setPeekRevealTimer(null); 
      setShowPeekedCards(false); 
    }
    return () => {
      if (revealIntervalRef.current) {
        clearInterval(revealIntervalRef.current);
        revealIntervalRef.current = null;
      }
    };
  }, [peekRevealTimer]);

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
        console.log(`[Client-AbilityPeek] Timed reveal finished. Sending completion to server.`);
        onPlayerAction('resolveSpecialAbility', { 
          abilityCard: abilityToResolve.card, 
          args: { peekTargets: abilityPeekSelectionsConfirmed } 
        });
      }
      setAbilityPeekSelectionsConfirmed(null); 
    }
  }, [isAbilityPeekTimerActive, abilityPeekTimeLeft, gameState.pendingAbilities, abilityPeekSelectionsConfirmed, onPlayerAction]);

  useEffect(() => {
    const newOppKey = gameState.matchingOpportunityInfo 
      ? `${gameState.matchingOpportunityInfo.originalPlayerID}-${gameState.matchingOpportunityInfo.cardToMatch.rank}-${gameState.matchingOpportunityInfo.cardToMatch.suit}` 
      : null;
    if (currentMatchingOpportunityKeyRef.current !== newOppKey) {
      console.log('[MatchUIResetEffect] New matching opportunity or current one ended. Resetting UI.');
      setPlayerHasUITriggeredPass(false);
      setSelectedHandCardIndex(null); 
    }
    currentMatchingOpportunityKeyRef.current = newOppKey;
    if (gameState.matchingOpportunityInfo && !gameState.activePlayers[playerId] && playerHasUITriggeredPass && newOppKey === currentMatchingOpportunityKeyRef.current) {
      if (selectedHandCardIndex !== null) {
      }
    }
  }, [gameState.matchingOpportunityInfo, gameState.activePlayers, playerId, playerHasUITriggeredPass, selectedHandCardIndex]);

  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => {
        setFeedbackMessage(null);
      }, 3000); 
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  useEffect(() => {
    if (gameState.matchingStageTimerExpiresAt && gameState.currentPhase === 'matchingStage') {
      const updateTimer = () => {
        const now = Date.now();
        const timeLeftSeconds = Math.max(0, Math.floor((gameState.matchingStageTimerExpiresAt! - now) / 1000));
        setMatchingStageTimeLeft(timeLeftSeconds);
        if (timeLeftSeconds === 0) {
          // Server will handle timeout logic, client just stops countdown
          setMatchingStageTimeLeft(null);
        }
      };
      updateTimer(); // Initial call
      const intervalId = setInterval(updateTimer, 1000);
      return () => clearInterval(intervalId);
    } else {
      setMatchingStageTimeLeft(null); // Clear if no timer or not in matching stage
    }
  }, [gameState.matchingStageTimerExpiresAt, gameState.currentPhase]);

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
      setIsAnimatingCardFromDeck(true);
      onPlayerAction('drawFromDeck');
      setSelectedHandCardIndex(null);
      setFeedbackMessage(null); 
      setTimeout(() => {
        setIsAnimatingCardFromDeck(false);
      }, 350); 
    }
  };

  const handleDrawFromDiscard = () => {
    if (canDrawFromDiscard) {
      onPlayerAction('drawFromDiscard');
      setSelectedHandCardIndex(null);
      setFeedbackMessage(null); 
    }
  };

  const handleSwapAndDiscard = (handIndex: number) => {
    if (isCurrentPlayer && clientPlayerState?.pendingDrawnCard && (gameState.currentPhase === 'playPhase' || gameState.currentPhase === 'finalTurnsPhase')) {
      const cardToSwap = clientPlayerState.hand[handIndex];
      if (cardToSwap && !('isHidden' in cardToSwap) && cardToSwap.id) {
        if (swappingOutCardIdClearTimerRef.current) {
          clearTimeout(swappingOutCardIdClearTimerRef.current);
        }
        setSwappingOutCardId(cardToSwap.id); 
        console.log(`[SwapAnim] Setting swappingOutCardId to ${cardToSwap.id}`);
        swappingOutCardIdClearTimerRef.current = setTimeout(() => {
          setSwappingOutCardId(null); 
          swappingOutCardIdClearTimerRef.current = null;
          console.log(`[SwapAnim] Cleared swappingOutCardId (was ${cardToSwap.id}).`);
        }, 600); 
      } else {
        console.warn('[SwapAnim] Could not set swappingOutCardId: Card not found or no ID.');
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
          setFeedbackMessage({ text: "You passed the match.", type: 'info' });
        }
      });
      setPlayerHasUITriggeredPass(true); 
      setSelectedHandCardIndex(null); 
    } else {
      console.warn(`[Client] Player ${playerId} WILL NOT call passMatch.`);
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
      const serverStage = abilityToResolve.currentAbilityStage; 
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
        if (currentSelections.length === 2) { 
          finalArgs = { swapTargets: currentSelections };
          actionToSend = true;
        }
      }
      
      if (actionToSend) {
        console.log(`[Client] Resolving ability: ${abilityToResolve.card.rank}. Sending args:`, finalArgs);
        onPlayerAction('resolveSpecialAbility', { abilityCard: abilityToResolve.card, args: finalArgs });
      } else {
        console.warn(`[Client] handleResolveSpecialAbility: Action NOT sent.`);
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
    if (currentPhase === 'initialPeekPhase') return; 

    if (clientPlayerState.pendingDrawnCard && isOwnCard && isCurrentPlayer && (currentPhase === 'playPhase' || currentPhase === 'finalTurnsPhase')) {
      handleSwapAndDiscard(cardIndex); 
      return;
    }

    if (currentPhase === 'matchingStage' && 
        isOwnCard && 
        gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId) && 
        !playerHasUITriggeredPass && 
        gameState.activePlayers[playerId] === 'awaitingMatchAction' 
      ) {
      setSelectedHandCardIndex(prev => prev === cardIndex ? null : cardIndex); 
      return; 
    }

    if (currentPhase === 'abilityResolutionPhase' && isResolvingPlayerForAbility && pendingAbilityRank) {
      const serverStage = currentPlayerPendingAbilityDetails.currentAbilityStage;
      const selection = { playerID: clickedPlayerID, cardIndex };
      const alreadySelected = multiSelectedCardLocations.some(s => s.playerID === clickedPlayerID && s.cardIndex === cardIndex);
      
      if (gameState.players[clickedPlayerID]?.isLocked) {
        console.warn(`[CardClick] Attempted to select card from locked player ${clickedPlayerID}.`);
        return;
      }

      setMultiSelectedCardLocations(prev => {
        let newState: Array<{ playerID: string; cardIndex: number }> = [...prev]; 

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
            if (prev.length < 2) newState = [...prev, selection];
            else newState = [...prev.slice(1), selection]; 
          }
        }
        console.log('[CardClickMultiSelect] newState:', JSON.stringify(newState));
        return newState;
      });
      return;
    }
    
    console.log('[CardClick] Click did not match any specific action criteria.');
  };

  const getOwnCardsToShowFaceUp = useCallback(() => {
    if (!playerId || !clientPlayerState) return {};
    const cardsToShow: { [cardIndex: number]: boolean } = {};
    const pendingAbility = gameState.pendingAbilities && gameState.pendingAbilities.length > 0 ? gameState.pendingAbilities[0] : null;

    if (gameState.currentPhase === 'initialPeekPhase' && showPeekedCards && clientPlayerState.cardsToPeek && clientPlayerState.hand.length === 4) {
      if (clientPlayerState.hand[2] && !('isHidden' in clientPlayerState.hand[2])) {
        cardsToShow[2] = true;
      }
      if (clientPlayerState.hand[3] && !('isHidden' in clientPlayerState.hand[3])) {
        cardsToShow[3] = true;
      }
    } 
    
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
  }, [isViewingPlayerInitialPeekActive]);

  const phaseBannerText = gameState.currentPhase.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

  const phaseBanner = (
    <div className="flex justify-center mt-1 mb-1 md:mb-1.5">
      <AnimatePresence mode='wait'>
        <motion.span
          key={phaseBannerText}
          className="px-3 py-0.5 rounded-full bg-neutral-700/80 text-neutral-200 text-xs font-medium shadow-sm backdrop-blur-sm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
        >
          {phaseBannerText}
        </motion.span>
      </AnimatePresence>
    </div>
  );

  const matchingStageTimerDisplay = (
    gameState.currentPhase === 'matchingStage' && matchingStageTimeLeft !== null && (
      <div className="w-full text-center mb-1">
        <p className="text-sm font-semibold text-accent animate-pulse">
          Matching Time: {matchingStageTimeLeft}s
        </p>
      </div>
    )
  );

  const turnIndicatorForPlayer = useCallback((pid: string) => (
    <span className={`block mt-0.5 mx-auto h-1.5 w-6 rounded-full transition-colors duration-300 ease-in-out ${(gameState.currentPlayerId === pid ? 'bg-accent shadow-sm shadow-accent animate-pulse' : 'bg-neutral-300 dark:bg-neutral-600')}`} />
  ), [gameState.currentPlayerId]);
  
  const isMyTurn = gameState.currentPlayerId === playerId;
  const viewingPlayerClientState = gameState.players[playerId];

  const playerIdsInOrder = gameState.turnOrder.filter(pId => pId !== playerId);
  playerIdsInOrder.unshift(playerId); 
  const displayablePlayerIds = playerIdsInOrder.filter(pId => gameState.players[pId]);
  const opponentPlayerIds = displayablePlayerIds.filter(pId => pId !== playerId);

  const mainGridStructure = () => {
    const numOpponents = opponentPlayerIds.length;
    if (numOpponents === 0) return 'grid-cols-1'; 
    if (numOpponents === 1) return 'grid-cols-1 md:grid-cols-2'; 
    if (numOpponents === 2) return 'grid-cols-1 md:grid-cols-3'; 
    if (numOpponents === 3) return 'grid-cols-2 md:grid-cols-2 lg:grid-cols-4'; 
    return 'grid-cols-2 md:grid-cols-3'; 
  };

  const getPlayerSpecificGlobalTargets = useCallback((pId: string): AbilityTarget[] | undefined => {
    if (gameState.currentPhase === 'abilityResolutionPhase' && gameState.pendingAbilities && gameState.pendingAbilities.length > 0) {
      const pendingAbility = gameState.pendingAbilities[0];
      if (pendingAbility.playerId === pId) {
        if (pendingAbility.card.rank === Rank.King || pendingAbility.card.rank === Rank.Queen) {
          return gameState.globalAbilityTargets?.filter(t => t.playerID === pId && t.type === 'swap') as AbilityTarget[];
        }
      }
    }
    return undefined;
  }, [gameState.currentPhase, gameState.pendingAbilities, gameState.globalAbilityTargets]);

  const getActions = () => {
    let currentActions = [];
    if (
      gameState.currentPhase === 'initialPeekPhase' && 
      clientPlayerState && 
      !clientPlayerState.isReadyForInitialPeek && 
      !clientPlayerState.hasCompletedInitialPeek &&
      Object.keys(gameState.players).length >= 2 
    ) {
      currentActions.push({ label: 'Ready for Peek', onClick: handleDeclareReadyForPeek, className: 'bg-sky-500 hover:bg-sky-600 text-white' });
    }
    
    if (clientPlayerState?.pendingDrawnCard) {
      const drawnCard = clientPlayerState.pendingDrawnCard;
      const drawnCardDetails = !('isHidden' in drawnCard) && drawnCard.rank && drawnCard.suit
        ? `${drawnCard.rank}${suitSymbols[drawnCard.suit]}` 
        : 'Card';
      
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

      if (!playerHasUITriggeredPass) { 
        currentActions.push({
          label: selectedHandCardIndex !== null && 
                 clientPlayerState?.hand[selectedHandCardIndex] 
            ? "Confirm Match with Selected?"
            : "Attempt Match",
          onClick: () => {
            if (selectedHandCardIndex !== null) {
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
        const serverStage = abilityDetails.currentAbilityStage; 
        console.log(`[CheckGameBoard-getActions] Rendering actions for ${abilityRank}. Server stage: ${serverStage}`);
        const mainActionEnabled = canPlayerPerformAbilityAction();
        let mainActionLabel = "Resolve Ability";
        const currentSelections = multiSelectedCardLocations.length;

        if (abilityRank === Rank.King) {
          if (serverStage === 'peek') {
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
              if (canPlayerPerformAbilityAction()) { 
                console.log("[Client-AbilityPeek] Requesting server reveal for peek selections:", multiSelectedCardLocations);
                onPlayerAction('requestPeekReveal', { peekTargets: multiSelectedCardLocations }, (responseMessage, isError) => {
                  if (isError) {
                    setFeedbackMessage({ text: responseMessage || "Error requesting peek reveal from server.", type: 'error' });
                    return; 
                  }
                  console.log("[Client-AbilityPeek] Server ack for peek reveal request. Starting local display timer.");
                  setAbilityPeekSelectionsConfirmed([...multiSelectedCardLocations]);
                  setIsAbilityPeekTimerActive(true);
                  setAbilityPeekTimeLeft(PEEK_REVEAL_SECONDS); 
                });
              }
            } else if (serverStage === 'swap' || abilityRank === Rank.Jack) { 
              handleResolveSpecialAbility(); 
            }
          },
          disabled: (serverStage === 'peek' && (isAbilityPeekTimerActive || !mainActionEnabled)) || (serverStage !== 'peek' && !mainActionEnabled),
          className: 'bg-purple-500/80 hover:bg-purple-600/90 text-white text-xs px-2.5 py-1.5 md:px-3 md:py-2'
        });

        let skipLabel = `Skip Full ${abilityRank} Ability`;
        if ((abilityRank === Rank.King || abilityRank === Rank.Queen)) {
          if (serverStage === 'peek') {
            skipLabel = `Skip ${abilityRank} PEEK Stage`;
          } else if (serverStage === 'swap') {
            skipLabel = `Skip ${abilityRank} SWAP Stage`;
          }
        } 
        currentActions.push({
          label: skipLabel,
          onClick: handleSkipAbility,
          disabled: isAbilityPeekTimerActive, 
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
    if (gameState.currentPhase === 'playPhase') return `Play: ${(gameState.players[gameState.currentPlayerId]?.name || `P-${gameState.currentPlayerId.slice(-4)}`)}'s Turn`;
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
        name: stats.name || `P-${pId.slice(-6)}`, 
        numMatches: stats.numMatches,
        numPenalties: stats.numPenalties,
      }))
    : [];

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
      if (!gameState.discardPileIsSealed) {
        displayDiscardPileAsLocked = false;
      }
    }
  }

  const shouldHideForSelfAfterSwap = gameState.lastPlayerToResolveAbility === playerId && gameState.globalAbilityTargets?.some(t => t.type === 'swap');
  const finalHideCondition = isResolvingPlayerForAbility || shouldHideForSelfAfterSwap;
  console.log(`[IconDebug-OwnHand] PlayerID: ${playerId.slice(-4)}, lastResolver: ${gameState.lastPlayerToResolveAbility ? gameState.lastPlayerToResolveAbility.slice(-4) : 'null'}, GATs: ${JSON.stringify(gameState.globalAbilityTargets)}, isResolving: ${isResolvingPlayerForAbility}, shouldHideForSelfAfterSwap: ${shouldHideForSelfAfterSwap}, finalHide: ${finalHideCondition}`);
    
  return (
    <div className="flex flex-col flex-grow w-full items-center font-sans select-none px-1 sm:px-2 md:px-3">
      <div className="w-full flex flex-col flex-grow items-center overflow-y-auto">
        <div className="w-full flex flex-col items-center flex-shrink-0 pt-0.5 md:pt-1">
          {phaseBanner}
          {matchingStageTimerDisplay}
          {opponentPlayerIds.map((pId) => {
            const opponentState = gameState.players[pId];
            if (!opponentState) return null; 
            return (
              <div key={pId} className="flex flex-col items-center w-full">
                <PlayerStatusDisplay
                  playerID={pId}
                  playerState={opponentState}
                  isCurrentPlayer={gameState.currentPlayerId === pId}
                  turnTimerExpiresAt={gameState.playerTimers?.[pId]?.turnTimerExpiresAt ?? null}
                  disconnectGraceTimerExpiresAt={gameState.playerTimers?.[pId]?.disconnectGraceTimerExpiresAt ?? null}
                  isViewingPlayer={false}
                  turnSegmentIdentifier={pId === gameState.currentPlayerId ? turnSegmentTrigger : undefined}
                />
                <PlayerHandComponent
                  playerID={pId}
                  playerState={opponentState}
                  actualHandForDisplay={opponentState.hand} 
                  onCardClick={handleCardClick}
                  isViewingPlayer={false}
                  selectedCardIndices={selectedHandCardIndex !== null && pId === playerId ? [selectedHandCardIndex] : []} 
                  multiSelectedCardIndices={multiSelectedCardLocations.filter(loc => loc.playerID === pId).map(loc => loc.cardIndex)}
                  cardsToForceShowFaceUp={{}}
                  abilityTargetsOnThisHand={getPlayerSpecificGlobalTargets(pId)}
                  isLocked={opponentState.isLocked}
                  hasCalledCheck={opponentState.hasCalledCheck}
                  lastRegularSwapInfo={gameState.lastRegularSwapInfo} 
                />
              </div>
            );
          })}
        </div>
        <div className="flex flex-col items-center justify-center w-full py-1 md:py-1.5 my-1 md:my-2 flex-shrink-0">
          <motion.div
            layout
            layoutScroll
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex flex-row items-end justify-center gap-2 md:gap-3"
          >
            <LayoutGroup>
              <DrawPileComponent 
                numberOfCards={gameState.deckSize} 
                canDraw={canDrawFromDeck}
                onClick={handleDrawFromDeck}
                isAnimatingDraw={isAnimatingCardFromDeck}
              />

              <AnimatePresence mode="popLayout">
                {(clientPlayerState?.pendingDrawnCard || isAnimatingCardFromDeck) && (
                  <motion.div
                    key="holding-area-wrapper"
                    className="flex flex-col items-center overflow-hidden flex-shrink-0 p-1 origin-top"
                    style={{ height: 105 }} 
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    exit={{ scaleY: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <motion.div
                      className="flex flex-col items-center w-full h-full"
                    >
                      {isAnimatingCardFromDeck ? (
                        <motion.div
                          key="placeholder-drawn-card"
                          className="w-full h-full flex items-center justify-center"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <div className="w-12 md:w-14 aspect-[2.5/3.5]">
                            <CardComponent card={null} isFaceUp={false} isInteractive={false} disableHoverEffect={true}/>
                          </div>
                        </motion.div>
                      ) : clientPlayerState?.pendingDrawnCard ? (
                        <motion.div
                          key="actual-drawn-card"
                          className="w-full h-full flex flex-col items-center justify-center"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-0.5 font-medium">Holding:</p>
                          <div className="w-12 md:w-14 aspect-[2.5/3.5] ring-2 ring-accent rounded-lg shadow-md">
                            <CardComponent card={clientPlayerState.pendingDrawnCard} isFaceUp={revealDrawnCardFace} />
                          </div>
                        </motion.div>
                      ) : null}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <DiscardPileComponent
                topCard={gameState.discardPile.length > 0 ? gameState.discardPile[0] : null}
                numberOfCards={gameState.discardPile.length}
                isSealed={displayDiscardPileAsLocked}
                canDraw={canDrawFromDiscard}
                onClick={handleDrawFromDiscard}
              />
            </LayoutGroup>
          </motion.div>
          {/* Player Turn Indicator */}
          {gameState.currentPhase !== 'gameOver' && gameState.currentPlayerId !== playerId && (
            <div className="text-center my-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 animate-pulse">Waiting for {gameState.players[gameState.currentPlayerId]?.name || `P-${gameState.currentPlayerId.slice(-4)}`}'s turn...</p>
            </div>
          )}
        </div>
        <div className="w-full flex flex-col items-center mt-auto pb-24 sm:pb-28 md:pb-32 flex-shrink-0">
          <PlayerStatusDisplay
            playerID={playerId}
            playerState={clientPlayerState}
            isCurrentPlayer={playerId === gameState.currentPlayerId}
            turnTimerExpiresAt={gameState.playerTimers?.[playerId]?.turnTimerExpiresAt ?? null}
            disconnectGraceTimerExpiresAt={gameState.playerTimers?.[playerId]?.disconnectGraceTimerExpiresAt ?? null}
            isViewingPlayer={true}
            turnSegmentIdentifier={playerId === gameState.currentPlayerId ? turnSegmentTrigger : undefined}
          />
          <PlayerHandComponent
            playerID={playerId}
            playerState={clientPlayerState}
            actualHandForDisplay={clientPlayerState?.hand || []} 
            onCardClick={handleCardClick}
            isViewingPlayer={true}
            selectedCardIndices={selectedHandCardIndex !== null ? [selectedHandCardIndex] : []}
            multiSelectedCardIndices={multiSelectedCardLocations.filter(loc => loc.playerID === playerId).map(loc => loc.cardIndex)}
            cardsToForceShowFaceUp={getOwnCardsToShowFaceUp()}
            abilityTargetsOnThisHand={getPlayerSpecificGlobalTargets(playerId)}
            isLocked={clientPlayerState?.isLocked || false}
            hasCalledCheck={clientPlayerState?.hasCalledCheck || false}
            cardsBeingPeeked={showPeekedCards ? processedCardsToPeekRef.current : null} 
            isInitialPeekActive={showPeekedCards || (peekGetReadyTimer !== null || peekRevealTimer !== null)}
            swappingOutCardId={swappingOutCardId}
          />
           {turnIndicatorForPlayer(playerId)}
        </div>
      </div>

      <ActionBarComponent 
        actions={getActions()} 
      >
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