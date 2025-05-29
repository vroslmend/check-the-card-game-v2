import { Card, Suit, Rank, PlayerState, CheckGameState as ServerCheckGameState, InitialPlayerSetupData, cardValues, HiddenCard, ClientCard, ClientPlayerState, ClientCheckGameState, SpecialAbilityInfo, PendingSpecialAbility } from 'shared-types';

// Placeholder for playerSetupData structure, will be moved to shared-types
// export interface InitialPlayerSetupData {
//   id: string; // e.g., socket.id or a user-chosen ID if unique
//   name?: string;
// }

// Helper function to create a standard 52-card deck
export const createDeck = (): Card[] => {
  const suits = Object.values(Suit);
  const ranks = Object.values(Rank);
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
};

// TODO: Replace with a proper random shuffle (e.g., Fisher-Yates)
// This is a placeholder and NOT cryptographically secure or truly random.
const simpleShuffle = <T>(array: T[]): T[] => {
  return array.sort(() => Math.random() - 0.5);
};


interface GameRoom {
  gameId: string;
  players: { [playerId: string]: PlayerState }; // Map socket.id or a custom ID to player game state
  gameState: ServerCheckGameState;
  // We'll need to add currentPhase, currentPlayerId, etc., as we migrate phase logic
  // For now, let's keep it simple and align with boardgame.io's G structure first.
  // We will also need to define what a "player" means in this context:
  // is it just their ID and connection (socket), or more?
}

// In-memory store for active games.
// In a production scenario, you might replace this with a database (e.g., Redis) for scalability.
const activeGames: { [gameId: string]: GameRoom } = {};

// Function to initialize a new game - adapting from boardgame.io's setup
// We'll need numPlayers and playerSetupData (e.g., their self-assigned IDs or we assign them)
export const initializeNewGame = (gameId: string, playerSetupData: InitialPlayerSetupData[]): GameRoom | null => {
  const numPlayers = playerSetupData.length;
  if (numPlayers < 2 || numPlayers > 4) { // Example player limits
    console.error(`[GameManager] Invalid number of players: ${numPlayers} for game ${gameId}`);
    return null; // Ensure null is returned if invalid number of players
  }

  const deck = createDeck();
  const shuffledDeck = simpleShuffle(deck); // Use a proper shuffle algorithm later

  const initialPlayers: { [playerID: string]: PlayerState } = {};
  playerSetupData.forEach((playerInfo, index) => { // Added index parameter
    const playerId = playerInfo.id; // Assuming playerSetupData contains at least an ID
    initialPlayers[playerId] = {
      hand: shuffledDeck.splice(0, 4), // Deal 4 cards
      // Initialize other PlayerState fields from shared-types
      hasUsedInitialPeek: false,
      isReadyForInitialPeek: false,
      hasCompletedInitialPeek: false,
      pendingDrawnCard: null,
      pendingDrawnCardSource: null,
      pendingSpecialAbility: null,
      hasCalledCheck: false,
      isLocked: false,
      score: 0,
      // name: playerInfo.name || `Player ${index + 1}` // Optionally store player names
    };
  });

  const initialGameState: ServerCheckGameState = {
    deck: shuffledDeck,
    players: initialPlayers,
    discardPile: [],
    discardPileIsSealed: false,
    matchingOpportunityInfo: null,
    playerWhoCalledCheck: null,
    roundWinner: null,
    finalTurnsTaken: 0,
    lastResolvedAbilitySource: null,
    initialPeekAllReadyTimestamp: null,
    lastPlayerToResolveAbility: null,
    lastResolvedAbilityCardForCleanup: null,
    matchResolvedDetails: null,
    // Add other top-level game state fields as defined in CheckGameState
    // For example, we'll need currentPhase, currentPlayerId, etc.
    // These will be managed directly now instead of by boardgame.io's ctx
    currentPhase: 'initialPeekPhase', // Default starting phase
    currentPlayerId: playerSetupData[0].id, // Default to the first player
    turnOrder: playerSetupData.map(p => p.id), // Simple turn order
    gameMasterId: playerSetupData[0].id, // Optional: assign a game master
    // We may need more fields here to replace boardgame.io's ctx functionality.
    // For example, active players for a specific stage within a phase.
    activePlayers: playerSetupData.reduce((acc, p) => {
      acc[p.id] = 'awaitingReadiness'; // All players need to declare ready
      return acc;
    }, {} as { [playerID: string]: string }), 
    // gameover will be derived or set explicitly.
  };

  const newGameRoom: GameRoom = {
    gameId,
    players: initialPlayers, // This is redundant with gameState.players but might be useful for socket mapping
    gameState: initialGameState,
  };

  activeGames[gameId] = newGameRoom;
  console.log(`[GameManager] New game room created: ${gameId} with players: ${playerSetupData.map(p=>p.id).join(', ')}`);
  return newGameRoom;
};

export const getGameRoom = (gameId: string): GameRoom | undefined => {
  return activeGames[gameId];
};

export const addPlayerToGame = (
  gameId: string, 
  playerInfo: InitialPlayerSetupData
): { success: boolean; message?: string; gameRoom?: GameRoom, newPlayerState?: PlayerState } => {
  const gameRoom = getGameRoom(gameId);

  if (!gameRoom) {
    return { success: false, message: "Game not found." };
  }

  if (gameRoom.gameState.players[playerInfo.id]) {
    // Player already in game, consider this a success for rejoining purposes
    return { success: true, message: "Player already in game.", gameRoom };
  }

  const currentNumPlayers = Object.keys(gameRoom.gameState.players).length;
  // Assuming a max of 4 players for now, this should be configurable or derived from game settings
  if (currentNumPlayers >= 4) { 
    return { success: false, message: "Game is full." };
  }

  // Initialize new player state
  // For now, new players get an empty hand. Card dealing for new players would be more complex.
  const newPlayerState: PlayerState = {
    hand: [], 
    hasUsedInitialPeek: false,
    isReadyForInitialPeek: false,
    hasCompletedInitialPeek: false,
    pendingDrawnCard: null,
    pendingDrawnCardSource: null,
    pendingSpecialAbility: null,
    hasCalledCheck: false,
    isLocked: false,
    score: 0,
    // name: playerInfo.name // Optional: use playerInfo.name if provided
  };

  gameRoom.gameState.players[playerInfo.id] = newPlayerState;
  gameRoom.gameState.turnOrder.push(playerInfo.id);
  // Potentially update activePlayers if the game logic requires new joiners to be active
  // e.g., gameRoom.gameState.activePlayers[playerInfo.id] = 'someDefaultStage';

  // Note: The `players` property in GameRoom is currently redundant with gameState.players.
  // If it were used for mapping sockets or other metadata, it should be updated here too.
  // gameRoom.players[playerInfo.id] = newPlayerState; // If `GameRoom.players` is kept separate

  activeGames[gameId] = gameRoom; // Update the game in our in-memory store

  console.log(`[GameManager] Player ${playerInfo.id} added to game ${gameId}. Total players: ${Object.keys(gameRoom.gameState.players).length}`);
  return { success: true, gameRoom, newPlayerState };
};

// --- Game Move Handlers ---
export const handleDrawFromDeck = (
  gameId: string,
  playerId: string
): { success: boolean; message?: string; updatedGameState?: ServerCheckGameState } => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) {
    return { success: false, message: "Game not found." };
  }

  const player = gameRoom.gameState.players[playerId];
  if (!player) {
    return { success: false, message: "Player not found in game." };
  }

  // Check game rules / player state before allowing draw
  if (player.pendingDrawnCard) {
    return { success: false, message: "Player already has a pending drawn card." };
  }
  if (player.pendingSpecialAbility) {
    return { success: false, message: "Player has a pending special ability to resolve." };
  }
  // Add other checks, e.g., is it the player's turn? Is the game in a phase where drawing is allowed?
  // if (gameRoom.gameState.currentPlayerId !== playerId) {
  //   return { success: false, message: "Not your turn." };
  // }
  // if (gameRoom.gameState.currentPhase !== 'playPhase') { // Assuming 'playPhase' is when drawing is allowed
  //   return { success: false, message: "Cannot draw in the current game phase." };
  // }

  if (gameRoom.gameState.deck.length === 0) {
    return { success: false, message: "Deck is empty." };
  }

  const card = gameRoom.gameState.deck.pop(); // Removes the card from the deck
  if (!card) {
    // This case should ideally not be reached if deck.length > 0 check passes
    return { success: false, message: "Failed to draw card (deck might be unexpectedly empty)." };
  }

  player.pendingDrawnCard = card;
  player.pendingDrawnCardSource = 'deck';
  
  // Update the game state in activeGames
  activeGames[gameId] = gameRoom;

  console.log(`[GameManager] Player ${playerId} drew from deck in game ${gameId}. Card: ${card.rank}${card.suit}. Deck size: ${gameRoom.gameState.deck.length}`);
  return { success: true, updatedGameState: gameRoom.gameState };
};

export const handleDrawFromDiscard = (
  gameId: string,
  playerId: string
): { success: boolean; message?: string; updatedGameState?: ServerCheckGameState } => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) {
    return { success: false, message: "Game not found." };
  }

  const player = gameRoom.gameState.players[playerId];
  if (!player) {
    return { success: false, message: "Player not found in game." };
  }

  // Rule checks
  if (player.pendingDrawnCard) {
    return { success: false, message: "Player already has a pending drawn card." };
  }
  if (player.pendingSpecialAbility) {
    return { success: false, message: "Player has a pending special ability to resolve." };
  }
  // Add turn/phase checks here as needed
  // e.g., if (gameRoom.gameState.currentPlayerId !== playerId || gameRoom.gameState.currentPhase !== 'playPhase') { ... }

  if (gameRoom.gameState.discardPile.length === 0) {
    return { success: false, message: "Discard pile is empty." };
  }

  if (gameRoom.gameState.discardPileIsSealed) {
    return { success: false, message: "Discard pile is sealed." };
  }

  const card = gameRoom.gameState.discardPile.pop(); // Removes card from discard pile
  if (!card) {
    return { success: false, message: "Failed to draw card from discard (pile unexpectedly empty)." };
  }

  player.pendingDrawnCard = card;
  player.pendingDrawnCardSource = 'discard';

  activeGames[gameId] = gameRoom; // Update game state in our store

  console.log(`[GameManager] Player ${playerId} drew from discard in game ${gameId}. Card: ${card.rank}${card.suit}. Discard pile size: ${gameRoom.gameState.discardPile.length}`);
  return { success: true, updatedGameState: gameRoom.gameState };
};

export const handleSwapAndDiscard = (
  gameId: string,
  playerId: string,
  handIndex: number
): { success: boolean; message?: string; updatedGameState?: ServerCheckGameState } => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return { success: false, message: "Game not found." };

  const player = gameRoom.gameState.players[playerId];
  if (!player) return { success: false, message: "Player not found." };

  if (!player.pendingDrawnCard) return { success: false, message: "No card pending to swap." };
  if (handIndex < 0 || handIndex >= player.hand.length) return { success: false, message: "Invalid hand index." };

  // Add turn/phase checks here if necessary. For example:
  // if (gameRoom.gameState.currentPlayerId !== playerId || gameRoom.gameState.currentPhase !== 'playPhase') { 
  //   return { success: false, message: "Cannot swap card now." };
  // }

  const discardedCard = player.hand[handIndex];
  player.hand[handIndex] = player.pendingDrawnCard;
  player.pendingDrawnCard = null;
  player.pendingDrawnCardSource = null;
  gameRoom.gameState.discardPile.push(discardedCard);

  gameRoom.gameState.matchingOpportunityInfo = {
    cardToMatch: discardedCard,
    originalPlayerID: playerId,
  };

  // --- Phase Transition Logic ---
  gameRoom.gameState.currentPhase = 'matchingStage';
  // Set all players as active in a generic 'matching' stage for this phase
  const newActivePlayers: { [playerID: string]: string } = {};
  for (const pId in gameRoom.gameState.players) {
    newActivePlayers[pId] = 'awaitingMatchAction'; // Or simply 'matchingStage'
  }
  gameRoom.gameState.activePlayers = newActivePlayers;
  // We might also need to reset/set move limits or other phase-specific ctx here if we re-implement that level of detail.
  // For now, just setting the phase and active players.
  // currentPlayerId typically doesn't change just by entering matching stage, as all players can act.

  activeGames[gameId] = gameRoom;
  console.log(`[GameManager] Player ${playerId} swapped and discarded in ${gameId}. Card: ${discardedCard.rank}${discardedCard.suit}. Phase -> matchingStage.`);
  return { success: true, updatedGameState: gameRoom.gameState };

};

export const handleDiscardDrawnCard = (
  gameId: string,
  playerId: string
): { success: boolean; message?: string; updatedGameState?: ServerCheckGameState } => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return { success: false, message: "Game not found." };

  const player = gameRoom.gameState.players[playerId];
  if (!player) return { success: false, message: "Player not found." };

  if (!player.pendingDrawnCard) return { success: false, message: "No card pending to discard." };
  if (player.pendingDrawnCardSource !== 'deck') return { success: false, message: "Cannot discard card not drawn from deck." };

  // Add turn/phase checks here if necessary

  const discardedCard = player.pendingDrawnCard;
  player.pendingDrawnCard = null;
  player.pendingDrawnCardSource = null;
  gameRoom.gameState.discardPile.push(discardedCard);

  gameRoom.gameState.matchingOpportunityInfo = {
    cardToMatch: discardedCard,
    originalPlayerID: playerId,
  };

  // --- Phase Transition Logic ---
  gameRoom.gameState.currentPhase = 'matchingStage';
  const newActivePlayers: { [playerID: string]: string } = {};
  for (const pId in gameRoom.gameState.players) {
    newActivePlayers[pId] = 'awaitingMatchAction'; // Or simply 'matchingStage'
  }
  gameRoom.gameState.activePlayers = newActivePlayers;

  activeGames[gameId] = gameRoom;
  console.log(`[GameManager] Player ${playerId} discarded drawn card in ${gameId}. Card: ${discardedCard.rank}${discardedCard.suit}. Phase -> matchingStage.`);
  return { success: true, updatedGameState: gameRoom.gameState };
};

export const handleAttemptMatch = (
  gameId: string,
  playerId: string,
  handIndex: number
): { success: boolean; message?: string; updatedGameState?: ServerCheckGameState } => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return { success: false, message: "Game not found." };

  const G = gameRoom.gameState; // Alias for convenience
  const player = G.players[playerId];

  if (!player) return { success: false, message: "Player not found." };
  if (handIndex < 0 || handIndex >= player.hand.length) return { success: false, message: "Invalid hand index." };
  
  // Rule checks for matchingStage
  if (G.currentPhase !== 'matchingStage') return { success: false, message: "Not in matching stage." };
  // Ensure player is active in this stage - G.activePlayers[playerId] should be 'awaitingMatchAction' or similar
  if (!G.activePlayers || !G.activePlayers[playerId]) return { success: false, message: "Player not active for matching." };

  const { cardToMatch, originalPlayerID } = G.matchingOpportunityInfo || {};
  if (!cardToMatch || !originalPlayerID) return { success: false, message: "No matching opportunity active." };

  const cardY = player.hand[handIndex]; // Card player is attempting to match with
  const cardX = cardToMatch; // Card on top of discard pile that initiated the match

  if (cardY.rank === cardX.rank) {
    // Successful Match
    player.hand.splice(handIndex, 1); // Remove card from hand
    G.discardPile.push(cardY); // Add it to discard pile
    G.discardPileIsSealed = true;
    
    let abilityResolutionRequired = false;
    const isCardXSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(cardX.rank);
    const isCardYSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(cardY.rank);

    if (isCardXSpecial && isCardYSpecial) {
      // Both cards in the pair are special: King, Queen, or Jack
      if (G.players[playerId]) {
        G.players[playerId].pendingSpecialAbility = { card: cardY, source: 'stack', pairTargetId: originalPlayerID };
      }
      if (G.players[originalPlayerID]) {
        G.players[originalPlayerID].pendingSpecialAbility = { card: cardX, source: 'stackSecondOfPair', pairTargetId: playerId };
      }
      abilityResolutionRequired = true;
      console.log(`[GameManager] Special match pair: ${cardX.rank} & ${cardY.rank}. Abilities set for ${originalPlayerID} (pair: ${playerId}) and ${playerId} (pair: ${originalPlayerID}).`);
    }

    let isAutoCheck = false;
    if (player.hand.length === 0) {
      player.hasCalledCheck = true;
      player.isLocked = true;
      if (!G.playerWhoCalledCheck) G.playerWhoCalledCheck = playerId;
      G.finalTurnsTaken = 0; // Reset for final turns phase
      isAutoCheck = true;
      console.log(`[GameManager] Player ${playerId} emptied hand on match. Auto-Check!`);
    }

    // G.matchingOpportunityInfo = null; // This will be cleared by checkMatchingStageEnd if a match is resolved
    // Player is no longer active for matching this round - this is handled by checkMatchingStageEnd logic
    // delete G.activePlayers[playerId]; 

    // --- Set details for checkMatchingStageEnd to handle phase transition ---
    G.matchResolvedDetails = {
      byPlayerId: playerId,
      isAutoCheck,
      abilityResolutionRequired,
    };
    
    // Let checkMatchingStageEnd handle the next phase and update game state
    // activeGames[gameId] is updated within checkMatchingStageEnd or subsequent setup functions
    const finalGameState = checkMatchingStageEnd(gameId);
    if (!finalGameState) return {success: false, message: "Error after attempting match (checkMatchingStageEnd failed processing match details)." };
    
    // Note: activeGames[gameId] should be updated by checkMatchingStageEnd or the setup functions it calls.
    return { success: true, updatedGameState: finalGameState };

  } else {
    // Failed Match - player tried but cards didn't match rank
    // Player might get a penalty here depending on rules (not in current boardgame.io logic)
    // For now, it's just an invalid move for this attempt, they remain active in matchingStage.
    return { success: false, message: "Cards do not match." };
  }
};

// Helper function to be called after a pass or potentially after a match that doesn't immediately end the game via ability/autocheck
const checkMatchingStageEnd = (gameId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return null;
  const G = gameRoom.gameState;

  // Scenario 1: A match was just successfully made and details are in G.matchResolvedDetails
  if (G.matchResolvedDetails) {
    const { byPlayerId, isAutoCheck, abilityResolutionRequired } = G.matchResolvedDetails;
    console.log(`[GameManager] checkMatchingStageEnd: Processing resolved match by ${byPlayerId} in game ${gameId}.`);

    G.matchingOpportunityInfo = null; // Clear the opportunity
    if (G.activePlayers[byPlayerId]) {
        delete G.activePlayers[byPlayerId]; // Matcher is done with this stage
    }
    // Other players who didn't match are also implicitly done with this specific opportunity.
    // If the phase requires all players to confirm pass even after a match, activePlayers would need different handling.
    // Based on "stage ends once one player successfully matches", clearing active players related to matching is fine.
    // Let's clear all from 'awaitingMatchAction' if a match happens.
    const remainingActiveKeys = Object.keys(G.activePlayers);
    for (const pId of remainingActiveKeys) {
        if (G.activePlayers[pId] === 'awaitingMatchAction') {
            delete G.activePlayers[pId];
        }
    }

    G.matchResolvedDetails = null; // Clear details after processing

    if (abilityResolutionRequired) {
      console.log("[GameManager] checkMatchingStageEnd (after match): Match resulted in abilities. Transitioning to abilityResolutionStage.");
      setupAbilityResolutionPhase(gameId);
    } else if (isAutoCheck) {
      console.log("[GameManager] checkMatchingStageEnd (after match): Match resulted in auto-check. Transitioning to finalTurnsPhase.");
      setupFinalTurnsPhase(gameId, byPlayerId); // byPlayerId is the one who auto-checked
    } else {
      console.log("[GameManager] checkMatchingStageEnd (after match): Match successful. No abilities/check. Transitioning to playPhase.");
      setupNextPlayTurn(gameId);
    }
    activeGames[gameId] = gameRoom;
    return G;
  }

  // Scenario 2: No match resolved yet, called from a pass or to check if all passed.
  // Check if any players are still active for the current matching opportunity
  const remainingActiveMatchers = Object.keys(G.activePlayers).length > 0 && 
                                Object.values(G.activePlayers).some(status => status === 'awaitingMatchAction');

  if (!remainingActiveMatchers && G.matchingOpportunityInfo) { // All passed or no one left to act, AND there was an opportunity
    console.log(`[GameManager] checkMatchingStageEnd: All players passed or resolved for game ${gameId}. Ending matching stage.`);
    const { cardToMatch, originalPlayerID } = G.matchingOpportunityInfo; // Non-null asserted by G.matchingOpportunityInfo check
    G.matchingOpportunityInfo = null; // Clear the opportunity as it's now concluded (all passed)

    const originalDiscarder = G.players[originalPlayerID];
    const isOriginalDiscardSpecial = originalDiscarder && cardToMatch && [Rank.King, Rank.Queen, Rank.Jack].includes(cardToMatch.rank);
    
    // This check is crucial: if a stack ability was set, attemptMatch would have set matchResolvedDetails and taken the path above.
    // So, if we are here, it means no K/Q/J match pair ability is pending from *this* matching opportunity.
    // We only care about the original discarder's non-paired special card.
    if (isOriginalDiscardSpecial && !originalDiscarder.pendingSpecialAbility) {
      console.log(`[GameManager] checkMatchingStageEnd (all passed): Original discarder ${originalPlayerID} has ${cardToMatch.rank} ability from discard.`);
      originalDiscarder.pendingSpecialAbility = { card: cardToMatch, source: 'discard' };
      setupAbilityResolutionPhase(gameId);
    } else {
      console.log(`[GameManager] checkMatchingStageEnd (all passed): No further abilities from discard. Returning to playPhase.`);
      setupNextPlayTurn(gameId);
    }
    activeGames[gameId] = gameRoom;
    return G;
  }
  
  // If still in matching stage and players are active, or no opportunity was present, no state change here.
  // This path means the matching stage continues or was never properly initiated with an opportunity.
  if (G.matchingOpportunityInfo && remainingActiveMatchers){
    console.log(`[GameManager] checkMatchingStageEnd: Matching stage continues for game ${gameId}. Active matchers present.`);
  }
  activeGames[gameId] = gameRoom; // Ensure G is up-to-date if minor modifications happened
  return G;
};

export const handlePassMatch = (
  gameId: string,
  playerId: string
): { success: boolean; message?: string; updatedGameState?: ServerCheckGameState } => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return { success: false, message: "Game not found." };

  const G = gameRoom.gameState;
  if (G.currentPhase !== 'matchingStage') return { success: false, message: "Not in matching stage." };
  if (!G.activePlayers || !G.activePlayers[playerId]) return { success: false, message: "Player not active for matching or already passed." };

  console.log(`[GameManager] Player ${playerId} passed in matching stage for game ${gameId}.`);
  delete G.activePlayers[playerId]; // Player is done with this matching opportunity

  const updatedGameState = checkMatchingStageEnd(gameId);
  if (!updatedGameState) return {success: false, message: "Error after passing."}; // Should not happen if gameRoom exists
  
  activeGames[gameId] = gameRoom; // Ensure gameRoom (which contains G) is updated
  return { success: true, updatedGameState };
};

export const handleCallCheck = (
  gameId: string,
  playerId: string
): { success: boolean; message?: string; updatedGameState?: ServerCheckGameState } => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return { success: false, message: "Game not found." };
  const G = gameRoom.gameState;
  const player = G.players[playerId];

  if (!player) return { success: false, message: "Player not found." };

  // --- Rule Checks ---
  if (G.currentPhase !== 'playPhase') {
    return { success: false, message: "Cannot call Check outside of play phase." };
  }
  if (G.currentPlayerId !== playerId) {
    return { success: false, message: "Not your turn to call Check." };
  }
  if (player.hasCalledCheck) {
    return { success: false, message: "You have already called Check." };
  }
  if (player.pendingDrawnCard) {
    return { success: false, message: "Cannot call Check with a pending drawn card." };
  }
  if (player.pendingSpecialAbility) {
    return { success: false, message: "Cannot call Check with a pending special ability." };
  }

  player.hasCalledCheck = true;
  player.isLocked = true;
  if (!G.playerWhoCalledCheck) {
    G.playerWhoCalledCheck = playerId;
  }
  G.finalTurnsTaken = 0;

  // --- Phase Transition ---
  console.log(`[GameManager] Player ${playerId} called Check in game ${gameId}. Transitioning to finalTurnsPhase.`);
  
  setupFinalTurnsPhase(gameId, playerId); // Call the helper to manage phase, currentPlayer, activePlayers

  activeGames[gameId] = gameRoom; // gameRoom.gameState (G) is modified by setupFinalTurnsPhase
  return { success: true, updatedGameState: G };
};

// --- Phase Setup Helper Functions ---

// Forward declaration for setupScoringPhase if needed by setupNextPlayTurn sooner
// const setupScoringPhase = (gameId: string): ServerCheckGameState | null => { /* ... */ };

const setupNextPlayTurn = (gameId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) { console.error(`[GameManager] setupNextPlayTurn: Game room ${gameId} not found.`); return null; }
  const G = gameRoom.gameState;

  // If a check has been called and we are in the final turns phase, let continueOrEndFinalTurns handle it.
  if (G.playerWhoCalledCheck && G.currentPhase === 'finalTurnsPhase') {
    console.log(`[GameManager] setupNextPlayTurn: In finalTurnsPhase for game ${gameId}. Calling continueOrEndFinalTurns.`);
    return continueOrEndFinalTurns(gameId);
  }

  // If a check was called, but we're not yet in finalTurnsPhase (e.g. abilities resolved after check, before final turns began for a player)
  // OR if somehow playerWhoCalledCheck is set but phase is wrong, this implies a potential state issue
  // that should ideally be rectified by prior logic leading to either setupFinalTurnsPhase or continueOrEndFinalTurns.
  // For safety, if check is called but we are NOT in finalTurnsPhase, it might mean we need to properly start it.
  // However, setupAbilityResolutionPhase also handles this transition. This existing block seems more like a fallback.
  if (G.playerWhoCalledCheck && G.currentPhase !== 'finalTurnsPhase') {
      // This usually means abilities just resolved after a check, and setupAbilityResolutionPhase should have called setupFinalTurnsPhase.
      // If we reach here, it's a bit unusual. Re-initiating final turns might be an option, or it points to a flow error.
      console.warn(`[GameManager] setupNextPlayTurn: playerWhoCalledCheck is set for game ${gameId}, but not in finalTurnsPhase. Current phase: ${G.currentPhase}. This might indicate an issue if abilities didn't transition to setupFinalTurnsPhase correctly.`);
      // Attempt to (re)start final turns. If already started and this is a mid-sequence call, continueOrEndFinalTurns would be better.
      // return setupFinalTurnsPhase(gameId, G.playerWhoCalledCheck); // This could reset finalTurnsTaken if called inappropriately.
      // Given continueOrEndFinalTurns handles incrementing, if we are here, it implies the phase setup itself is the issue.
      // The primary transition to final turns after abilities (if check is called) should come from setupAbilityResolutionPhase.
      // This block is now more of a safety net / warning for an unexpected state.
  }

  // Standard logic for finding next player in playPhase (or if check path above wasn't taken)
  if (!G.turnOrder || G.turnOrder.length === 0) {
    console.error(`[GameManager] setupNextPlayTurn: No turn order for game ${gameId}`);
    G.currentPhase = 'error'; G.activePlayers = {}; G.currentPlayerId = "";
    activeGames[gameId] = gameRoom; return G;
  }

  let currentPlayerIndex = G.turnOrder.indexOf(G.currentPlayerId);
  if (currentPlayerIndex === -1) {
    // Current player not found (e.g. game start), or coming from a phase not setting currentPlayerId in turnOrder.
    // Default to the first player in turn order or handle as appropriate.
    console.warn(`[GameManager] setupNextPlayTurn: Current player ${G.currentPlayerId} not in turn order for game ${gameId}. Starting from first player.`);
    G.currentPlayerId = G.turnOrder[0];
    currentPlayerIndex = G.turnOrder.indexOf(G.currentPlayerId); // Should be 0 or valid index
    // If still -1, turnOrder is empty or player ID is bad, which is caught earlier.
  }

  let nextPlayerId = "";
  let attempts = 0;
  let foundNextPlayer = false;

  if (G.turnOrder.length > 0) {
      do {
        currentPlayerIndex = (currentPlayerIndex + 1) % G.turnOrder.length;
        const potentialNextPlayerId = G.turnOrder[currentPlayerIndex];
        if (!G.players[potentialNextPlayerId]?.isLocked) {
          nextPlayerId = potentialNextPlayerId;
          foundNextPlayer = true;
          break;
        }
        attempts++;
      } while (attempts <= G.turnOrder.length);
  } else {
      console.error("[GameManager] Turn order is empty in setupNextPlayTurn for game: ", gameId);
      G.currentPhase = 'error'; G.activePlayers = {}; G.currentPlayerId = "";
      activeGames[gameId] = gameRoom; return G;
  }
  

  if (!foundNextPlayer) {
    console.warn(`[GameManager] setupNextPlayTurn: No unlocked player found in game ${gameId}.`);
    if (G.playerWhoCalledCheck) { // If check was called and somehow no one is found for next turn (should be handled by finalTurnsPhase ending)
        return setupScoringPhase(gameId); // Actual call
    }
    G.currentPhase = 'errorOrStalemate'; 
    G.activePlayers = {}; G.currentPlayerId = "";
    console.error(`[GameManager] Game ${gameId} is stuck. All players locked, no check path to scoring defined here.`);
    activeGames[gameId] = gameRoom; return G;
  }
  
  G.currentPhase = 'playPhase';
  G.currentPlayerId = nextPlayerId;
  G.activePlayers = { [nextPlayerId]: 'playPhaseActive' };
  G.discardPileIsSealed = false; 
  // G.matchingOpportunityInfo = null; // This should be cleared by matching stage resolution

  console.log(`[GameManager] game ${gameId} setup for next play turn. Player: ${G.currentPlayerId}.`);
  activeGames[gameId] = gameRoom; 
  return G;
};

const setupFinalTurnsPhase = (gameId: string, checkerPlayerId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) { console.error(`[GameManager] setupFinalTurnsPhase: Game room ${gameId} not found.`); return null; }
  const G = gameRoom.gameState;

  G.currentPhase = 'finalTurnsPhase';
  if (!G.playerWhoCalledCheck) G.playerWhoCalledCheck = checkerPlayerId; // Ensure it's set
  G.finalTurnsTaken = 0; // Reset for the start of the final turns sequence

  let nextPlayerId = "";
  const checkerIndex = G.turnOrder.indexOf(checkerPlayerId);

  if (checkerIndex === -1) {
      console.error(`[GameManager] setupFinalTurnsPhase: Player ${checkerPlayerId} (who called check) not in turn order!`);
      return setupScoringPhase(gameId); // Actual call
  }

  let attempts = 0;
  let currentIndex = checkerIndex;
  let foundNextPlayer = false;

  // Iterate through players to find the first non-locked player who is not the one who called Check.
  while (attempts < G.turnOrder.length) { // Max attempts equal to number of players
    currentIndex = (currentIndex + 1) % G.turnOrder.length;
    const potentialNextPlayerId = G.turnOrder[currentIndex];
    
    if (potentialNextPlayerId === checkerPlayerId) {
        // Cycled through all players and returned to the checker.
        // This means no other eligible player was found.
        break; 
    }
    if (!G.players[potentialNextPlayerId]?.isLocked) {
        nextPlayerId = potentialNextPlayerId;
        foundNextPlayer = true;
        break;
    }
    attempts++;
  }
  
  if (foundNextPlayer) {
    G.currentPlayerId = nextPlayerId;
    G.activePlayers = { [nextPlayerId]: 'finalTurnActive' };
    console.log(`[GameManager] game ${gameId} entered finalTurnsPhase. Player ${checkerPlayerId} called Check. Next player for final turn: ${G.currentPlayerId}.`);
  } else {
    console.log(`[GameManager] game ${gameId} finalTurnsPhase: No eligible player for a final turn. Proceeding to scoring.`);
    return setupScoringPhase(gameId); // Actual call
  }
  activeGames[gameId] = gameRoom;
  return G;
};

const setupAbilityResolutionPhase = (gameId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) { console.error(`[GameManager] setupAbilityResolutionPhase: Game room ${gameId} not found.`); return null; }
  const G = gameRoom.gameState;
  
  G.currentPhase = 'abilityResolutionStage';
  
  let playerWithAbilityId: string | null = null;
  const lastPlayerIdWhoResolved = G.lastPlayerToResolveAbility;
  const lastResolvedCardInfo = G.lastResolvedAbilityCardForCleanup; // This was the card of the last resolved ability

  // LIFO Check for Stacked Pairs:
  // If the last resolved ability was a 'stack' source, its pairTarget (original discarder with 'stackSecondOfPair') MUST go next.
  if (lastPlayerIdWhoResolved && G.players[lastPlayerIdWhoResolved] && lastResolvedCardInfo) {
    // We need to find the original pendingSpecialAbility of the player who just resolved to check its source and pairTargetId
    // However, G.players[lastPlayerIdWhoResolved].pendingSpecialAbility is already cleared by handleResolveSpecialAbility.
    // We need the *original* source and pairTargetId. 
    // Let's assume handleResolveSpecialAbility stored the *source* of the just-resolved ability, not just the card.
    // Modify handleResolveSpecialAbility to store G.lastResolvedAbilitySource = abilitySource;
    // For now, let's add a G.lastResolvedAbilityDetails { source: string, pairTargetId?: string} instead of just card.
    // Or, more simply, G.players[playerID].lastResolvedAbilityDetails = { card, source, pairTargetId } after clearing pendingSpecialAbility.

    // Simpler approach for now: We stored G.lastPlayerToResolveAbility.
    // Let's assume the corresponding G.players[G.lastPlayerToResolveAbility] had its ability cleared,
    // but if its source WAS 'stack', we need its pairTargetId.
    // The information (pairTargetId) was part of the pendingSpecialAbility that was just cleared.
    // This means G.lastResolvedAbilityCardForCleanup might not be enough. We need the pairTargetId from the *cleared* ability.
    // Let's re-evaluate: handleResolveSpecialAbility clears pendingSpecialAbility *after* calling setupAbilityResolutionPhase indirectly.
    // No, handleResolveSpecialAbility clears it, THEN calls setupAbilityResolutionPhase.

    // Let's make `G.lastResolvedAbilityDetails` store `{ source: AbilitySource, pairTargetId?: string }`
    // This would be set in `handleResolveSpecialAbility` before clearing `player.pendingSpecialAbility`.
    // For now, I will proceed assuming G.lastResolvedAbilitySource is correctly set by handleResolveSpecialAbility
    // (will need to ensure that edit happens if it hasn't already)
    
    // The original game overview mentioned G.lastResolvedAbilitySource. Let's stick to that pattern.
    // `handleResolveSpecialAbility` must set `G.lastResolvedAbilitySource` to `abilitySource`.
    // And if source was 'stack', the `pairTargetId` of that cleared ability is key.

    // To implement LIFO cleanly, when an ability (esp. 'stack') resolves,
    // `handleResolveSpecialAbility` should pass the `pairTargetId` to `setupAbilityResolutionPhase` if the source was `'stack'`.
    // Or, `setupAbilityResolutionPhase` itself needs to find the player who *had* the `stackSecondOfPair` pointing to the one who just resolved.

    // Let's refine `handleResolveSpecialAbility` to set `G.lastResolvedAbilityDetails: { source: string, originalPlayerIdIfStack: string | null }`
    // No, this is getting complicated. The `GAME_OVERVIEW.md` says:
    // "`G.lastResolvedAbilitySource` tracks whose ability (matcher's `'stack'` or original discarder's `'stackSecondOfPair'`) just resolved.
    // `abilityResolutionStage.onEnd` uses this to determine if the other part of a LIFO pair still needs to resolve.
    // If the matcher's (`'stack'`) ability resolved, it sets up for the original discarder's (`'stackSecondOfPair'`) turn."

    // So, if G.lastResolvedAbilitySource === 'stack', we need to find the player whose pendingSpecialAbility is 'stackSecondOfPair'
    // AND their pairTargetId points to G.lastPlayerToResolveAbility.

    // To implement LIFO cleanly, when an ability (esp. 'stack') resolves,
    // `handleResolveSpecialAbility` should pass the `pairTargetId` to `setupAbilityResolutionPhase` if the source was `'stack'`.
    // Or, `setupAbilityResolutionPhase` itself needs to find the player who *had* the `stackSecondOfPair` pointing to the one who just resolved.

    // Let's refine `handleResolveSpecialAbility` to set `G.lastResolvedAbilityDetails: { source: string, originalPlayerIdIfStack: string | null }`
    // No, this is getting complicated. The `GAME_OVERVIEW.md` says:
    // "`G.lastResolvedAbilitySource` tracks whose ability (matcher's `'stack'` or original discarder's `'stackSecondOfPair'`) just resolved.
    // `abilityResolutionStage.onEnd` uses this to determine if the other part of a LIFO pair still needs to resolve.
    // If the matcher's (`'stack'`) ability resolved, it sets up for the original discarder's (`'stackSecondOfPair'`) turn."

    // So, if G.lastResolvedAbilitySource === 'stack', we need to find the player whose pendingSpecialAbility is 'stackSecondOfPair'
    // AND their pairTargetId points to G.lastPlayerToResolveAbility.

    if (G.lastResolvedAbilitySource === 'stack' && lastPlayerIdWhoResolved) {
        for (const pId of G.turnOrder) {
            const playerState = G.players[pId];
            if (playerState?.pendingSpecialAbility?.source === 'stackSecondOfPair' && 
                playerState.pendingSpecialAbility.pairTargetId === lastPlayerIdWhoResolved) {
                playerWithAbilityId = pId;
                break; 
            }
        }
    }
  }

  // If LIFO didn't dictate the next player, find by priority
  if (!playerWithAbilityId) {
    const prioritySources: Array<'stack' | 'stackSecondOfPair' | 'discard'> = ['stack', 'stackSecondOfPair', 'discard'];
    foundPlayer: 
    for (const source of prioritySources) {
      for (const pId of G.turnOrder) { 
        const playerState = G.players[pId];
        if (playerState?.pendingSpecialAbility?.source === source) { 
          // Ensure this player isn't the one whose 'stackSecondOfPair' was just skipped because the LIFO check above failed
          // or ensure that if a 'stack' was just resolved, we are not picking another 'stack' unless it's the LIFO target.
          // The LIFO check above should handle the primary `stack` -> `stackSecondOfPair` case.
          // This general loop should pick up any other pending abilities.
          playerWithAbilityId = pId;
          break foundPlayer;
        }
      }
    }
  }

  if (playerWithAbilityId) {
    G.currentPlayerId = playerWithAbilityId;
    G.activePlayers = { [playerWithAbilityId]: 'abilityResolutionActive' };
    const pendingAbility = G.players[playerWithAbilityId]?.pendingSpecialAbility;
    console.log(`[GameManager] game ${gameId} entered/continued abilityResolutionStage. Player ${playerWithAbilityId} to resolve ${pendingAbility?.card.rank} ability (source: ${pendingAbility?.source}).`);
  } else {
    console.log(`[GameManager] game ${gameId} abilityResolutionStage: No (further) abilities to resolve.`);
    G.lastPlayerToResolveAbility = null; 
    G.lastResolvedAbilitySource = null; 
    G.lastResolvedAbilityCardForCleanup = null;

    if (G.playerWhoCalledCheck) {
      // A check is active. Determine if we start/continue final turns or go to scoring.
      if (G.currentPhase === 'finalTurnsPhase') {
        // Abilities resolved during a final turn. Continue the final turns sequence.
        console.log(`[GameManager] game ${gameId} abilities resolved during finalTurnsPhase. Calling continueOrEndFinalTurns.`);
        return continueOrEndFinalTurns(gameId);
      } else {
        // Abilities resolved, and a check was called, but final turns haven't started for the next sequence.
        // (e.g. auto-check from match, then abilities, now start final turns properly)
        console.log(`[GameManager] game ${gameId} abilities resolved, check is active. Setting up finalTurnsPhase.`);
        return setupFinalTurnsPhase(gameId, G.playerWhoCalledCheck);
      }
    } else {
      // No check active, no more abilities, proceed to normal play turn.
      return setupNextPlayTurn(gameId);
    }
  }
  activeGames[gameId] = gameRoom;
  return G;
};

const continueOrEndFinalTurns = (gameId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) { console.error(`[GameManager] continueOrEndFinalTurns: Game room ${gameId} not found.`); return null; }
  const G = gameRoom.gameState;

  if (!G.playerWhoCalledCheck) {
    console.error(`[GameManager] continueOrEndFinalTurns: Called for game ${gameId} but no player has called Check.`);
    // This is an unexpected state, perhaps fall back to normal play turn determination
    return setupNextPlayTurn(gameId); 
  }

  // The player whose turn just ended (if any) has taken their final turn.
  // G.finalTurnsTaken should be incremented *before* calling this, or at the start here if this is the sole point of progression.
  // Let's assume it's incremented *at the start* of this function representing the completion of the *previous* player's final turn.
  G.finalTurnsTaken++;
  console.log(`[GameManager] game ${gameId} final turn taken by previous player. Total final turns: ${G.finalTurnsTaken}`);

  const eligibleFinalTurnPlayersCount = G.turnOrder.filter(pId => 
    pId !== G.playerWhoCalledCheck && 
    G.players[pId] && 
    !G.players[pId].isLocked
  ).length;

  if (G.finalTurnsTaken >= eligibleFinalTurnPlayersCount) {
    console.log(`[GameManager] game ${gameId}: All ${G.finalTurnsTaken}/${eligibleFinalTurnPlayersCount} final turns complete. Proceeding to scoring.`);
    return setupScoringPhase(gameId);
  } else {
    console.log(`[GameManager] game ${gameId}: ${G.finalTurnsTaken}/${eligibleFinalTurnPlayersCount} final turns taken. Finding next player.`);
    let nextPlayerId = "";
    let currentPlayerIndexInTurnOrder = G.turnOrder.indexOf(G.currentPlayerId); // Player who just finished their turn
    if (currentPlayerIndexInTurnOrder === -1 && G.turnOrder.length > 0) {
        // Should not happen if currentPlayerId was valid, but as a fallback start from checker
        currentPlayerIndexInTurnOrder = G.turnOrder.indexOf(G.playerWhoCalledCheck);
    }

    let attempts = 0;
    let foundNextPlayer = false;

    if (G.turnOrder.length > 0) {
        let nextIndex = currentPlayerIndexInTurnOrder;
        do {
            nextIndex = (nextIndex + 1) % G.turnOrder.length;
            const potentialNextPlayerId = G.turnOrder[nextIndex];
            if (potentialNextPlayerId !== G.playerWhoCalledCheck && G.players[potentialNextPlayerId] && !G.players[potentialNextPlayerId].isLocked) {
                nextPlayerId = potentialNextPlayerId;
                foundNextPlayer = true;
                break;
            }
            attempts++;
        } while (attempts < G.turnOrder.length); // Iterate once through all players max
    }

    if (foundNextPlayer) {
      G.currentPlayerId = nextPlayerId;
      G.activePlayers = { [nextPlayerId]: 'finalTurnActive' };
      G.discardPileIsSealed = false; 
      G.currentPhase = 'finalTurnsPhase'; // Ensure phase remains correctly set
      console.log(`[GameManager] game ${gameId}: Next player for final turn is ${G.currentPlayerId}.`);
    } else {
      // Should ideally not be reached if finalTurnsTaken < eligibleFinalTurnPlayersCount
      console.warn(`[GameManager] game ${gameId}: No next eligible player found for final turn, but not all turns taken. Check logic. Forcing scoring.`);
      return setupScoringPhase(gameId);
    }
  }
  activeGames[gameId] = gameRoom;
  return G;
};

const setupScoringPhase = (gameId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) { console.error(`[GameManager] setupScoringPhase: Game room ${gameId} not found.`); return null; }
  const G = gameRoom.gameState;

  G.currentPhase = 'scoringPhase';
  G.activePlayers = {}; // No active players typically in scoring phase
  G.currentPlayerId = ""; // No specific current player
  // G.matchingOpportunityInfo = null; // Ensure this is cleared if not already
  // G.playerWhoCalledCheck = null; // Reset for next round potential
  // G.finalTurnsTaken = 0; // Reset
  // G.discardPileIsSealed = false; // Reset

  let roundWinnerID: string | null = null;
  let lowestScore = Infinity;

  for (const playerID in G.players) {
    const player = G.players[playerID];
    let currentHandScore = 0;
    player.hand.forEach(card => { 
        currentHandScore += cardValues[card.rank]; 
    });
    player.score = currentHandScore; // Set player's score for the round
    
    if (player.score < lowestScore) {
      lowestScore = player.score;
      roundWinnerID = playerID;
    } else if (player.score === lowestScore) {
      // Handle ties in winner string
      roundWinnerID = roundWinnerID ? `${roundWinnerID}, ${playerID}` : playerID; 
    }
  }
  G.roundWinner = roundWinnerID;
  
  // Example: Set a simple gameover object. This might be more complex depending on multi-round logic.
  // G.gameover = { 
  //   winner: G.roundWinner, 
  //   scores: Object.fromEntries(Object.entries(G.players).map(([pid, pState]) => [pid, pState.score]))
  // };

  console.log(`[GameManager] game ${gameId} entered scoringPhase. Winner(s): ${G.roundWinner}. Scores:`, 
    JSON.stringify(Object.fromEntries(Object.entries(G.players).map(([pid, pState]) => [pid, pState.score])))
  );
  
  // TODO: Logic for what happens after scoring: 
  // - Start a new round (reset player hands, deck, pending states, phase to initialPeek or play)?
  // - Or truly end the game if it's single-round or max rounds reached?
  // For now, it just sits in scoringPhase.

  activeGames[gameId] = gameRoom;
  return G;
};

export interface AbilityArgs {
  peekTargets?: Array<{ playerID: string; cardIndex: number }>; // For King/Queen
  swapA?: { playerID: string; cardIndex: number };
  swapB?: { playerID: string; cardIndex: number };
}

export const handleResolveSpecialAbility = (
  gameId: string,
  playerId: string,
  abilityArgs?: AbilityArgs
): { success: boolean; message?: string; updatedGameState?: ServerCheckGameState } => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return { success: false, message: "Game not found." };
  const G = gameRoom.gameState;
  const player = G.players[playerId];

  if (!player) return { success: false, message: "Player not found." };
  if (G.currentPhase !== 'abilityResolutionStage') return { success: false, message: "Not in ability resolution stage." };
  if (G.currentPlayerId !== playerId) return { success: false, message: "Not your turn to resolve ability." };
  if (!player.pendingSpecialAbility) return { success: false, message: "No pending special ability to resolve." };

  const { card: abilityCard, source: abilitySource } = player.pendingSpecialAbility;
  let abilityPerformed = false;
  let message = "Ability resolved.";

  if (player.isLocked) {
    console.log(`[GameManager] Player ${playerId} is locked. Ability ${abilityCard.rank} from source ${abilitySource} fizzles in game ${gameId}.`);
    message = `Ability ${abilityCard.rank} fizzled as player is locked.`;
    // Ability still counts as "resolved" for LIFO purposes
  } else {
    // Perform ability based on card rank
    switch (abilityCard.rank) {
      case Rank.King:
        if (abilityArgs?.swapA && abilityArgs?.swapB && 
            typeof abilityArgs.swapA.playerID === 'string' && typeof abilityArgs.swapA.cardIndex === 'number' &&
            typeof abilityArgs.swapB.playerID === 'string' && typeof abilityArgs.swapB.cardIndex === 'number') {
          const playerA = G.players[abilityArgs.swapA.playerID];
          const playerB = G.players[abilityArgs.swapB.playerID];
          if (playerA && playerA.hand[abilityArgs.swapA.cardIndex] && playerB && playerB.hand[abilityArgs.swapB.cardIndex]) {
            const cardFromA = playerA.hand[abilityArgs.swapA.cardIndex];
            playerA.hand[abilityArgs.swapA.cardIndex] = playerB.hand[abilityArgs.swapB.cardIndex];
            playerB.hand[abilityArgs.swapB.cardIndex] = cardFromA;
            abilityPerformed = true;
            message = `King ability: Swapped card at ${abilityArgs.swapA.playerID}[${abilityArgs.swapA.cardIndex}] with ${abilityArgs.swapB.playerID}[${abilityArgs.swapB.cardIndex}].`;
            console.log(`[GameManager] Player ${playerId} resolved King ability in game ${gameId}. ${message}`);
          } else {
            message = "King ability: Invalid swap targets or cards not found.";
          }
        } else {
          message = "King ability: Invalid arguments for swap.";
        }
        break;
      case Rank.Queen:
        if (abilityArgs?.swapA && abilityArgs?.swapB && 
            typeof abilityArgs.swapA.playerID === 'string' && typeof abilityArgs.swapA.cardIndex === 'number' &&
            typeof abilityArgs.swapB.playerID === 'string' && typeof abilityArgs.swapB.cardIndex === 'number') {
          const playerA = G.players[abilityArgs.swapA.playerID];
          const playerB = G.players[abilityArgs.swapB.playerID];
          if (playerA && playerA.hand[abilityArgs.swapA.cardIndex] && playerB && playerB.hand[abilityArgs.swapB.cardIndex]) {
            const cardFromA = playerA.hand[abilityArgs.swapA.cardIndex];
            playerA.hand[abilityArgs.swapA.cardIndex] = playerB.hand[abilityArgs.swapB.cardIndex];
            playerB.hand[abilityArgs.swapB.cardIndex] = cardFromA;
            abilityPerformed = true;
            message = `Queen ability: Swapped card at ${abilityArgs.swapA.playerID}[${abilityArgs.swapA.cardIndex}] with ${abilityArgs.swapB.playerID}[${abilityArgs.swapB.cardIndex}].`;
            console.log(`[GameManager] Player ${playerId} resolved Queen ability in game ${gameId}. ${message}`);
          } else {
            message = "Queen ability: Invalid swap targets or cards not found.";
          }
        } else {
          message = "Queen ability: Invalid arguments for swap.";
        }
        break;
      case Rank.Jack:
        if (abilityArgs?.swapA && abilityArgs?.swapB && 
            typeof abilityArgs.swapA.playerID === 'string' && typeof abilityArgs.swapA.cardIndex === 'number' &&
            typeof abilityArgs.swapB.playerID === 'string' && typeof abilityArgs.swapB.cardIndex === 'number') {
          const playerA = G.players[abilityArgs.swapA.playerID];
          const playerB = G.players[abilityArgs.swapB.playerID];
          if (playerA && playerA.hand[abilityArgs.swapA.cardIndex] && playerB && playerB.hand[abilityArgs.swapB.cardIndex]) {
            const cardFromA = playerA.hand[abilityArgs.swapA.cardIndex];
            playerA.hand[abilityArgs.swapA.cardIndex] = playerB.hand[abilityArgs.swapB.cardIndex];
            playerB.hand[abilityArgs.swapB.cardIndex] = cardFromA;
            abilityPerformed = true;
            message = `Jack ability: Swapped card at ${abilityArgs.swapA.playerID}[${abilityArgs.swapA.cardIndex}] with ${abilityArgs.swapB.playerID}[${abilityArgs.swapB.cardIndex}].`;
            console.log(`[GameManager] Player ${playerId} resolved Jack ability in game ${gameId}. ${message}`);
          } else {
            message = "Jack ability: Invalid swap targets or cards not found.";
          }
        } else {
          message = "Jack ability: Invalid arguments for swap.";
        }
        break;
      default:
        message = `No action defined for resolving ${abilityCard.rank} ability.`;
        console.warn(`[GameManager] Player ${playerId} tried to resolve unhandled ability ${abilityCard.rank} in game ${gameId}.`);
        break;
    }
  }

  G.lastPlayerToResolveAbility = playerId; // Track who just resolved for LIFO in setupAbilityResolutionPhase
  G.lastResolvedAbilitySource = abilitySource; // Ensure the source of the resolved ability is stored
  G.lastResolvedAbilityCardForCleanup = abilityCard; // Store the card that was resolved, might be useful
  player.pendingSpecialAbility = null; // Clear the ability from the player

  // Setup the next step: either another ability resolution or a new game phase
  setupAbilityResolutionPhase(gameId);
  
  activeGames[gameId] = gameRoom; // G is modified by setupAbilityResolutionPhase
  return { success: true, message, updatedGameState: G };
};

export const handleDeclareReadyForPeek = (
  gameId: string,
  playerId: string
): { success: boolean; message?: string; updatedGameState?: ServerCheckGameState } => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return { success: false, message: "Game not found." };
  const G = gameRoom.gameState;
  const player = G.players[playerId];

  if (!player) return { success: false, message: "Player not found." };
  if (G.currentPhase !== 'initialPeekPhase') return { success: false, message: "Not in initial peek phase." };
  if (!G.activePlayers[playerId] || G.activePlayers[playerId] !== 'awaitingReadiness') {
    return { success: false, message: "Player not in awaitingReadiness stage or already declared ready." };
  }

  player.isReadyForInitialPeek = true;
  G.activePlayers[playerId] = 'readyForPeek'; // Update player's stage
  console.log(`[GameManager] Player ${playerId} declared ready for peek in game ${gameId}.`);

  // Check if all players are ready
  let allPlayersReady = true;
  for (const pId of G.turnOrder) {
    if (!G.players[pId].isReadyForInitialPeek) {
      allPlayersReady = false;
      break;
    }
  }

  if (allPlayersReady) {
    console.log(`[GameManager] All players ready for peek in game ${gameId}. Setting timestamp and reveal stage.`);
    G.initialPeekAllReadyTimestamp = Date.now();
    // Transition all players to a revealing stage. Client will handle timed display.
    for (const pId of G.turnOrder) {
      G.activePlayers[pId] = 'revealingCardsStage';
    }
    // currentPlayerId doesn't really matter here as it's a simultaneous reveal handled by clients
  }
  
  activeGames[gameId] = gameRoom;
  return { success: true, updatedGameState: G };
};

export const handleAcknowledgePeek = (
  gameId: string,
  playerId: string
): { success: boolean; message?: string; updatedGameState?: ServerCheckGameState } => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return { success: false, message: "Game not found." };
  const G = gameRoom.gameState;
  const player = G.players[playerId];

  if (!player) return { success: false, message: "Player not found." };
  if (G.currentPhase !== 'initialPeekPhase') return { success: false, message: "Not in initial peek phase." };
  // Player should be in revealingCardsStage or have completed peek if re-sending
  if (!G.activePlayers[playerId] || G.activePlayers[playerId] !== 'revealingCardsStage') {
     if(player.hasCompletedInitialPeek) {
        // Already completed, perhaps a resend of ack. Allow, but don't re-process logic if all others also done.
     } else {
        return { success: false, message: "Player not in revealingCardsStage." };
     }
  }

  player.hasCompletedInitialPeek = true;
  if (G.activePlayers[playerId] === 'revealingCardsStage') { // Only change stage if they were actively revealing
      G.activePlayers[playerId] = 'peekCompleted';
  }
  console.log(`[GameManager] Player ${playerId} acknowledged peek in game ${gameId}.`);

  // Check if all players have completed peek
  let allPlayersCompletedPeek = true;
  for (const pId of G.turnOrder) {
    if (!G.players[pId].hasCompletedInitialPeek) {
      allPlayersCompletedPeek = false;
      break;
    }
  }

  if (allPlayersCompletedPeek) {
    console.log(`[GameManager] All players completed peek in game ${gameId}. Transitioning to playPhase.`);
    // Clear initialPeekAllReadyTimestamp as it's no longer needed for this round
    G.initialPeekAllReadyTimestamp = null;
    // All players are no longer in any specific active stage of initialPeekPhase
    // G.activePlayers = {}; // setupNextPlayTurn will set the active player for playPhase
    setupNextPlayTurn(gameId); // This will set currentPhase to 'playPhase' and the correct currentPlayerId & activePlayers
  }
  
  activeGames[gameId] = gameRoom;
  return { success: true, updatedGameState: G };
};

export const generatePlayerView = (
  fullGameState: ServerCheckGameState,
  viewingPlayerId: string
): ClientCheckGameState => {
  const clientPlayers: { [playerID: string]: ClientPlayerState } = {};

  for (const pId in fullGameState.players) {
    const serverPlayerState = fullGameState.players[pId];
    let clientHand: ClientCard[];
    let clientPendingDrawnCard: ClientCard | null = null;

    if (pId === viewingPlayerId) {
      clientHand = serverPlayerState.hand.map(card => ({ ...card })); // Own hand is visible
      if (serverPlayerState.pendingDrawnCard) {
        clientPendingDrawnCard = { ...serverPlayerState.pendingDrawnCard };
      }
    } else {
      // Other players' hands are hidden, show card count via hidden cards
      clientHand = serverPlayerState.hand.map((_, index) => ({
        isHidden: true,
        id: `hidden-${pId}-${index}`,
      }));
      // Others' pendingDrawnCard is also hidden
      if (serverPlayerState.pendingDrawnCard) {
        clientPendingDrawnCard = { isHidden: true, id: `hidden-pending-${pId}` };
      }
    }

    clientPlayers[pId] = {
      // Copy non-sensitive fields from PlayerState
      hand: clientHand,
      hasUsedInitialPeek: serverPlayerState.hasUsedInitialPeek,
      isReadyForInitialPeek: serverPlayerState.isReadyForInitialPeek,
      hasCompletedInitialPeek: serverPlayerState.hasCompletedInitialPeek,
      pendingDrawnCard: clientPendingDrawnCard,
      pendingDrawnCardSource: (pId === viewingPlayerId || serverPlayerState.pendingDrawnCardSource === null) 
                              ? serverPlayerState.pendingDrawnCardSource 
                              : null, // Hide source if not viewer and card is pending elsewhere
      pendingSpecialAbility: serverPlayerState.pendingSpecialAbility, // Or a redacted version
      hasCalledCheck: serverPlayerState.hasCalledCheck,
      isLocked: serverPlayerState.isLocked,
      score: serverPlayerState.score,
    };
  }

  const clientGameState: ClientCheckGameState = {
    // Copy non-sensitive fields from CheckGameState
    deckSize: fullGameState.deck.length,
    players: clientPlayers,
    discardPile: fullGameState.discardPile.map(card => ({ ...card })), // Public
    discardPileIsSealed: fullGameState.discardPileIsSealed,
    matchingOpportunityInfo: fullGameState.matchingOpportunityInfo
      ? { ...fullGameState.matchingOpportunityInfo, cardToMatch: { ...fullGameState.matchingOpportunityInfo.cardToMatch } }
      : null,
    playerWhoCalledCheck: fullGameState.playerWhoCalledCheck,
    roundWinner: fullGameState.roundWinner,
    finalTurnsTaken: fullGameState.finalTurnsTaken,
    lastResolvedAbilitySource: fullGameState.lastResolvedAbilitySource,
    initialPeekAllReadyTimestamp: fullGameState.initialPeekAllReadyTimestamp,
    // Omitted: lastPlayerToResolveAbility, lastResolvedAbilityCardForCleanup (as per ClientCheckGameState definition)
    currentPhase: fullGameState.currentPhase,
    currentPlayerId: fullGameState.currentPlayerId,
    turnOrder: fullGameState.turnOrder, // Public
    gameMasterId: fullGameState.gameMasterId,
    activePlayers: fullGameState.activePlayers, // Public
    matchResolvedDetails: fullGameState.matchResolvedDetails ? { ...fullGameState.matchResolvedDetails } : null,
    viewingPlayerId: viewingPlayerId,
  };

  return clientGameState;
};

// We will add more functions here:
// - updateGameState(gameId, newPartialState)
// - handlePlayerAction(gameId, playerId, actionType, actionPayload) -> which calls move logic
// - manage player connections to rooms (joining, leaving)

// Placeholder for playerSetupData, this should align with what the client sends when creating/joining a game.
// We'll need to define how players are identified (e.g. socket.id, or a persistent user ID if you have auth)
// For now, this is a minimal structure.
// export interface PlayerSetupInfo {
//   id: string; // e.g., socket.id or a user-chosen ID if unique
//   name?: string;
// } 