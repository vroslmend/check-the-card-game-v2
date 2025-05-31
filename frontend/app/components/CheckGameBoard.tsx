import React, { useState, useEffect, useCallback, useRef } from 'react';
// import type { Ctx } from 'boardgame.io'; // REMOVED
import type { ClientCheckGameState, Card, ClientPlayerState, InitialPlayerSetupData } from 'shared-types'; // UPDATED: Assuming ClientPlayerState, InitialPlayerSetupData might be needed or can be refined.
import { Rank } from 'shared-types';
import PlayerHandComponent from './PlayerHandComponent';
import DrawPileComponent from './DrawPileComponent';
import DiscardPileComponent from './DiscardPileComponent';
import CardComponent from './CardComponent';

const PEEK_COUNTDOWN_SECONDS = 3; // This might become server-driven or removed
const PEEK_REVEAL_SECONDS = 5;    // This might become server-driven or removed

// Define the props for the game board
interface CheckGameBoardProps {
  gameState: ClientCheckGameState;
  playerId: string; // Now always a string, as game won't render without it
  onPlayerAction: (type: string, payload?: any) => void; // Function to send actions to the server
}

const CheckGameBoard: React.FC<CheckGameBoardProps> = ({ gameState, playerId, onPlayerAction }) => {
  // Directly use gameState and playerId. G, ctx, moves, isActive are removed.
  // const typedG = G as ActualCheckGameState; // REMOVED - use gameState directly
  const clientPlayerState = gameState.players[playerId]; // Assuming players is always populated if gameState is valid
  // const currentStage = playerID && ctx.activePlayers ? ctx.activePlayers[playerID] : null; // REMOVED - derive from gameState.currentPhase and player-specific states

  const [selectedHandCardIndex, setSelectedHandCardIndex] = useState<number | null>(null);
  const [revealedCardLocations, setRevealedCardLocations] = useState<{ [playerID: string]: { [cardIndex: number]: boolean } }>({});
  const [multiSelectedCardLocations, setMultiSelectedCardLocations] = useState<{ playerID: string, cardIndex: number }[]>([]);
  const [abilityArgs, setAbilityArgs] = useState<any>(null); // This might be simplified or its structure changed

  // State for the new initial peek flow - will likely be driven by gameState
  const [peekCountdown, setPeekCountdown] = useState<number>(PEEK_COUNTDOWN_SECONDS); // Potentially remove or sync with server
  const [isPeekRevealActive, setIsPeekRevealActive] = useState<boolean>(false); // Potentially remove or sync with server

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const revealTimerRef = useRef<NodeJS.Timeout | null>(null);
  // const serverTimerCheckIntervalRef = useRef<NodeJS.Timeout | null>(null); // REMOVED - server handles timing

  // Memoize the move function if it's part of the moves object // REMOVED - actions go via onPlayerAction
  // const checkInitialPeekTimerMove = moves?.checkInitialPeekTimer; // REMOVED

  useEffect(() => {
    // console.log('[PeekEffect] Running:', { phase: ctx.phase, playerID, currentStage, ts: typedG?.initialPeekAllReadyTimestamp, countdown: peekCountdown, revealActive: isPeekRevealActive, completedPeek: clientPlayerState?.hasCompletedInitialPeek });
    console.log('[PeekEffect] Running with new gameState:', { phase: gameState.currentPhase, playerId, clientPlayerState });

    // Clear previous timers
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    // if (serverTimerCheckIntervalRef.current) clearInterval(serverTimerCheckIntervalRef.current); // REMOVED

    if (gameState.currentPhase === 'initialPeekPhase' && clientPlayerState && !clientPlayerState.hasCompletedInitialPeek) {
      // The server now controls the timing and stages of the peek.
      // The client should react to `gameState.players[playerId].cardsToPeek` being populated
      // and `gameState.players[playerId].peekAcknowledgeDeadline`.

      // For client-side countdown visualization (if still desired, though server dictates end)
      if (clientPlayerState.cardsToPeek && clientPlayerState.peekAcknowledgeDeadline) {
        const now = Date.now();
        const deadline = clientPlayerState.peekAcknowledgeDeadline;
        const countdownDuration = Math.max(0, Math.floor((deadline - now) / 1000));
        setPeekCountdown(countdownDuration);
        setIsPeekRevealActive(true); // Show cards if cardsToPeek is present

        if (countdownDuration > 0) {
          countdownTimerRef.current = setInterval(() => {
            setPeekCountdown(prev => {
              if (prev <= 1) {
                if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                // Server will move to next phase or handle timeout
                // Client might want to visually hide cards or show "waiting"
                setIsPeekRevealActive(false); // Example: hide after client countdown
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
           setIsPeekRevealActive(false); // If deadline already passed
        }
      } else if (!clientPlayerState.isReadyForInitialPeek) {
        // Player needs to declare they are ready
        setIsPeekRevealActive(false);
        setPeekCountdown(PEEK_COUNTDOWN_SECONDS); // Reset visual
      } else {
        // Player is ready but server hasn't sent cardsToPeek yet, or peek is over for this player
        setIsPeekRevealActive(false);
         // No specific countdown here, waiting on server.
      }

    } else {
      // Not in initialPeekPhase or peek completed for this player
      setIsPeekRevealActive(false);
      setPeekCountdown(PEEK_COUNTDOWN_SECONDS); // Reset visual
    }

    return () => {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current); // Though revealTimerRef is not set in new logic
    };
  }, [
    gameState.currentPhase, 
    playerId, 
    clientPlayerState?.hasCompletedInitialPeek, 
    clientPlayerState?.isReadyForInitialPeek,
    clientPlayerState?.cardsToPeek,
    clientPlayerState?.peekAcknowledgeDeadline,
    // gameState.initialPeekAllReadyTimestamp, // REMOVED or find equivalent if needed
  ]);

  // if (!G || G.players === undefined || !typedG) { // REPLACED
  if (!gameState || !gameState.players || !clientPlayerState) {
    return <div className="p-4">Loading game state or error... (Player ID: {playerId})</div>;
  }

  // currentPlayerFromG is used further down, ensure it's defined after G/typedG checks // REPLACED
  const currentPlayerFromGameState = gameState.players[gameState.currentPlayerId];

  // It would be good practice to also memoize other move calls if `moves` object itself is unstable. // REMOVED
  // For example:
  // const declareReadyForPeekMove = moves?.declareReadyForPeek; // REMOVED
  const handleDeclareReadyForPeek = useCallback(() => {
    // if (declareReadyForPeekMove && clientPlayerState && !clientPlayerState.isReadyForInitialPeek) { // REPLACED
    if (clientPlayerState && !clientPlayerState.isReadyForInitialPeek && gameState.currentPhase === 'initialPeekPhase') {
      // declareReadyForPeekMove(); // REPLACED
      onPlayerAction('declareReadyForPeek');
    }
  }, [onPlayerAction, clientPlayerState, gameState.currentPhase]);
  
  // const handleAcknowledgePeek = useCallback(() => { // REMOVE THIS FUNCTION
  //   if (clientPlayerState?.cardsToPeek && !clientPlayerState.hasCompletedInitialPeek && gameState.currentPhase === 'initialPeekPhase') {
  //       onPlayerAction('acknowledgePeek');
  //       setIsPeekRevealActive(false); // Hide cards immediately after acknowledging
  //       if (countdownTimerRef.current) clearInterval(countdownTimerRef.current); // Stop any client countdown
  //   }
  // }, [onPlayerAction, clientPlayerState, gameState.currentPhase]);


  // --- Action Conditionals ---
  // const isInMatchingStage = !!(playerID && ctx.phase === 'matchingStage' && ctx.activePlayers?.[playerID]); // REPLACED
  const isCurrentPlayer = gameState.currentPlayerId === playerId;
  // A player is "active" in a phase if they are the current player OR if the phase allows actions from non-current players (e.g. matching)
  // For matchingStage, the server's `gameState.activePlayers` (if we add it back) or specific flags like `matchingOpportunityInfo` would guide this.
  // For now, let's assume if it's matchingStage, relevant players can act based on `matchingOpportunityInfo`.
  const isInMatchingStage = gameState.currentPhase === 'matchingStage' && !!gameState.matchingOpportunityInfo;
  const canAttemptMatchForCurrentPlayer = isInMatchingStage && gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId);


  useEffect(() => {
    if (isInMatchingStage) {
      console.log(`[Client] Player ${playerId} detected isInMatchingStage. Opportunity:`, gameState.matchingOpportunityInfo);
    }
  }, [isInMatchingStage, playerId, gameState.matchingOpportunityInfo]);

  // const isInAbilityResolutionStage = !!(isActive && playerID && ctx.activePlayers?.[playerID] === 'abilityResolutionStage' && clientPlayerState?.pendingSpecialAbility); // REPLACED
  // Server's `gameState.pendingAbilities` and `gameState.currentPlayerId` (if it's the player whose turn it is to resolve) will determine this.
  // Or, a specific flag on the player state if they are the one to act.
  const isResolvingPlayerForAbility = gameState.currentPhase === 'abilityResolutionPhase' && 
                                   gameState.pendingAbilities && 
                                   gameState.pendingAbilities.length > 0 &&
                                   gameState.pendingAbilities[0].playerId === playerId;


  // const canPerformStandardPlayPhaseActions = isActive && // REPLACED isActive with isCurrentPlayer
  //                                       ctx.phase === 'playPhase' && // REPLACED ctx.phase
  //                                       !isInMatchingStage && // Condition remains conceptually
  //                                       !isInAbilityResolutionStage && // Condition remains conceptually // REPLACED
  //                                       !clientPlayerState?.pendingDrawnCard && // Condition remains
  //                                       !clientPlayerState?.pendingSpecialAbility; // Condition remains

  const canPerformStandardPlayPhaseActions = isCurrentPlayer &&
                                        gameState.currentPhase === 'playPhase' &&
                                        !clientPlayerState?.pendingDrawnCard &&
                                        ! (gameState.pendingAbilities && gameState.pendingAbilities.length > 0); // check if any abilities are pending.

  const canDrawFromDeck = canPerformStandardPlayPhaseActions;
  // const canDrawFromDiscard = canPerformStandardPlayPhaseActions && !typedG.discardPileIsSealed; // REPLACED typedG
  const canDrawFromDiscard = canPerformStandardPlayPhaseActions && !gameState.discardPileIsSealed;

  // const canCallCheck = canPerformStandardPlayPhaseActions && // isActive is part of canPerformStandardPlayPhaseActions
  //                      ctx.currentPlayer === playerID && // Explicitly check if it's their turn for callCheck // Already handled by isCurrentPlayer
  //                      !clientPlayerState?.hasCalledCheck; // REPLACED
  const canCallCheck = canPerformStandardPlayPhaseActions && !clientPlayerState?.hasCalledCheck;


  // --- Move Handler Placeholders --- // Update to use onPlayerAction
  const handleDrawFromDeck = () => {
    // if (isActive && moves.drawFromDeck) { // REPLACED
    if (canDrawFromDeck) {
      // moves.drawFromDeck(); // REPLACED
      onPlayerAction('drawFromDeck');
      setSelectedHandCardIndex(null);
    }
  };

  const handleDrawFromDiscard = () => {
    // if (isActive && moves.drawFromDiscard && !typedG.discardPileIsSealed) { // REPLACED
    if (canDrawFromDiscard) {
      // moves.drawFromDiscard(); // REPLACED
      onPlayerAction('drawFromDiscard');
      setSelectedHandCardIndex(null);
    }
  };

  const handleSwapAndDiscard = (handIndex: number) => {
    // if (isActive && moves.swapAndDiscard && clientPlayerState?.pendingDrawnCard) { // REPLACED
    if (isCurrentPlayer && clientPlayerState?.pendingDrawnCard && (gameState.currentPhase === 'playPhase' || gameState.currentPhase === 'finalTurnsPhase')) {
      // moves.swapAndDiscard(handIndex); // REPLACED
      onPlayerAction('swapAndDiscard', { handIndex });
      setSelectedHandCardIndex(null);
    }
  };

  const handleDiscardDrawnCard = () => {
    // if (isActive && moves.discardDrawnCard && clientPlayerState?.pendingDrawnCard) { // REPLACED
    if (isCurrentPlayer && clientPlayerState?.pendingDrawnCard && (gameState.currentPhase === 'playPhase' || gameState.currentPhase === 'finalTurnsPhase')) {
      // moves.discardDrawnCard(); // REPLACED
      onPlayerAction('discardDrawnCard');
      setSelectedHandCardIndex(null);
    }
  };

  const handleAttemptMatch = (handIndex: number) => {
    // if (moves.attemptMatch && ctx.phase === 'matchingStage') { // REPLACED
    // No isActive check for matchingStage, as any player can attempt
    // This is now controlled by `canAttemptMatchForCurrentPlayer` or similar server-side logic for who *can* match
    if (isInMatchingStage && gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId)) {
      // moves.attemptMatch(handIndex); // REPLACED
      onPlayerAction('attemptMatch', { handIndex });
      setSelectedHandCardIndex(null); // Still useful for client UI
    }
  };

  const handlePassMatch = useCallback(() => {
    // console.log(`[Client] handlePassMatch by ${playerID}. Phase: ${ctx.phase}`); // REPLACED
    // console.log(`[Client] ctx.allowedMoves for handlePassMatch:`, (ctx as any).allowedMoves); // REMOVED
    // console.log(`[Client] ctx.hasOwnProperty('allowedMoves') in handlePassMatch:`, ctx.hasOwnProperty('allowedMoves')); // REMOVED
    console.log(`[Client] handlePassMatch by ${playerId}. Phase: ${gameState.currentPhase}`);


    // if (moves.passMatch &&  // REPLACED
    //     playerID && 
    //     ctx.phase === 'matchingStage' && 
    //     ctx.activePlayers && 
    //     ctx.activePlayers[playerID] 
    //    ) {
    if (isInMatchingStage && gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId)) {
      console.log(`[Client] Player ${playerId} attempting to call onPlayerAction('passMatch')`);
      // moves.passMatch(); // REPLACED
      onPlayerAction('passMatch');
    } else {
      console.warn(`[Client] Player ${playerId} WILL NOT call passMatch. Conditions: isInMatchingStage=${isInMatchingStage}, isPotentialMatcher=${gameState.matchingOpportunityInfo?.potentialMatchers.includes(playerId)}`);
    }
  // }, [moves, playerID, ctx, isActive]); // REPLACED dependencies
  }, [onPlayerAction, playerId, gameState.currentPhase, gameState.matchingOpportunityInfo, isInMatchingStage]);

  const handleCallCheck = () => {
    // if (isActive && moves.callCheck) { // REPLACED
    if (canCallCheck) {
      // moves.callCheck(); // REPLACED
      onPlayerAction('callCheck');
    }
  };

  // This handler might need adjustment based on how peeking other players' cards is initiated.
  // For initial self-peek, it's simpler and driven by server state `cardsToPeek`.
  // For King/Queen ability, this will be part of `handleResolveSpecialAbility` or a sub-flow.
  // const handlePerformInitialPeek = () => { // RENAMED/REPURPOSED or REMOVED
  //   // if (isActive && moves.performPeek && multiSelectedCardLocations.length === 2 && playerID) { // REPLACED
  //   // This was for a specific `performPeek` move that took indices.
  //   // The new flow is: player declares ready -> server sends cards to peek -> player acknowledges.
  //   // This specific handler for selecting 2 cards for an initial peek is no longer applicable.
  //   // For King/Queen ability, we'll need a different mechanism.
  // };

  const handleResolveSpecialAbility = () => {
    // if (isActive && moves.resolveSpecialAbility && clientPlayerState?.pendingSpecialAbility) { // REPLACED
    if (isResolvingPlayerForAbility && gameState.pendingAbilities && gameState.pendingAbilities.length > 0) {
      // The ability to resolve is the first one in the server's pendingAbilities array
      // The client needs to pass arguments if the ability requires them (e.g., King/Queen targets)
      const abilityToResolve = gameState.pendingAbilities[0];
      let currentAbilityArgs = abilityArgs; // Use state `abilityArgs` collected by `handleCardClick`

      // Specific argument handling for abilities like King (peek) or Jack/Queen (swap target)
      if (abilityToResolve.card.rank === Rank.King && multiSelectedCardLocations.length > 0) {
        // For King, we expect `targetPlayerId` and `cardIndices`
        // Assuming multiSelectedCardLocations stores {playerId, cardIndex} for peeking
        // This part needs careful review based on how server expects King's arguments
        // Let's assume for now the server handles which player is targeted by King ability through its own state.
        // The client just needs to send what it was told to peek if that's the flow, or selection.
        // For now, let's send the selected locations if they exist.
        // The server side `handleResolveSpecialAbility` would need to interpret this.
        currentAbilityArgs = { peekSelections: multiSelectedCardLocations };
      } else if ((abilityToResolve.card.rank === Rank.Queen || abilityToResolve.card.rank === Rank.Jack) && multiSelectedCardLocations.length === 1) {
        // For Queen/Jack, we expect `targetPlayerId` and `targetCardIndex` for the card to swap with.
        currentAbilityArgs = { swapTarget: multiSelectedCardLocations[0] };
      }
      
      console.log('[Client] Resolving ability:', abilityToResolve, 'with args:', currentAbilityArgs);
      onPlayerAction('resolveSpecialAbility', { ability: abilityToResolve, args: currentAbilityArgs });
      setAbilityArgs(null);
      setMultiSelectedCardLocations([]);
      // Revealed cards from King/Queen peek should be managed by server sending updated player state
      // or a specific event if client needs to temporarily show them.
      // For now, client doesn't auto-reveal here, waits for new gameState.
    }
  };

  // --- Card Click Handler ---
  const handleCardClick = (clickedPlayerID: string, cardIndex: number) => {
    // if (!playerID || !clientPlayerState) return; // Spectator or no state // REPLACED playerID with playerId
    if (!playerId || !clientPlayerState) return; 

    const isOwnCard = clickedPlayerID === playerId;
    // const currentPhase = ctx.phase; // REPLACED
    const currentPhase = gameState.currentPhase;
    // const pendingAbility = clientPlayerState.pendingSpecialAbility?.card.rank; // This was from old structure
    // Get pending ability from the main gameState.pendingAbilities for the current player
    const currentPlayerPendingAbility = isResolvingPlayerForAbility && gameState.pendingAbilities && gameState.pendingAbilities.length > 0 ? gameState.pendingAbilities[0] : null;
    const pendingAbilityRank = currentPlayerPendingAbility?.card.rank;


    // Debug log
    console.log('[CardClick]', {
      clickedPlayerID, cardIndex, isOwnCard, currentPhase, isCurrentPlayer,
      pendingAbilityRank,
      isResolvingPlayerForAbility,
      pendingDrawnCard: clientPlayerState.pendingDrawnCard,
      multiSelectedCardLocations,
      selectedHandCardIndex
    });

    // Prevent clicks if game is over
    if (gameState.gameover) return;

    // Logic for initial peek phase - this is now about declaring ready / acknowledging
    // Card clicks during initial peek are not standard actions, handled by specific buttons.
    // The old logic for selecting cards to peek is removed as server now dictates cardsToPeek.
    if (currentPhase === 'initialPeekPhase') {
      console.log('[CardClick] Click during initialPeekPhase, generally no action here unless specific UI element.');
      return;
    }

    // Player has drawn a card and needs to select one of their own to swap
    // if (clientPlayerState.pendingDrawnCard && isOwnCard && isActive) { // REPLACED isActive
    if (clientPlayerState.pendingDrawnCard && isOwnCard && isCurrentPlayer && (currentPhase === 'playPhase' || currentPhase === 'finalTurnsPhase')) {
      setSelectedHandCardIndex(cardIndex); // This card will be swapped out
      // The actual swap action is triggered by a button like "Swap with Selected" or "Discard Drawn Card"
      console.log(`[CardClick] Selected own card at index ${cardIndex} to swap with pending drawn card.`);
      return;
    }

    // Matching Stage: Player selects a card from their own hand to attempt a match
    if (currentPhase === 'matchingStage' && isOwnCard && canAttemptMatchForCurrentPlayer) {
      // Any player who can match (in potentialMatchers) can select their card
      setSelectedHandCardIndex(cardIndex);
      console.log(`[CardClick] Selected own card at index ${cardIndex} for match attempt.`);
      // The actual match attempt is triggered by a button.
      return;
    }

    // Ability Resolution Stage (e.g., King, Queen, Jack)
    // if (currentPhase === 'abilityResolutionStage' && isActive && pendingAbility) { // REPLACED isActive and pendingAbility source
    if (currentPhase === 'abilityResolutionPhase' && isResolvingPlayerForAbility && pendingAbilityRank) {
      const maxSelectionsForAbility = pendingAbilityRank === Rank.King ? 2 : (pendingAbilityRank === Rank.Queen || pendingAbilityRank === Rank.Jack ? 1 : 0);

      if (maxSelectionsForAbility > 0) {
        const selection = { playerID: clickedPlayerID, cardIndex };
        // Handle multi-selection for King, or single for Queen/Jack (for swap target)
        setMultiSelectedCardLocations(prev => {
          if (pendingAbilityRank === Rank.King) {
            const existingIndex = prev.findIndex(s => s.playerID === clickedPlayerID && s.cardIndex === cardIndex);
            if (existingIndex > -1) return prev.filter((_, i) => i !== existingIndex); // Toggle off
            if (prev.length < maxSelectionsForAbility) return [...prev, selection];
            return [...prev.slice(1), selection]; // Keep last N selections
          } else { // Queen or Jack - only one selection for the target card
            // Allow clicking on another player's card OR current player's non-matching card for Jack ability
            if (clickedPlayerID !== playerId || (pendingAbilityRank === Rank.Jack /* && card is not the Jack itself */)) {
                return [selection]; // Always replace for single target abilities
            }
            return prev; // If Jack clicks own Jack card for example, don't select.
          }
        });
        console.log(`[CardClick] Selected card for ability ${pendingAbilityRank}:`, selection, `Total selected: ${multiSelectedCardLocations.length + 1}`);
        return;
      }
    }

    // Default: clear selections if click is not handled
    // setSelectedHandCardIndex(null); // Reconsider this, might be annoying
    console.log('[CardClick] Click did not match any specific action criteria.');
  };

  // Helper to determine if a card in the current player's hand should be shown face up
  const getOwnCardsToShowFaceUp = useCallback(() => {
    // if (!playerID || !clientPlayerState) return {}; // REPLACED playerID
    if (!playerId || !clientPlayerState) return {};
    const cardsToShow: { [cardIndex: number]: boolean } = {};

    // if (ctx.phase === 'initialPeekPhase' && currentStage === 'revealingCardsStage' && isPeekRevealActive) { // REPLACED, server driven
    // Now relies on `clientPlayerState.cardsToPeek` which are actual cards, not indices.
    // The `PlayerHandComponent` will need to know if it should render these peeked cards face up.
    // This function is more about *additional* temporary reveals outside of initial peek.
    // For initial peek display, `isPeekRevealActive` and `clientPlayerState.cardsToPeek` will be used directly in rendering loop or PlayerHandComponent.
    
    // Example: if King ability caused a peek and server updated revealedCardLocations state on client (or similar mechanism)
    // if (revealedCardLocations[playerID]) { // REPLACED playerID
    if (revealedCardLocations[playerId]) {
      // This state `revealedCardLocations` would be populated by ability results or server messages
      // For example, after a King ability peek, server could tell client to reveal specific cards.
      Object.keys(revealedCardLocations[playerId]).forEach(key => {
        const cardIdx = parseInt(key, 10);
        if (revealedCardLocations[playerId][cardIdx]) {
            cardsToShow[cardIdx] = true;
        }
      });
    }
    return cardsToShow;
  }, [playerId, clientPlayerState, revealedCardLocations]);

  // --- Render Game Board ---
  let initialPeekPhaseUI = null;
  // if (ctx.phase === 'initialPeekPhase' && playerID && clientPlayerState) { // REPLACED
  if (gameState.currentPhase === 'initialPeekPhase' && playerId && clientPlayerState) {
    // const currentStage = gameState.activePlayers?.[playerId]; // Get player's current stage if available
    
    if (!clientPlayerState.isReadyForInitialPeek) {
      initialPeekPhaseUI = (
        <div className="text-center p-3 bg-yellow-200 border border-yellow-500 rounded text-black shadow-md"> {/* Changed text color for visibility */}
          <p className="mb-2 font-semibold">Your first two cards will be revealed to you for a short time.</p>
          <button 
            onClick={handleDeclareReadyForPeek} 
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow hover:shadow-lg transition-all"
          >
            I'm Ready for Initial Peek
          </button>
        </div>
      );
    // } else if (!typedG.initialPeekAllReadyTimestamp) { // REPLACED, server sends cardsToPeek
    } else if (!clientPlayerState.cardsToPeek && clientPlayerState.isReadyForInitialPeek && !clientPlayerState.hasCompletedInitialPeek) {
      initialPeekPhaseUI = <p className="text-center p-2 text-blue-300 font-semibold">Waiting for server to reveal cards for peek...</p>;
    } else if (clientPlayerState.cardsToPeek && !clientPlayerState.hasCompletedInitialPeek) {
      // Display countdown and cards to peek (PlayerHandComponent will handle actual card display based on cardsToPeek)
      initialPeekPhaseUI = (
        <div className="text-center p-3 bg-blue-200 border border-blue-500 rounded text-black shadow-md"> {/* Changed text color */}
          <p className="mb-1 font-semibold">Peek at your cards! They will be hidden again in:</p>
          <p className="text-3xl font-bold mb-2 text-blue-700">{peekCountdown}s</p>
          <p className="text-sm mb-2">(Cards {clientPlayerState.cardsToPeek.map(c => `${c.rank}${c.suit}`).join(', ')} are revealed in your hand)</p>
        </div>
      );
    } else if (clientPlayerState.hasCompletedInitialPeek) {
        initialPeekPhaseUI = <p className="text-center p-2 text-gray-500 font-semibold">Initial peek completed. Waiting for others.</p>;
    }
  }

  // --- Other UI Elements based on Game State ---
  let turnIndicatorText = "";
  if (gameState.currentPhase !== 'initialPeekPhase' && gameState.currentPhase !== 'scoringPhase' && gameState.currentPhase !== 'gameOver') {
    if (isCurrentPlayer) {
      turnIndicatorText = "It's your turn!";
    } else {
      turnIndicatorText = `Waiting for ${gameState.players[gameState.currentPlayerId]?.name || gameState.currentPlayerId}`;
    }
  }
  
  let matchOpportunityUI = null;
  if (isInMatchingStage && gameState.matchingOpportunityInfo) {
    const cardToMatch = gameState.matchingOpportunityInfo.cardToMatch;
    const originalPlayer = gameState.players[gameState.matchingOpportunityInfo.originalPlayerID];
    matchOpportunityUI = (
        <div className="my-3 p-4 border-2 border-purple-500 bg-purple-200 rounded-lg text-center text-black shadow-xl"> {/* Enhanced styling */}
            <p className="font-bold text-purple-800 text-lg">
                Matching Opportunity!
            </p>
            <p className="mb-2 text-sm">{originalPlayer?.name || gameState.matchingOpportunityInfo.originalPlayerID} discarded a <CardComponent card={cardToMatch} isFaceUp={true} style={{display: 'inline-block', transform: 'scale(0.9)', verticalAlign:'middle'}} /> ({cardToMatch.rank}).
            </p>
            {gameState.matchingOpportunityInfo.potentialMatchers.includes(playerId) ? (
                <div className="mt-2 space-y-2"> {/* Grouped buttons */}
                    <p className="text-sm font-semibold">Select a card from your hand to match.</p>
                    {selectedHandCardIndex !== null && clientPlayerState?.hand[selectedHandCardIndex!] && (
                        <button 
                            onClick={() => handleAttemptMatch(selectedHandCardIndex!)} 
                            className="w-full bg-purple-600 hover:bg-purple-800 text-white font-bold py-2 px-4 rounded text-sm shadow hover:shadow-lg transition-all"
                        >
                            Attempt Match with { 
                                (() => {
                                    const cardDisplay = clientPlayerState.hand[selectedHandCardIndex!];
                                    if ('isHidden' in cardDisplay && cardDisplay.isHidden) return 'Hidden Card';
                                    else if ('rank' in cardDisplay) return `${cardDisplay.rank}${cardDisplay.suit}`;
                                    return 'Card';
                                })()
                            }
                        </button>
                    )}
                    <button 
                        onClick={handlePassMatch} 
                        className="w-full bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded text-sm shadow hover:shadow-lg transition-all"
                    >
                        Pass Match
                    </button>
                </div>
            ) : (
                <p className="text-sm text-gray-600 italic">Waiting for others to match or pass.</p>
            )}
        </div>
    );
  }

  let abilityResolutionUI = null;
  if (isResolvingPlayerForAbility && gameState.pendingAbilities && gameState.pendingAbilities[0]) {
    const ability = gameState.pendingAbilities[0];
    abilityResolutionUI = (
        <div className="my-3 p-4 border-2 border-yellow-500 bg-yellow-200 rounded-lg text-center text-black shadow-xl"> {/* Enhanced styling */}
            <p className="font-bold text-yellow-800 text-lg">Resolve your {ability.card.rank} of {ability.card.suit} ability (from {ability.source}):</p>
            {(ability.card.rank === Rank.King) && <p className="text-sm my-1">Select up to 2 cards from any player to peek.</p>}
            {(ability.card.rank === Rank.Queen || ability.card.rank === Rank.Jack) && <p className="text-sm my-1">Select 1 card to swap with.</p>}
            {multiSelectedCardLocations.length > 0 && (
                <p className="text-xs my-1">Selected: {multiSelectedCardLocations.map(loc => `${gameState.players[loc.playerID]?.name || loc.playerID} Card ${loc.cardIndex + 1}`).join(', ')}</p>
            )}
            <button 
                onClick={handleResolveSpecialAbility} 
                className="mt-2 w-full bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded text-sm shadow hover:shadow-lg transition-all"
                disabled={(
                    (ability.card.rank === Rank.King && multiSelectedCardLocations.length === 0) || 
                    ((ability.card.rank === Rank.Queen || ability.card.rank === Rank.Jack) && multiSelectedCardLocations.length !== 1)
                )}
            >
                Confirm Action
            </button>
        </div>
    );
  }

  // --- Player Data Segregation ---
  const opponentPlayerIds = gameState.turnOrder.filter(pId => pId !== playerId);
  // Simple layout: first opponent top-center, others could be added to sides or a gallery
  const topOpponentId = opponentPlayerIds.length > 0 ? opponentPlayerIds[0] : null;
  // For more opponents, we'd need a more complex mapping to positions (e.g. left/right of center)
  const otherOpponentIds = opponentPlayerIds.slice(1);

  return (
    <div className="flex flex-col h-screen bg-green-700 text-white p-2 space-y-2 antialiased"> {/* Added antialiasing */}
      {/* ======== TOP AREA: Opponent(s) ======== */}
      <div className="h-1/5 flex justify-around items-center bg-green-600 p-2 rounded-lg shadow-md min-h-[120px]"> {/* Added min-height */}
        {opponentPlayerIds.length === 0 && <div className="italic text-gray-400">Waiting for opponents...</div>}
        {opponentPlayerIds.map(opId => {
          const pState = gameState.players[opId];
          if (!pState) return <div key={opId} className="text-red-400">Error loading {opId}</div>;
          return (
            <div key={opId} className="text-center p-1 transform scale-90"> {/* Scaled down opponent view slightly */}
                <h4 className="font-semibold text-sm truncate max-w-[100px]">{pState.name || opId} {pState.isLocked ? '(Locked)': ''} {pState.hasCalledCheck ? '(Checked)':''}</h4>
                <PlayerHandComponent
                    key={opId}
                    playerName={pState.name || opId}
                    playerID={opId}
                    playerState={pState}
                    handToShow={pState.hand} 
                    isViewingPlayer={false}
                    onCardClick={handleCardClick}
                    selectedCardIndices={multiSelectedCardLocations.filter(s => s.playerID === opId).map(s => s.cardIndex)}
                    multiSelectedCardIndices={multiSelectedCardLocations.filter(s => s.playerID === opId).map(s => s.cardIndex)}
                    cardsToForceShowFaceUp={revealedCardLocations[opId] || {}} 
                    isLocked={pState.isLocked}
                    hasCalledCheck={pState.hasCalledCheck}
                />
            </div>
          );
        })}
      </div>

      {/* ======== MIDDLE AREA: Game Piles, Info/Log, Main Prompts ======== */}
      <div className="flex-grow flex space-x-2 min-h-0"> {/* min-h-0 for flex-grow to work in Firefox */}
        {/* Left Info/Log Panel */}
        <div className="w-1/4 p-3 bg-green-800 rounded-lg shadow-xl flex flex-col space-y-2 overflow-y-auto"> {/* Made scrollable */}
          <h3 className="text-xl font-bold mb-2 border-b border-green-600 pb-1 text-teal-300">Game Info</h3>
          <div className="space-y-1 text-sm flex-grow"> {/* flex-grow for log */}
            <p><strong>Phase:</strong> <span className="font-semibold text-indigo-300">{gameState.currentPhase}</span></p>
            <p><strong>Turn:</strong> <span className="font-semibold text-red-300 truncate">{gameState.players[gameState.currentPlayerId]?.name || gameState.currentPlayerId}</span></p>
            {turnIndicatorText && <p className={`font-semibold ${isCurrentPlayer ? 'text-yellow-300 animate-pulse' : 'text-gray-400'}`}>{turnIndicatorText}</p>}
            {gameState.gameover && (
              <div className="my-2 p-2 bg-green-900 border border-green-500 text-green-200 rounded-md"> 
                <strong className="block text-center text-lg">Round Over!</strong> 
                <p className="text-center">{gameState.gameover.winner ? `Winner: ${gameState.players[gameState.gameover.winner]?.name || gameState.gameover.winner}` : 'No winner declared'}</p>
                {gameState.gameover.scores && (
                    <ul className="text-xs mt-1 space-y-0.5">{Object.entries(gameState.gameover.scores).map(([pId, score]) => 
                        <li key={pId} className="flex justify-between"><span className="truncate">{gameState.players[pId]?.name || pId}:</span> <span className="font-bold">{score}</span></li>)}</ul>
                )}
              </div>
            )}
            <h4 className="text-lg font-semibold mt-3 pt-2 border-t border-green-600 text-teal-300">Game Log</h4>
            <div className="text-xs text-gray-400 italic flex-grow bg-black/20 p-1 rounded custom-scrollbar">Game log coming soon...</div>
          </div>
        </div>

        {/* Center: Deck, Discard, Main Game Prompts */}
        <div className="w-1/2 flex flex-col items-center justify-center p-3 bg-green-600/70 backdrop-blur-sm rounded-lg shadow-md space-y-3 overflow-y-auto custom-scrollbar"> {/* Added scroll */}
          <div className="flex space-x-6 items-center"> {/* Aligned items */}
            <DrawPileComponent
              canDraw={canDrawFromDeck}
              onClick={handleDrawFromDeck}
              numberOfCards={gameState.deckSize} 
            />
            <DiscardPileComponent
              topCard={gameState.discardPile.length > 0 ? gameState.discardPile[gameState.discardPile.length - 1] : null}
              canDraw={canDrawFromDiscard}
              onClick={handleDrawFromDiscard}
              isSealed={gameState.discardPileIsSealed}
              numberOfCards={gameState.discardPile.length}
            />
          </div>
          {/* Conditional UI elements - these are now primary focus of center panel */}
          <div className="w-full max-w-md"> {/* Constrain width of prompt UIs */}
            {initialPeekPhaseUI}
            {matchOpportunityUI}
            {abilityResolutionUI}
          </div>
        </div>

        {/* Right Action Panel (Current Player's actions) */}
        <div className="w-1/4 p-3 bg-green-800 rounded-lg shadow-xl flex flex-col space-y-3 overflow-y-auto custom-scrollbar"> 
            <h4 className="text-xl font-bold mb-1 border-b border-green-600 pb-1 text-yellow-300">Your Actions</h4>
            {isCurrentPlayer && gameState.currentPhase !== 'initialPeekPhase' && !gameState.gameover && (
              <>
                {clientPlayerState?.pendingDrawnCard && (gameState.currentPhase === 'playPhase' || gameState.currentPhase === 'finalTurnsPhase') && (
                    <div className="p-2 border border-dashed border-yellow-400 bg-black/20 rounded-md space-y-2"> {/* Styling */}
                      <p className="text-sm font-medium text-yellow-200 flex items-center justify-between">
                        <span>Drawn Card:</span> 
                        <CardComponent card={clientPlayerState.pendingDrawnCard} isFaceUp={true} style={{transform: 'scale(0.8)'}}/>
                        <span>(from {clientPlayerState.pendingDrawnCardSource})</span>
                      </p>
                      <div className="flex flex-col space-y-2"> {/* Buttons column */}
                          {selectedHandCardIndex !== null && (
                          <button 
                              onClick={() => handleSwapAndDiscard(selectedHandCardIndex)} 
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded text-xs shadow hover:shadow-lg transition-all w-full"
                          >
                              Swap with Hand Card {selectedHandCardIndex + 1}
                          </button>
                          )}
                          <button 
                          onClick={handleDiscardDrawnCard} 
                          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded text-xs shadow hover:shadow-lg transition-all w-full"
                          >
                          Discard Drawn Card
                          </button>
                      </div>
                    </div>
                )}
                
                {!clientPlayerState?.pendingDrawnCard && (gameState.currentPhase === 'playPhase' || gameState.currentPhase === 'finalTurnsPhase') && (
                    <div className="flex flex-col space-y-2"> 
                    {canCallCheck && ( 
                        <button 
                        onClick={handleCallCheck} 
                        className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-3 rounded shadow hover:shadow-lg transition-all w-full"
                        >
                        Call Check!
                        </button>
                    )}
                    </div>
                )}
                
                {gameState.currentPhase === 'scoringPhase' && <p className="text-center text-gray-400 italic">Scoring in progress...</p>}
              </>
            )}
            {/* Placeholder if not current player's turn or invalid phase for actions */}
            {(!isCurrentPlayer || gameState.currentPhase === 'initialPeekPhase' || gameState.gameover) && gameState.currentPhase !== 'scoringPhase' && (
                <div className="flex-grow flex items-center justify-center text-gray-400 italic text-center">
                    {(gameState.currentPhase === 'initialPeekPhase' && !clientPlayerState?.hasCompletedInitialPeek) ? "Initial Peek..." : 
                     gameState.gameover ? "Game Over" : isCurrentPlayer ? "No actions available." : "Waiting for opponent..." }
                </div>
            )}
        </div>
      </div>

      {/* ======== BOTTOM AREA: Current Player's Hand ======== */}
      <div className="h-1/5 p-2 bg-green-800 rounded-lg shadow-xl flex flex-col justify-center items-center min-h-[150px]"> {/* min-height */}
        <h3 className="text-lg font-semibold mb-1 text-teal-300">{clientPlayerState?.name || playerId} (Your Hand)</h3>
        {clientPlayerState && (
            <PlayerHandComponent
                key={playerId}
                playerName={clientPlayerState.name || playerId}
                playerID={playerId}
                playerState={clientPlayerState}
                handToShow={
                    (gameState.currentPhase === 'initialPeekPhase' && 
                     clientPlayerState?.cardsToPeek && 
                     isPeekRevealActive && 
                     !clientPlayerState.hasCompletedInitialPeek
                    ) ? clientPlayerState.cardsToPeek.map((card, index) => card ? card : {isHidden: true, id: `peek-hidden-${index}`})
                    : clientPlayerState.hand
                }
                isViewingPlayer={true}
                onCardClick={handleCardClick}
                selectedCardIndices={selectedHandCardIndex !== null ? [selectedHandCardIndex] : []}
                multiSelectedCardIndices={multiSelectedCardLocations.filter(s => s.playerID === playerId).map(loc => loc.cardIndex)}
                cardsToForceShowFaceUp={
                    (gameState.currentPhase === 'initialPeekPhase' && 
                     clientPlayerState?.cardsToPeek && 
                     isPeekRevealActive && 
                     !clientPlayerState.hasCompletedInitialPeek
                    ) ? Object.fromEntries((clientPlayerState.cardsToPeek || []).map((_,i) => [i, true])) 
                    : getOwnCardsToShowFaceUp()
                }
                isLocked={clientPlayerState.isLocked}
                hasCalledCheck={clientPlayerState.hasCalledCheck}
            />
        )}
      </div>

      {/* Debug State (can be toggled or moved) - kept for now but styled to be less intrusive */}
      <div className="absolute bottom-1 right-1 p-1 bg-black/50 backdrop-blur-sm rounded max-h-32 overflow-y-auto text-xs shadow-2xl z-50">
        <details>
            <summary className="cursor-pointer text-gray-400 hover:text-white transition-colors">Debug</summary>
            <pre className="text-gray-300 overflow-x-auto p-1 rounded custom-scrollbar" style={{backgroundColor: 'rgba(0,0,0,0.7)'}}>
                {JSON.stringify({ 
                    clientPID: playerId.slice(-4), 
                    isCurrent: isCurrentPlayer,
                    phase: gameState.currentPhase,
                    turn: (gameState.players[gameState.currentPlayerId]?.name || gameState.currentPlayerId).slice(-6),
                    deck: gameState.deckSize,
                    discard: gameState.discardPile.length,
                    myHand: clientPlayerState.hand.length,
                    myStatus: {
                        readyPeek: clientPlayerState.isReadyForInitialPeek,
                        donePeek: clientPlayerState.hasCompletedInitialPeek,
                        hasCalledCheck: clientPlayerState.hasCalledCheck,
                        isLocked: clientPlayerState.isLocked,
                        pendingCard: !!clientPlayerState.pendingDrawnCard,
                    },
                    // opponentPlayerIds,
                    // topOpponentId,
                    // otherOpponentIds
                }, null, 1)}
            </pre>
        </details>
      </div>
    </div>
  );
};

export default CheckGameBoard; 