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
                                        !gameState.pendingAbilities; // Simplified: if any abilities are pending, probably not standard play. Check server logic.

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
    if (isCurrentPlayer && clientPlayerState?.pendingDrawnCard && gameState.currentPhase === 'playPhase') { // Added currentPhase check
      // moves.swapAndDiscard(handIndex); // REPLACED
      onPlayerAction('swapAndDiscard', { handIndex });
      setSelectedHandCardIndex(null);
    }
  };

  const handleDiscardDrawnCard = () => {
    // if (isActive && moves.discardDrawnCard && clientPlayerState?.pendingDrawnCard) { // REPLACED
    if (isCurrentPlayer && clientPlayerState?.pendingDrawnCard && gameState.currentPhase === 'playPhase') { // Added currentPhase check
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
    if (clientPlayerState.pendingDrawnCard && isOwnCard && isCurrentPlayer && currentPhase === 'playPhase') {
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
        <div className="text-center p-3 bg-yellow-100 border border-yellow-400 rounded">
          <p className="mb-2">Your first two cards will be revealed to you for a short time.</p>
          <button 
            onClick={handleDeclareReadyForPeek} 
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            I'm Ready for Initial Peek
          </button>
        </div>
      );
    // } else if (!typedG.initialPeekAllReadyTimestamp) { // REPLACED, server sends cardsToPeek
    } else if (!clientPlayerState.cardsToPeek && clientPlayerState.isReadyForInitialPeek && !clientPlayerState.hasCompletedInitialPeek) {
      initialPeekPhaseUI = <p className="text-center p-2 text-blue-600">Waiting for server to reveal cards for peek...</p>;
    } else if (clientPlayerState.cardsToPeek && !clientPlayerState.hasCompletedInitialPeek) {
      // Display countdown and cards to peek (PlayerHandComponent will handle actual card display based on cardsToPeek)
      initialPeekPhaseUI = (
        <div className="text-center p-3 bg-blue-100 border border-blue-400 rounded">
          <p className="mb-1">Peek at your cards! They will be hidden again in:</p>
          <p className="text-2xl font-bold mb-2">{peekCountdown}s</p>
          <p className="text-xs mb-2">(Cards {clientPlayerState.cardsToPeek.map(c => `${c.rank}${c.suit}`).join(', ')} are revealed below in your hand)</p>
          {/* <button 
            onClick={handleAcknowledgePeek} 
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm"
          >
            Acknowledge Peek
          </button> */}
        </div>
      );
    } else if (clientPlayerState.hasCompletedInitialPeek) {
        initialPeekPhaseUI = <p className="text-center p-2 text-gray-500">Initial peek completed. Waiting for others.</p>;
    }
  }

  // --- Other UI Elements based on Game State ---
  let turnIndicator = null;
  if (gameState.currentPhase !== 'initialPeekPhase' && gameState.currentPhase !== 'scoringPhase' && gameState.currentPhase !== 'gameOver') {
    if (isCurrentPlayer) {
      turnIndicator = <span className="font-semibold text-lg text-green-600 ml-2">It's your turn!</span>;
    } else {
      turnIndicator = <span className="text-md text-gray-600 ml-2">Waiting for {gameState.players[gameState.currentPlayerId]?.name || gameState.currentPlayerId}</span>;
    }
  }
  
  let matchOpportunityUI = null;
  if (isInMatchingStage && gameState.matchingOpportunityInfo) {
    const cardToMatch = gameState.matchingOpportunityInfo.cardToMatch;
    const originalPlayer = gameState.players[gameState.matchingOpportunityInfo.originalPlayerID];
    matchOpportunityUI = (
        <div className="my-3 p-3 border border-purple-500 bg-purple-100 rounded text-center">
            <p className="font-semibold text-purple-700">
                Matching Opportunity! {originalPlayer?.name || gameState.matchingOpportunityInfo.originalPlayerID} discarded a <CardComponent card={cardToMatch} isFaceUp={true} style={{display: 'inline-block', transform: 'scale(0.8)'}} /> ({cardToMatch.rank}).
            </p>
            {gameState.matchingOpportunityInfo.potentialMatchers.includes(playerId) ? (
                <>
                    <p className="text-sm">Select a card from your hand to match.</p>
                    {selectedHandCardIndex !== null && clientPlayerState?.hand[selectedHandCardIndex!] && (
                        <button 
                            onClick={() => handleAttemptMatch(selectedHandCardIndex!)} 
                            className="mt-1 bg-purple-500 hover:bg-purple-700 text-white font-bold py-1 px-3 rounded text-sm mr-2"
                        >
                            Attempt Match with {
                                (() => {
                                    const cardDisplay = clientPlayerState.hand[selectedHandCardIndex!];
                                    if ('isHidden' in cardDisplay && cardDisplay.isHidden) {
                                        return 'Hidden Card';
                                    } else if ('rank' in cardDisplay) {
                                        return `${cardDisplay.rank}${cardDisplay.suit}`;
                                    }
                                    return 'Card'; // Fallback, should not happen if types are correct
                                })()
                            }
                        </button>
                    )}
                    <button 
                        onClick={handlePassMatch} 
                        className="mt-1 bg-gray-400 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded text-sm"
                    >
                        Pass Match
                    </button>
                </>
            ) : (
                <p className="text-sm text-gray-500">Waiting for others to match or pass.</p>
            )}
        </div>
    );
  }

  let abilityResolutionUI = null;
  if (isResolvingPlayerForAbility && gameState.pendingAbilities && gameState.pendingAbilities[0]) {
    const ability = gameState.pendingAbilities[0];
    abilityResolutionUI = (
        <div className="my-3 p-3 border border-yellow-500 bg-yellow-100 rounded text-center">
            <p className="font-semibold text-yellow-700">Resolve your {ability.card.rank} of {ability.card.suit} ability (from {ability.source}):</p>
            {/* Add specific instructions or selection UIs based on ability.card.rank */}
            {(ability.card.rank === Rank.King) && <p className="text-sm">Select up to 2 cards from any player to peek.</p>}
            {(ability.card.rank === Rank.Queen || ability.card.rank === Rank.Jack) && <p className="text-sm">Select 1 card to swap with.</p>}
            {multiSelectedCardLocations.length > 0 && (
                <p className="text-xs">Selected: {multiSelectedCardLocations.map(loc => `${gameState.players[loc.playerID]?.name || loc.playerID} Card ${loc.cardIndex + 1}`).join(', ')}</p>
            )}
            <button 
                onClick={handleResolveSpecialAbility} 
                className="mt-1 bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded text-sm"
                // Disable if required selections for ability not met
                disabled={(
                    (ability.card.rank === Rank.King && multiSelectedCardLocations.length === 0) || // King needs at least one, server handles if more than 2 are sent
                    ((ability.card.rank === Rank.Queen || ability.card.rank === Rank.Jack) && multiSelectedCardLocations.length !== 1)
                )}
            >
                Confirm Action
            </button>
        </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-4 p-3 border border-gray-300 rounded-lg bg-gray-50 shadow">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold mb-1">Check Game Board</h2>
          <p className="text-sm text-gray-500">Player: {clientPlayerState?.name || playerId}</p>
        </div>
        <p className="text-sm text-gray-600">
          Phase: <span className="font-semibold text-indigo-600">{gameState.currentPhase}</span> |
          Current Turn: <span className="font-semibold text-red-600">{gameState.players[gameState.currentPlayerId]?.name || gameState.currentPlayerId}</span>
          {/* {playerID && ( // REPLACED playerID
            <span> | Your ID: <span className="font-semibold text-blue-600">{playerId}</span>
            {isCurrentPlayer && gameState.currentPhase !== 'initialPeekPhase' ? "(Your Turn)" : ""}
            </span>
          )} */}
          {turnIndicator}
        </p>
        {gameState.gameover && (
          <div className="mt-2 p-2 bg-green-100 border border-green-600 text-green-800 rounded">
            <strong>Round Over!</strong> 
            {gameState.gameover.winner ? `Winner: ${gameState.players[gameState.gameover.winner]?.name || gameState.gameover.winner}` : 'No winner declared (Draw?)'}
            {/* TODO: Display scores properly from gameState.gameover.scores */}
            {gameState.gameover.scores && (
                <ul className="text-xs">{Object.entries(gameState.gameover.scores).map(([pId, score]) => 
                    <li key={pId}>{gameState.players[pId]?.name || pId}: {score}</li>)}</ul>
            )}
          </div>
        )}
      </div>

      {initialPeekPhaseUI}
      {matchOpportunityUI}
      {abilityResolutionUI}

      {/* Player Hands Area - Needs to pass isPeekRevealActive and cardsToPeek for initial peek */} 
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {gameState.turnOrder.map(pID => {
          const pState = gameState.players[pID];
          if (!pState) return <div key={pID}>Player {pID} data missing...</div>;
          
          let handToShow = pState.hand; // Default hand (ClientCard[])
          let forceShowAll = false; // For abilities like King peek result

          // For initial peek phase, use cardsToPeek for the current player
          if (gameState.currentPhase === 'initialPeekPhase' && 
              pID === playerId && 
              clientPlayerState?.cardsToPeek && 
              isPeekRevealActive && // Client-side visual timer for reveal
              !clientPlayerState.hasCompletedInitialPeek
            ) {
                handToShow = clientPlayerState.cardsToPeek.map((card, index) => card ? card : {isHidden: true, id: `peek-hidden-${index}`}); // Ensure it's Card[] for PlayerHandComponent
                forceShowAll = true; // Temporarily show these cards face up
          }

          // For King ability reveal on other players (or self if targeted)
          // This relies on `revealedCardLocations` being correctly populated by the `handleResolveSpecialAbility` response
          // or a separate server event that updates client state about what's revealed.
          // If `revealedCardLocations` is used, `PlayerHandComponent` needs to respect it.
          // For now, `getOwnCardsToShowFaceUp` handles *own* general reveals.
          // `forceShowAll` is specific for initial peek server-sent cards or potential King peek result visualization.
          // Example: If King peek revealed cards for pID, `revealedCardLocations[pID]` would be set.
          // This is an area that might need more robust state management for temporary reveals on other players.

          return (
            <PlayerHandComponent
              key={pID}
              playerName={pState.name || pID} // Pass player name
              playerID={pID}
              playerState={pState} // Pass the full ClientPlayerState
              handToShow={handToShow} // Pass the hand to show (could be actual hand or peek cards)
              isViewingPlayer={pID === playerId}
              onCardClick={handleCardClick}
              selectedCardIndices={pID === playerId ? (selectedHandCardIndex !== null ? [selectedHandCardIndex] : []) : []}
              // currentPlayersCardsToShowFaceUp is for general purpose reveals, not the initial peek full reveal
              cardsToForceShowFaceUp={ (pID === playerId && forceShowAll) ? Object.fromEntries(handToShow.map((_,i) => [i, true])) : getOwnCardsToShowFaceUp() }
              // Pass multi-select state if this player is the one making selections (e.g. for King ability)
              multiSelectedCardIndices={pID === playerId ? multiSelectedCardLocations.map(loc => loc.cardIndex) : []}
              isLocked={pState.isLocked}
              hasCalledCheck={pState.hasCalledCheck}
            />
          );
        })}
      </div>

      {/* Game Piles & Player Action Zone (only if not in peek phase and game not over) */}
      {gameState.currentPhase !== 'initialPeekPhase' && !gameState.gameover && (
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          {/* Piles column */}
          <div className="flex-none w-full md:w-1/4">
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

          {/* Current Player's Action Zone - only for the current player & relevant phases */}
          {isCurrentPlayer && (
            <div className="flex-grow p-3 border border-blue-300 rounded-lg bg-blue-50">
              <h4 className="text-lg font-semibold mb-2 text-blue-700">Your Actions ({clientPlayerState?.name || playerId})</h4>

              {/* Displaying a drawn card before action */}
              {clientPlayerState?.pendingDrawnCard && (gameState.currentPhase === 'playPhase' || gameState.currentPhase === 'finalTurnsPhase') && (
                <div className="mb-3 p-2 border border-dashed border-green-500 bg-green-50 rounded">
                  <p className="text-sm font-medium text-green-700">Drawn Card (from {clientPlayerState.pendingDrawnCardSource}):</p>
                  <div className="flex items-center justify-center my-1">
                    <CardComponent card={clientPlayerState.pendingDrawnCard} isFaceUp={true} />
                  </div>
                  {selectedHandCardIndex !== null && (
                    <button 
                      onClick={() => handleSwapAndDiscard(selectedHandCardIndex)} 
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm mr-2"
                    >
                      Swap with Selected (Hand Card {selectedHandCardIndex + 1})
                    </button>
                  )}
                  <button 
                    onClick={handleDiscardDrawnCard} 
                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm"
                  >
                    Discard Drawn Card
                  </button>
                </div>
              )}

              {/* Standard play phase actions (not when card is pending discard/swap) */}
              {!clientPlayerState?.pendingDrawnCard && (gameState.currentPhase === 'playPhase' || gameState.currentPhase === 'finalTurnsPhase') && (
                <div className="space-x-2">
                  {canCallCheck && (
                    <button 
                      onClick={handleCallCheck} 
                      className="bg-yellow-600 hover:bg-yellow-800 text-white font-bold py-2 px-4 rounded"
                    >
                      Call Check!
                    </button>
                  )}
                </div>
              )}
              
              {/* UI for other phases can be added here, e.g., specific buttons for scoring if needed */}
              {gameState.currentPhase === 'scoringPhase' && <p>Scoring in progress...</p>}
            </div>
          )}
        </div>
      )}

      {/* Debug State */}
      <div className="mt-6 p-3 border border-gray-300 rounded bg-gray-100 shadow">
        <h4 className="text-md font-semibold mb-1 text-gray-700">Debug State:</h4>
        <details>
            <summary className="cursor-pointer text-xs">Toggle Details</summary>
            <pre className="text-xs overflow-x-auto bg-white p-2 rounded">
                {JSON.stringify({ 
                    clientPlayerId: playerId, 
                    isCurrentPlayer,
                    gameState,
                    clientPlayerState,
                    selectedHandCardIndex, 
                    multiSelectedCardLocations, 
                    revealedCardLocations, 
                    abilityArgs,
                    peekCountdown,
                    isPeekRevealActive
                }, (key, value) => {
                  // Prevent excessively long hand arrays from bloating the JSON string for 'gameState.players.X.hand'
                  if (key === 'hand' && Array.isArray(value) && value.length > 5) { 
                      return `Array(${value.length})`;
                  }
                  return value;
              }, 2)}
            </pre>
        </details>
      </div>
    </div>
  );
};

export default CheckGameBoard; 