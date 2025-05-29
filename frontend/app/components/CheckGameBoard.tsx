import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Ctx } from 'boardgame.io'; // Import Ctx type from boardgame.io
import type { CheckGameState as ActualCheckGameState, Card, PlayerState } from 'shared-types'; // Import your specific game state and related types
import { Rank } from 'shared-types'; // Import Rank separately as a value
import PlayerHandComponent from './PlayerHandComponent';
import DrawPileComponent from './DrawPileComponent';
import DiscardPileComponent from './DiscardPileComponent';
import CardComponent from './CardComponent'; // For displaying pendingDrawnCard

const PEEK_COUNTDOWN_SECONDS = 3;
const PEEK_REVEAL_SECONDS = 5;

// Define the props for the game board
interface CheckGameBoardProps {
  G: (Omit<ActualCheckGameState, 'players'> & { players: { [playerID: string]: PlayerState } | {} }) | undefined;
  ctx: Ctx;
  playerID: string | null;
  moves: any; // TODO: Define a proper type for moves based on your game's moves
  isActive: boolean; // True if it's the current player's turn for this client
  // playerView: any; // boardgame.io provides this, might be useful later
  // events: any; // For special events like endTurn, setStage, etc.
}

const CheckGameBoard: React.FC<CheckGameBoardProps> = ({ G, ctx, playerID, moves, isActive }) => {
  // Moved these declarations before useEffect hooks
  const typedG = G as ActualCheckGameState;
  const clientPlayerState = playerID && typedG?.players ? typedG.players[playerID] : undefined;
  const currentStage = playerID && ctx.activePlayers ? ctx.activePlayers[playerID] : null;

  const [selectedHandCardIndex, setSelectedHandCardIndex] = useState<number | null>(null);
  // Stores which of the current player's own cards should be temporarily shown face up
  // e.g. for initial peek, or King/Queen ability peek result.
  const [revealedCardLocations, setRevealedCardLocations] = useState<{ [playerID: string]: { [cardIndex: number]: boolean } }>({});
  // State for multi-select, e.g. King ability peek targets
  const [multiSelectedCardLocations, setMultiSelectedCardLocations] = useState<{ playerID: string, cardIndex: number }[]>([]);
  // State for ability arguments if needed
  const [abilityArgs, setAbilityArgs] = useState<any>(null);

  // State for the new initial peek flow
  const [peekCountdown, setPeekCountdown] = useState<number>(PEEK_COUNTDOWN_SECONDS);
  const [isPeekRevealActive, setIsPeekRevealActive] = useState<boolean>(false);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const revealTimerRef = useRef<NodeJS.Timeout | null>(null);
  const serverTimerCheckIntervalRef = useRef<NodeJS.Timeout | null>(null); // For new interval

  // Memoize the move function if it's part of the moves object
  const checkInitialPeekTimerMove = moves?.checkInitialPeekTimer;

  useEffect(() => {
    console.log('[PeekEffect] Running:', { phase: ctx.phase, playerID, currentStage, ts: typedG?.initialPeekAllReadyTimestamp, countdown: peekCountdown, revealActive: isPeekRevealActive, completedPeek: clientPlayerState?.hasCompletedInitialPeek });

    // Clear previous server check interval first
    if (serverTimerCheckIntervalRef.current) {
      clearInterval(serverTimerCheckIntervalRef.current);
      serverTimerCheckIntervalRef.current = null;
    }

    if (ctx.phase === 'initialPeekPhase' && playerID && clientPlayerState && !clientPlayerState.hasCompletedInitialPeek) {
      if (currentStage === 'revealingCardsStage' && typedG.initialPeekAllReadyTimestamp) {
        // Countdown visual logic (client-side)
        if (peekCountdown > 0) {
          console.log('[PeekEffect] Setting CLIENT COUNTDOWN timer for', peekCountdown);
          countdownTimerRef.current = setTimeout(() => {
            setPeekCountdown(prev => prev - 1);
          }, 1000);
        } else { // peekCountdown is 0
          if (countdownTimerRef.current) { clearTimeout(countdownTimerRef.current); countdownTimerRef.current = null; }

          // Visual reveal logic (client-side)
          if (!isPeekRevealActive && !revealTimerRef.current) {
            console.log('[PeekEffect] Setting CLIENT REVEAL timer');
            setIsPeekRevealActive(true);
            revealTimerRef.current = setTimeout(() => {
              console.log('[PeekEffect] CLIENT REVEAL timer FIRED');
              setIsPeekRevealActive(false);
              revealTimerRef.current = null; 
            }, PEEK_REVEAL_SECONDS * 1000);
          }
        }
        
        // Start polling the server with checkInitialPeekTimer
        if (isActive && checkInitialPeekTimerMove && !clientPlayerState.hasCompletedInitialPeek) { 
            console.log('[PeekEffect] Starting server check interval for active player', playerID);
            serverTimerCheckIntervalRef.current = setInterval(() => {
                if (typedG?.players[playerID]?.hasCompletedInitialPeek || ctx.phase !== 'initialPeekPhase' || (ctx.activePlayers && ctx.activePlayers[playerID] !== 'revealingCardsStage')) {
                    if(serverTimerCheckIntervalRef.current) clearInterval(serverTimerCheckIntervalRef.current);
                    serverTimerCheckIntervalRef.current = null;
                    console.log('[PeekEffect] Server check interval: conditions no longer met, clearing for player', playerID);
                    return;
                }
                console.log('[PeekEffect] Calling memoized checkInitialPeekTimer() for player', playerID);
                checkInitialPeekTimerMove(); // Call the memoized version
            }, 1000); 
        }

      } else if (currentStage === 'waitingForReadyStage') {
        console.log('[PeekEffect] In waiting stage. Resetting client visuals.');
        setPeekCountdown(PEEK_COUNTDOWN_SECONDS);
        setIsPeekRevealActive(false);
        if (revealTimerRef.current) { clearTimeout(revealTimerRef.current); revealTimerRef.current = null; }
        if (countdownTimerRef.current) { clearTimeout(countdownTimerRef.current); countdownTimerRef.current = null; }
        // Server check interval should have been cleared by the top of useEffect or by its own conditions
      }
    } else {
      console.log('[PeekEffect] Not in active peek or conditions unmet. Resetting client visuals.');
      setPeekCountdown(PEEK_COUNTDOWN_SECONDS);
      setIsPeekRevealActive(false);
      if (revealTimerRef.current) { clearTimeout(revealTimerRef.current); revealTimerRef.current = null; }
      if (countdownTimerRef.current) { clearTimeout(countdownTimerRef.current); countdownTimerRef.current = null; }
      // Server check interval cleared at the top of useEffect
    }

    return () => {
      console.log('[PeekEffect] CLEANUP executing for player', playerID);
      if (countdownTimerRef.current) { clearTimeout(countdownTimerRef.current); countdownTimerRef.current = null; }
      if (revealTimerRef.current) { clearTimeout(revealTimerRef.current); revealTimerRef.current = null; }
      if (serverTimerCheckIntervalRef.current) { clearInterval(serverTimerCheckIntervalRef.current); serverTimerCheckIntervalRef.current = null; }
    };
  }, [
    ctx.phase, playerID, clientPlayerState?.hasCompletedInitialPeek, 
    currentStage, typedG?.initialPeekAllReadyTimestamp, peekCountdown, 
    isPeekRevealActive, checkInitialPeekTimerMove, isActive
  ]);

  if (!G || G.players === undefined || !typedG) {
    return <div className="p-4">Loading game state or error...</div>;
  }

  // currentPlayerFromG is used further down, ensure it's defined after G/typedG checks
  const currentPlayerFromG = ctx.currentPlayer && typedG.players ? typedG.players[ctx.currentPlayer] : undefined;

  // It would be good practice to also memoize other move calls if `moves` object itself is unstable.
  // For example:
  const declareReadyForPeekMove = moves?.declareReadyForPeek;
  const handleDeclareReadyForPeek = useCallback(() => {
    if (declareReadyForPeekMove && clientPlayerState && !clientPlayerState.isReadyForInitialPeek) {
      declareReadyForPeekMove();
    }
  }, [declareReadyForPeekMove, clientPlayerState]);

  // --- Action Conditionals ---
  const isInMatchingStage = !!(playerID && ctx.phase === 'matchingStage' && ctx.activePlayers?.[playerID]);

  useEffect(() => {
    if (isInMatchingStage) {
      // Log full ctx when entering matching stage for debugging allowedMoves
      console.log(`[Client] Player ${playerID} detected isInMatchingStage.`);
      console.log(`[Client] ctx.phase for useEffect: ${ctx.phase}`);
      console.log(`[Client] ctx.allowedMoves for useEffect:`, (ctx as any).allowedMoves);
      console.log(`[Client] ctx.hasOwnProperty('allowedMoves') in useEffect:`, ctx.hasOwnProperty('allowedMoves'));
    }
  }, [isInMatchingStage, playerID, ctx]);

  const isInAbilityResolutionStage = !!(isActive && playerID && ctx.activePlayers?.[playerID] === 'abilityResolutionStage' && clientPlayerState?.pendingSpecialAbility);

  const canPerformStandardPlayPhaseActions = isActive &&
                                        ctx.phase === 'playPhase' &&
                                        !isInMatchingStage &&
                                        !isInAbilityResolutionStage && // Ensure not in ability stage
                                        !clientPlayerState?.pendingDrawnCard &&
                                        !clientPlayerState?.pendingSpecialAbility;

  const canDrawFromDeck = canPerformStandardPlayPhaseActions;
  const canDrawFromDiscard = canPerformStandardPlayPhaseActions && !typedG.discardPileIsSealed;

  const canCallCheck = canPerformStandardPlayPhaseActions &&
                       ctx.currentPlayer === playerID && // Explicitly check if it's their turn for callCheck
                       !clientPlayerState?.hasCalledCheck;

  // --- Move Handler Placeholders ---
  const handleDrawFromDeck = () => {
    if (isActive && moves.drawFromDeck) {
      moves.drawFromDeck();
      setSelectedHandCardIndex(null);
    }
  };

  const handleDrawFromDiscard = () => {
    if (isActive && moves.drawFromDiscard && !typedG.discardPileIsSealed) {
      moves.drawFromDiscard();
      setSelectedHandCardIndex(null);
    }
  };

  const handleSwapAndDiscard = (handIndex: number) => {
    if (isActive && moves.swapAndDiscard && clientPlayerState?.pendingDrawnCard) {
      moves.swapAndDiscard(handIndex);
      setSelectedHandCardIndex(null);
    }
  };

  const handleDiscardDrawnCard = () => {
    if (isActive && moves.discardDrawnCard && clientPlayerState?.pendingDrawnCard) {
      moves.discardDrawnCard();
      setSelectedHandCardIndex(null);
    }
  };

  const handleAttemptMatch = (handIndex: number) => {
    if (moves.attemptMatch && ctx.phase === 'matchingStage') {
      // No isActive check for matchingStage, as any player can attempt
      moves.attemptMatch(handIndex);
      setSelectedHandCardIndex(null);
    }
  };

  const handlePassMatch = useCallback(() => {
    console.log(`[Client] handlePassMatch by ${playerID}. Phase: ${ctx.phase}`);
    console.log(`[Client] ctx.allowedMoves for handlePassMatch:`, (ctx as any).allowedMoves);
    console.log(`[Client] ctx.hasOwnProperty('allowedMoves') in handlePassMatch:`, ctx.hasOwnProperty('allowedMoves'));

    // The condition for calling the move:
    // 1. The move must exist.
    // 2. We must have a playerID for this client.
    // 3. The current phase must be 'matchingStage'.
    // 4. This player must be active in a stage within matchingStage.
    if (moves.passMatch && 
        playerID && 
        ctx.phase === 'matchingStage' && 
        ctx.activePlayers && 
        ctx.activePlayers[playerID] // This ensures player is active in *some* stage of matchingStage
       ) {
      console.log(`[Client] Player ${playerID} attempting to call moves.passMatch() as conditions seem met.`);
      moves.passMatch();
    } else {
      console.warn(`[Client] Player ${playerID} WILL NOT call passMatch. Conditions: moveExists=${!!moves.passMatch}, playerID=${playerID}, phase=${ctx.phase}, activeInPhaseStage=${ctx.activePlayers ? !!ctx.activePlayers[playerID!] : false}`);
    }
  }, [moves, playerID, ctx, isActive]);

  const handleCallCheck = () => {
    if (isActive && moves.callCheck) {
      moves.callCheck();
    }
  };

  const handlePerformInitialPeek = () => {
    if (isActive && moves.performPeek && multiSelectedCardLocations.length === 2 && playerID) {
      const indicesToPeek = multiSelectedCardLocations.map(loc => loc.cardIndex);
      moves.performPeek(indicesToPeek);
      // Reveal these cards for the current player
      const newReveals = { ...revealedCardLocations };
      if (!newReveals[playerID]) newReveals[playerID] = {};
      indicesToPeek.forEach(idx => { newReveals[playerID][idx] = true; });
      setRevealedCardLocations(newReveals);
      setMultiSelectedCardLocations([]);
    }
  };

  const handleResolveSpecialAbility = () => {
    if (isActive && moves.resolveSpecialAbility && clientPlayerState?.pendingSpecialAbility) {
      // For now, pass the collected abilityArgs. This will need refinement based on specific ability.
      moves.resolveSpecialAbility(abilityArgs);
      setAbilityArgs(null);
      setMultiSelectedCardLocations([]);
      // Potentially clear some revealed cards if ability involved peeking then swapping to unknown spots.
    }
  };

  // --- Card Click Handler ---
  const handleCardClick = (clickedPlayerID: string, cardIndex: number) => {
    if (!playerID || !clientPlayerState) return; // Spectator or no state

    const isOwnCard = clickedPlayerID === playerID;
    const currentPhase = ctx.phase;
    const pendingAbility = clientPlayerState.pendingSpecialAbility?.card.rank;

    // Disable card clicks during the automated peek reveal
    if (currentPhase === 'initialPeekPhase' && currentStage === 'revealingCardsStage' && isPeekRevealActive) {
      return; 
    }
    // Disable card clicks if it's not the player's turn (unless specific phase/action allows)
    // and also if they have completed their initial peek already for this phase
    if (currentPhase === 'initialPeekPhase' && (clientPlayerState.hasCompletedInitialPeek || !isActive)){
        return;
    }

    // Player has drawn a card and needs to select one of their own to swap
    if (clientPlayerState.pendingDrawnCard && isOwnCard && isActive) {
      setSelectedHandCardIndex(cardIndex); // This card will be swapped out
      return;
    }

    // Matching Stage: Player selects a card from their own hand to attempt a match
    if (currentPhase === 'matchingStage' && isOwnCard) {
      // Any player can attempt to match, isActive not strictly needed here for selection
      setSelectedHandCardIndex(cardIndex);
      return;
    }

    // Ability Resolution Stage (e.g., King, Queen, Jack)
    if (currentPhase === 'abilityResolutionStage' && isActive && pendingAbility) {
      const maxSelections = pendingAbility === Rank.King ? 2 : (pendingAbility === Rank.Queen ? 1 : 0); // Peek targets
      // This simplified logic is for swap targets, peek targets selection should be distinct
      // For now, let's assume King/Queen peek first, then this click is for swap
      if (multiSelectedCardLocations.length < 2) { // Collect two cards for swap (A and B)
        if (!multiSelectedCardLocations.some(loc => loc.playerID === clickedPlayerID && loc.cardIndex === cardIndex)) {
          setMultiSelectedCardLocations(prev => [...prev, { playerID: clickedPlayerID, cardIndex }]);
        }
      }
      // Update abilityArgs based on selection - this needs robust logic based on ability
      if (multiSelectedCardLocations.length === 1 && pendingAbility === Rank.Queen) {
        // Assume first click is peek target, if Q ability requires it
        // For simplicity, we'll assume it has been peeked, and now we prepare for swap.
        // This part is very rough and needs ability-specific UI states.
      }
      if (multiSelectedCardLocations.length === 2 && (pendingAbility === Rank.King || pendingAbility === Rank.Queen || pendingAbility === Rank.Jack)) {
        setAbilityArgs({
          // Example: these would be set based on a more complex UI flow
          // peekTargets: pendingAbility === Rank.King ? [{...}, {...}] : (pendingAbility === Rank.Queen ? [{...}] : undefined),
          swapA: multiSelectedCardLocations[0],
          swapB: multiSelectedCardLocations[1],
        });
      }
      return;
    }
    // Default: clear selection if clicking elsewhere or an invalid context
    setSelectedHandCardIndex(null);
    // setMultiSelectedCardLocations([]); // Decide if this should be cleared here
  };

  // Helper to determine if a card in the current player's hand should be shown face up
  const getOwnCardsToShowFaceUp = useCallback(() => {
    if (!playerID || !clientPlayerState) return {};
    const cardsToShow: { [cardIndex: number]: boolean } = {};

    if (ctx.phase === 'initialPeekPhase' && currentStage === 'revealingCardsStage' && isPeekRevealActive) {
      // During automated peek reveal, show bottom two cards (indices 2 and 3)
      cardsToShow[2] = true;
      cardsToShow[3] = true;
      return cardsToShow;
    }
    // For other scenarios (e.g., King/Queen ability resolution that might use revealedCardLocations)
    if (clientPlayerState.hand) {
      clientPlayerState.hand.forEach((_, index) => {
        if (revealedCardLocations[playerID]?.[index]) {
          cardsToShow[index] = true;
        }
      });
    }
    return cardsToShow;
  }, [playerID, clientPlayerState, ctx.phase, currentStage, isPeekRevealActive, revealedCardLocations]);

  // --- Render Game Board ---
  let initialPeekPhaseUI = null;
  if (ctx.phase === 'initialPeekPhase' && playerID && clientPlayerState) {
    if (currentStage === 'waitingForReadyStage') {
      if (!clientPlayerState.isReadyForInitialPeek) {
        initialPeekPhaseUI = (
          <button onClick={handleDeclareReadyForPeek} className="m-2 p-2 bg-green-500 text-white rounded">
            Ready for Initial Peek
          </button>
        );
      } else if (!typedG.initialPeekAllReadyTimestamp) {
        initialPeekPhaseUI = <p className="text-center p-2">Waiting for other players to get ready...</p>;
      }
    } else if (currentStage === 'revealingCardsStage') {
      if (peekCountdown > 0 && !clientPlayerState.hasCompletedInitialPeek) {
        initialPeekPhaseUI = <p className="text-center p-2">Get ready! Revealing your bottom two cards in: {peekCountdown}...</p>;
      } else if (isPeekRevealActive && !clientPlayerState.hasCompletedInitialPeek) {
        initialPeekPhaseUI = <p className="text-center p-2 text-blue-600 font-bold">MEMORIZE YOUR BOTTOM TWO CARDS!</p>;
      } else if (clientPlayerState.hasCompletedInitialPeek) {
        initialPeekPhaseUI = <p className="text-center p-2">Peek complete. Waiting for game to start...</p>;
      } else {
        initialPeekPhaseUI = <p className="text-center p-2">Preparing for peek...</p>;
      }
    }
  }
  
  return (
    <div className="game-board p-4 border border-gray-300 rounded-lg bg-gray-50 shadow-lg text-gray-800" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold mb-1">Check Game Board</h2>
        <p className="text-sm text-gray-600">
          Phase: <span className="font-semibold text-indigo-600">{ctx.phase}</span> | 
          Current Player: <span className="font-semibold text-red-600">{ctx.currentPlayer}</span>
          {playerID && (
            <span> | Your ID: <span className="font-semibold text-blue-600">{playerID}</span> 
            {isActive && ctx.phase !== 'initialPeekPhase' ? "(Your Turn)" : ""} 
            {/* Custom active message for initial peek phase stages may be needed if isActive isn't intuitive */} 
            </span>
          )}
        </p>
        {ctx.gameover && (
          <div className="mt-2 p-2 bg-green-100 border border-green-600 text-green-800 rounded">
            <strong>Round Over!</strong> Winner: {JSON.stringify(ctx.gameover?.winner)}
            {/* TODO: Display scores properly */}
          </div>
        )}
      </div>

      {initialPeekPhaseUI && <div className="initial-peek-status my-4">{initialPeekPhaseUI}</div>}

      {/* Player Hands Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {Object.keys(typedG.players).map(pID => (
          <PlayerHandComponent
            key={pID}
            playerID={pID}
            playerState={typedG.players[pID]}
            isCurrentPlayerBoard={pID === playerID} // Is this hand for the viewing client's player?
            onCardClick={handleCardClick} // Allow clicking on any card for abilities
            selectedCardIndices={pID === playerID ? (selectedHandCardIndex !== null ? [selectedHandCardIndex] : []) : []}
            currentPlayersCardsToShowFaceUp={pID === playerID ? getOwnCardsToShowFaceUp() : {}}
          />
        ))}
      </div>

      {/* Piles and Player Action Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 items-start">
        <DrawPileComponent
          canDraw={canDrawFromDeck}
          onClick={handleDrawFromDeck}
          numberOfCards={typedG.deck.length}
        />

        <DiscardPileComponent
          topCard={typedG.discardPile.length > 0 ? typedG.discardPile[typedG.discardPile.length - 1] : null}
          canDraw={canDrawFromDiscard}
          onClick={handleDrawFromDiscard}
          isSealed={typedG.discardPileIsSealed}
          numberOfCards={typedG.discardPile.length}
        />

        {/* Current Player's Action Zone */}
        {playerID && clientPlayerState && (
          <div className="p-3 border border-blue-300 rounded-lg bg-blue-50">
            <h4 className="text-lg font-semibold mb-2 text-blue-700">Your Actions (Player {playerID})</h4>
            
            {/* Displaying a drawn card before action */}
            {clientPlayerState.pendingDrawnCard && isActive && (
              <div className="mb-3 p-2 border border-dashed border-green-500 bg-green-50 rounded">
                <p className="text-sm font-medium text-green-700">Drawn Card (from {clientPlayerState.pendingDrawnCardSource}):</p>
                <div className="flex justify-center my-1">
                  <CardComponent card={clientPlayerState.pendingDrawnCard} isFaceUp={true} />
                </div>
                {selectedHandCardIndex !== null && (
                  <button 
                    onClick={() => handleSwapAndDiscard(selectedHandCardIndex)} 
                    className="w-full mt-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded text-sm">
                    Swap with selected hand card (Pos: {selectedHandCardIndex})
                  </button>
                )}
                {clientPlayerState.pendingDrawnCardSource === 'deck' && (
                  <button 
                    onClick={handleDiscardDrawnCard} 
                    className="w-full mt-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-1 px-2 rounded text-sm">
                    Discard Drawn Card
                  </button>
                )}
              </div>
            )}

            {/* Buttons for moves, conditional on phase and player state */}
            {canCallCheck && (
              <button onClick={handleCallCheck} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-sm mb-2">Call Check!</button>
            )}

            {isInMatchingStage && (
              <div className="mb-2">
                <div className="text-sm font-medium mb-1">
                  Matching Opportunity for: 
                  <CardComponent card={typedG.matchingOpportunityInfo?.cardToMatch || null} isFaceUp={true} style={{display: 'inline-block', verticalAlign: 'middle', transform: 'scale(0.7)', margin: '0 3px'}}/> 
                  (Rank: {typedG.matchingOpportunityInfo?.cardToMatch.rank})
                </div>
                {selectedHandCardIndex !== null && clientPlayerState.hand[selectedHandCardIndex] && (
                  <button 
                    onClick={() => handleAttemptMatch(selectedHandCardIndex)} 
                    className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-1 px-2 rounded text-sm mb-1">
                    Attempt Match with selected card (Rank: { (clientPlayerState.hand[selectedHandCardIndex] as Card)?.rank })
                  </button>
                )}
                <button onClick={handlePassMatch} className="w-full bg-gray-400 hover:bg-gray-500 text-white font-bold py-1 px-2 rounded text-sm">Pass Match</button>
              </div>
            )}
            
            {isInAbilityResolutionStage && (
              <div className="mb-2 p-2 border border-yellow-500 bg-yellow-50 rounded">
                <p className="text-sm font-medium text-yellow-700">Resolve Ability: {clientPlayerState.pendingSpecialAbility!.card.rank} (Source: {clientPlayerState.pendingSpecialAbility!.source})</p>
                <p className="text-xs">Selected for ability: {JSON.stringify(multiSelectedCardLocations)}</p>
                <p className="text-xs">Args: {JSON.stringify(abilityArgs)}</p>
                {/* TODO: More specific UI for selecting targets for K, Q, J based on abilityArgs state */} 
                <button 
                  onClick={handleResolveSpecialAbility} 
                  disabled={!abilityArgs && !(clientPlayerState.pendingSpecialAbility!.card.rank === Rank.Jack && multiSelectedCardLocations.length === 2) /* Basic disable, needs refinement*/}
                  className="w-full mt-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-2 rounded text-sm">
                  Confirm Ability Action
                </button>
              </div>
            )}

          </div>
        )}
      </div>
      
      {/* Debug Info - Can be removed for production */}
       <div className="mt-6 p-3 border border-gray-200 rounded bg-gray-100">
        <h4 className="text-md font-semibold mb-1 text-gray-700">Debug State:</h4>
        <pre className="text-xs overflow-x-auto">{JSON.stringify({ G: typedG, ctx, playerID, isActive, selectedHandCardIndex, multiSelectedCardLocations, revealedCardLocations, abilityArgs }, null, 2)}</pre>
      </div>
    </div>
  );
};

export default CheckGameBoard; 