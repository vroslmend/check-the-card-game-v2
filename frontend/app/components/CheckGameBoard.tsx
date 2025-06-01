import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ClientCheckGameState, Card, ClientPlayerState, InitialPlayerSetupData, ClientCard } from 'shared-types'; 
import { Rank } from 'shared-types'; 
import PlayerHandComponent from './PlayerHandComponent';
import DrawPileComponent from './DrawPileComponent';
import DiscardPileComponent from './DiscardPileComponent';
import CardComponent from './CardComponent';
import ActionBarComponent, { createDrawDeckAction, createDrawDiscardAction } from './ActionBarComponent'; 
import EndOfGameModal from './EndOfGameModal';

const PEEK_COUNTDOWN_SECONDS = 3; 
const PEEK_REVEAL_SECONDS = 5;    

interface AbilityClientArgs {
  peekTargets?: Array<{ playerID: string; cardIndex: number }>;
  // swapTargets are typically built from multiSelectedCardLocations right before sending
  peekSkipped?: boolean; 
}

interface CheckGameBoardProps {
  gameState: ClientCheckGameState;
  playerId: string; 
  onPlayerAction: (type: string, payload?: any) => void; 
  gameId: string; 
  showDebugPanel: boolean;
  onReturnToLobby: () => void;
}

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
  const [peekCountdown, setPeekCountdown] = useState<number>(PEEK_COUNTDOWN_SECONDS); 
  const [isPeekRevealActive, setIsPeekRevealActive] = useState<boolean>(false); 

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevSignatureRef = React.useRef<string | null>(null);
  
  const { showEndModal, setShowEndModal, handlePlayAgain } = useEndModal(gameState.gameover, onReturnToLobby);

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

  useEffect(() => {
    console.log('[PeekEffect] Running with new gameState:', { phase: gameState.currentPhase, playerId, clientPlayerStateHasCompletedPeek: clientPlayerState?.hasCompletedInitialPeek });
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);

    if (gameState.currentPhase === 'initialPeekPhase' && clientPlayerState && !clientPlayerState.hasCompletedInitialPeek) {
      if (clientPlayerState.cardsToPeek && clientPlayerState.peekAcknowledgeDeadline) {
        const now = Date.now();
        const deadline = clientPlayerState.peekAcknowledgeDeadline;
        const countdownDuration = Math.max(0, Math.floor((deadline - now) / 1000));
        setPeekCountdown(countdownDuration);
        setIsPeekRevealActive(true); 

        if (countdownDuration > 0) {
          countdownTimerRef.current = setInterval(() => {
            setPeekCountdown(prev => {
              if (prev <= 1) {
                if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                setIsPeekRevealActive(false); 
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
           setIsPeekRevealActive(false); 
        }
      } else if (!clientPlayerState.isReadyForInitialPeek) {
        setIsPeekRevealActive(false);
        setPeekCountdown(PEEK_COUNTDOWN_SECONDS); 
      } else {
        setIsPeekRevealActive(false);
      }
    } else {
      setIsPeekRevealActive(false);
      setPeekCountdown(PEEK_COUNTDOWN_SECONDS); 
    }
    return () => {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, [
    gameState.currentPhase, 
    playerId, 
    clientPlayerState?.hasCompletedInitialPeek, 
    clientPlayerState?.isReadyForInitialPeek,
    clientPlayerState?.cardsToPeek,
    clientPlayerState?.peekAcknowledgeDeadline,
  ]);

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
  const canDrawFromDiscard = canPerformStandardPlayPhaseActions && !gameState.topDiscardIsSpecialOrUnusable;
  const canCallCheck = canPerformStandardPlayPhaseActions && gameState.currentPhase === 'playPhase' && !clientPlayerState?.hasCalledCheck;

  const handleDrawFromDeck = () => {
    if (canDrawFromDeck) {
      onPlayerAction('drawFromDeck');
      setSelectedHandCardIndex(null);
    }
  };

  const handleDrawFromDiscard = () => {
    if (canDrawFromDiscard) {
      onPlayerAction('drawFromDiscard');
      setSelectedHandCardIndex(null);
    }
  };

  const handleSwapAndDiscard = (handIndex: number) => {
    if (isCurrentPlayer && clientPlayerState?.pendingDrawnCard && (gameState.currentPhase === 'playPhase' || gameState.currentPhase === 'finalTurnsPhase')) {
      onPlayerAction('swapAndDiscard', { handIndex });
      setSelectedHandCardIndex(null);
    }
  };

  const handleDiscardDrawnCard = () => {
    if (isCurrentPlayer && clientPlayerState?.pendingDrawnCard && (gameState.currentPhase === 'playPhase' || gameState.currentPhase === 'finalTurnsPhase')) {
      onPlayerAction('discardDrawnCard');
      setSelectedHandCardIndex(null);
    }
  };

  const handleAttemptMatch = (handIndex: number) => {
    if (isInMatchingStage && gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId)) {
      onPlayerAction('attemptMatch', { handIndex });
      setSelectedHandCardIndex(null); 
    }
  };

  const handlePassMatch = useCallback(() => {
    if (isInMatchingStage && gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId)) {
      onPlayerAction('passMatch');
    } else {
      console.warn(`[Client] Player ${playerId} WILL NOT call passMatch. Conditions: isInMatchingStage=${isInMatchingStage}, isPotentialMatcher=${gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId)}`);
    }
  }, [onPlayerAction, playerId, gameState.currentPhase, gameState.matchingOpportunityInfo, isInMatchingStage]);

  const handleCallCheck = () => {
    if (canCallCheck) {
      onPlayerAction('callCheck');
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

    // Scenario 2: Matching stage, player clicks own card to attempt a match
    if (currentPhase === 'matchingStage' && isOwnCard && gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId)) {
      handleAttemptMatch(cardIndex); // Directly trigger match attempt
      return;
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
    
    if (isOwnCard) {
        setSelectedHandCardIndex(prev => prev === cardIndex ? null : cardIndex); // For general selection feedback
    }
    console.log('[CardClick] Click did not match any specific action criteria.');
  };

  const getOwnCardsToShowFaceUp = useCallback(() => {
    if (!playerId || !clientPlayerState) return {};
    const cardsToShow: { [cardIndex: number]: boolean } = {};
    // Initial Peek reveal
    if (gameState.currentPhase === 'initialPeekPhase' && clientPlayerState.cardsToPeek && isPeekRevealActive) {
      clientPlayerState.cardsToPeek.forEach(peekCard => {
        const handIndex = clientPlayerState.hand.findIndex(handCard => 
            !('isHidden' in handCard) && handCard.rank === peekCard.rank && handCard.suit === peekCard.suit
        );
        if (handIndex !== -1) cardsToShow[handIndex] = true;
      });
    }
    // Ability Peek reveal (King/Queen)
    if (isResolvingPlayerForAbility && abilityArgs?.peekTargets && (gameState.pendingAbilities[0].card.rank === Rank.King || gameState.pendingAbilities[0].card.rank === Rank.Queen) ) {
        abilityArgs.peekTargets.forEach((loc: {playerID: string, cardIndex: number}) => {
            // Show peeked cards regardless of whose they are, if this client initiated the peek.
            // The PlayerHandComponent will only render its own cards face up based on this.
            // For opponents, server would need to send revealed state.
            if (loc.playerID === playerId) { // Only force show for this player's hand if they are peeking their own
                 cardsToShow[loc.cardIndex] = true;
            }
            // To show peeked opponent cards, revealedCardLocations would need to be populated by server.
             if (revealedCardLocations[loc.playerID]?.[loc.cardIndex]) {
                 // This part is tricky - getOwnCardsToShowFaceUp is for *own* hand.
                 // Showing opponent cards revealed by peek needs to be handled in opponentsArea mapping.
             }
        });
    }
    return cardsToShow;
  }, [playerId, clientPlayerState, gameState.currentPhase, isPeekRevealActive, isResolvingPlayerForAbility, abilityArgs, gameState.pendingAbilities, revealedCardLocations]);

  const isViewingPlayerInitialPeekActive = gameState.currentPhase === 'initialPeekPhase' && 
    !!clientPlayerState?.cardsToPeek && 
    isPeekRevealActive && 
    !clientPlayerState.hasCompletedInitialPeek;

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
        if (isResolvingPlayerForAbility && playerId === gameState.pendingAbilities[0].playerId && abilityArgs?.peekTargets) {
            console.log(`[OpponentPeek] For opponent ${opId}, current abilityArgs.peekTargets:`, JSON.stringify(abilityArgs.peekTargets));
            const abilityRank = gameState.pendingAbilities[0].card.rank;
            if (abilityRank === Rank.King || abilityRank === Rank.Queen) {
                abilityArgs.peekTargets.forEach((loc: {playerID: string, cardIndex: number}) => {
                    if (loc.playerID === opId) {
                        opponentCardsToForceShow[loc.cardIndex] = true;
                    }
                });
            }
            console.log(`[OpponentPeek] For opponent ${opId}, opponentCardsToForceShow is now:`, JSON.stringify(opponentCardsToForceShow));
        }

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
              isLocked={pState.isLocked}
              hasCalledCheck={pState.hasCalledCheck}
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

    if (isInMatchingStage && gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId)) {
      currentActions.push({ label: 'Pass Match', onClick: handlePassMatch, className: 'bg-yellow-500/80 hover:bg-yellow-600/90 text-neutral-800' });
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
            mainActionLabel = `King - PEEK: Confirm ${2 - currentSelections} selections`;
          } else if (serverStage === 'swap') {
            mainActionLabel = `King - SWAP: Confirm ${2 - currentSelections} selections`;
          } else { mainActionLabel = `King: Finalize (Stage: ${serverStage || 'undefined'})`; } // More specific fallback
        } else if (abilityRank === Rank.Queen) {
          if (serverStage === 'peek') {
            mainActionLabel = `Queen - PEEK: Confirm ${1 - currentSelections} selection`;
          } else if (serverStage === 'swap') {
            mainActionLabel = `Queen - SWAP: Confirm ${2 - currentSelections} selections`;
          } else { mainActionLabel = `Queen: Finalize (Stage: ${serverStage || 'undefined'})`; } // More specific fallback
        } else if (abilityRank === Rank.Jack) { // Jack only has swap stage implicitly
          mainActionLabel = `Jack - SWAP: Confirm ${2 - currentSelections} selections`;
        }

        currentActions.push({
          label: mainActionLabel,
          onClick: handleResolveSpecialAbility,
          disabled: !mainActionEnabled,
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
    actionBarPrompt = "Click a card from your hand to attempt a match, or 'Pass Match'.";
  } else if (isResolvingPlayerForAbility) {
    const ability = gameState.pendingAbilities[0];
    const serverStage = ability.currentAbilityStage; // Use server stage for prompt
    console.log(`[CheckGameBoard-actionBarPrompt] Rendering prompt for ${ability.card.rank}. Server stage: ${serverStage}`);
    const currentSelections = multiSelectedCardLocations.length;

    if (ability.card.rank === Rank.King) {
        if (serverStage === 'peek') actionBarPrompt = `King - PEEK: Select ${2 - currentSelections} more card(s).`;
        else if (serverStage === 'swap') actionBarPrompt = `King - SWAP: Select ${2 - currentSelections} more card(s) to swap.`;
        else actionBarPrompt = `King: Complete action. (Stage: ${serverStage || 'undefined'})`; // More specific fallback
    } else if (ability.card.rank === Rank.Queen) {
        if (serverStage === 'peek') actionBarPrompt = `Queen - PEEK: Select ${1 - currentSelections} more card.`;
        else if (serverStage === 'swap') actionBarPrompt = `Queen - SWAP: Select ${2 - currentSelections} more card(s) to swap.`;
        else actionBarPrompt = `Queen: Complete action. (Stage: ${serverStage || 'undefined'})`; // More specific fallback
    } else if (ability.card.rank === Rank.Jack) {
        actionBarPrompt = `Jack - SWAP: Select ${2 - currentSelections} more card(s) to swap.`;
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
        cards: hand, // hand should already be Array<Card> with id from server
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
            {clientPlayerState?.pendingDrawnCard && (
              <div className="pb-1">
                <div className="flex flex-col items-center p-1">
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-0.5 font-medium">Holding:</p>
                  <div className="w-14 md:w-16 ring-2 ring-accent rounded-lg shadow-md">
                    <CardComponent card={clientPlayerState.pendingDrawnCard} isFaceUp={true} />
                  </div>
                </div>
              </div>
            )}
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
            isLocked={clientPlayerState.isLocked}
            hasCalledCheck={clientPlayerState.hasCalledCheck}
            cardsBeingPeeked={isViewingPlayerInitialPeekActive ? clientPlayerState.cardsToPeek : null}
            isInitialPeekActive={isViewingPlayerInitialPeekActive}
          />
           {turnIndicatorForPlayer(playerId)}
        </div>
      </div>

      <ActionBarComponent 
        actions={getActions()} 
      >
        {/* Updated logic for displaying the correct prompt via ActionBarComponent's children */} 
        {(clientPlayerState?.pendingDrawnCard && isCurrentPlayer) 
          ? <p className="text-center text-xs text-neutral-300 px-2">Click a card in your hand to swap, or use 'Discard Drawn Card' action.</p>
          : actionBarPrompt && <p className="text-center text-xs text-neutral-300 px-2">{actionBarPrompt}</p>}
      </ActionBarComponent>
      
      <EndOfGameModal
        open={showEndModal}
        onClose={() => setShowEndModal(false)} 
        winner={winnerName} 
        scores={transformedScores} 
        finalHands={finalHandsForModal}
        onPlayAgain={handlePlayAgain}
      />
      
      {/* Conditionally rendered debug panel at the bottom of this component */}
      {showDebugPanel && (
        <div className="w-full mt-2 p-1 bg-neutral-700/80 text-neutral-200 text-[0.5rem] leading-tight rounded shadow max-h-32 overflow-auto">
          <h4 className="font-semibold text-xs mb-0.5">Debug State:</h4>
          <pre className="text-[0.45rem]" style={{backgroundColor: 'rgba(0,0,0,0.6)'}}>
            {JSON.stringify({ 
              pId: playerId.slice(-4), cur: isCurrentPlayer, phase: gameState.currentPhase.slice(0,10),
              turn: (gameState.players[gameState.currentPlayerId]?.name || `P-${gameState.currentPlayerId.slice(-4)}`),
              dk: gameState.deckSize, dcP: gameState.discardPile.length, myH: clientPlayerState.hand.length,
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