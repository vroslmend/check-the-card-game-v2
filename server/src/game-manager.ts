import { Card, Suit, Rank, PlayerState, CheckGameState as ServerCheckGameState, InitialPlayerSetupData, cardValues, HiddenCard, ClientCard, ClientPlayerState, ClientCheckGameState, SpecialAbilityInfo, PendingSpecialAbility } from 'shared-types';

const PEEK_COUNTDOWN_SECONDS = 5; // Define based on typical client value or make configurable
const PEEK_REVEAL_SECONDS = 5;    // Define based on typical client value or make configurable
const PEEK_TOTAL_DURATION_MS = 10 * 1000; // Simplified to 10 seconds total for server timer. Client handles its own countdown visuals.

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

// This is a placeholder for how game-manager would trigger a broadcast
// In reality, `io` would be passed or a more robust event system used.
// Encapsulated within an object to allow GameRoom methods to access it if they were class methods.
const broadcastService = {
    triggerBroadcast: (gameId: string, gameState: ServerCheckGameState) => {
        console.warn("[GameManager] broadcastService.triggerBroadcast called but not implemented. This should be set by index.ts");
    }
};

export const setTriggerBroadcastFunction = (fn: (gameId: string, gameState: ServerCheckGameState) => void) => {
    broadcastService.triggerBroadcast = fn;
    console.log("[GameManager] triggerBroadcast function has been set.");
};

// Define an explicit return type for handleDeclareReadyForPeek
interface HandlePeekResult {
  success: boolean;
  message?: string;
  updatedGameState?: ServerCheckGameState;
  peekJustStarted?: boolean; 
}

// Function to initialize a new game - adapting from boardgame.io's setup
// We'll need numPlayers and playerSetupData (e.g., their self-assigned IDs or we assign them)
export const initializeNewGame = (gameId: string, playerSetupData: InitialPlayerSetupData[]): GameRoom | null => {
  const numPlayers = playerSetupData.length;
  if (numPlayers < 1 || numPlayers > 4) { // Changed from < 2 to < 1 to allow 1 player to create
    console.error(`[GameManager] Invalid number of players: ${numPlayers} for game ${gameId}`);
    return null; // Ensure null is returned if invalid number of players
  }

  const deck = createDeck();
  const shuffledDeck = simpleShuffle(deck);

  const initialPlayers: { [playerID: string]: PlayerState } = {};
  playerSetupData.forEach((playerInfo) => {
    const playerId = playerInfo.id;
    // Ensure socketId is provided in playerInfo for new game setup
    if (!playerInfo.socketId) {
        console.error(`[GameManager] socketId missing for player ${playerId} during game initialization.`);
        // Potentially throw error or handle as a critical setup failure
        // For now, we'll assign an empty string, but this is not ideal.
        playerInfo.socketId = `missing_socket_${Math.random().toString(36).substring(2,7)}`;
    }
    initialPlayers[playerId] = {
      hand: shuffledDeck.splice(0, 4),
      hasUsedInitialPeek: false,
      isReadyForInitialPeek: false,
      hasCompletedInitialPeek: false,
      cardsToPeek: null, // Initialize cardsToPeek
      peekAcknowledgeDeadline: null, // Initialize peekAcknowledgeDeadline
      pendingDrawnCard: null,
      pendingDrawnCardSource: null,
      pendingSpecialAbility: null,
      hasCalledCheck: false,
      isLocked: false,
      score: 0,
      name: playerInfo.name,
      isConnected: true, // New: Player starts as connected
      socketId: playerInfo.socketId, // New: Store socket ID, ensure playerInfo provides it
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
    pendingAbilities: [], // Initialize pendingAbilities
    gameover: null, // Initialize gameover
    currentPhase: 'initialPeekPhase',
    currentPlayerId: playerSetupData[0].id, 
    turnOrder: playerSetupData.map(p => p.id),
    gameMasterId: playerSetupData[0].id,
    activePlayers: playerSetupData.reduce((acc, p) => {
      acc[p.id] = 'awaitingReadiness';
      return acc;
    }, {} as { [playerID: string]: string }),
  };

  const newGameRoom: GameRoom = {
    gameId,
    players: initialPlayers, 
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
  playerInfo: InitialPlayerSetupData,
  socketId: string
): { success: boolean; message?: string; gameRoom?: GameRoom, newPlayerState?: PlayerState } => {
  const gameRoom = getGameRoom(gameId);

  if (!gameRoom) {
    return { success: false, message: "Game not found." };
  }

  if (gameRoom.gameState.players[playerInfo.id]) {
    console.warn(`[GameManager] Player ID ${playerInfo.id} already exists in game ${gameId}.`);
    return { success: false, message: "Player ID already in use or player already in game." };
  }

  const currentNumPlayers = Object.keys(gameRoom.gameState.players).length;
  if (currentNumPlayers >= 4) { 
    return { success: false, message: "Game is full." };
  }

  // Deal 4 cards to the new player from the game deck
  const newPlayerHand: Card[] = [];
  if (gameRoom.gameState.deck.length >= 4) {
    for (let i = 0; i < 4; i++) {
      const card = gameRoom.gameState.deck.pop();
      if (card) {
        newPlayerHand.push(card);
      } else {
        // This should not happen if deck.length >= 4 check passed
        console.error(`[GameManager] Deck unexpectedly empty while dealing to player ${playerInfo.id} in game ${gameId}`);
        return { success: false, message: "Error dealing cards: deck empty mid-deal." };
      }
    }
  } else {
    console.error(`[GameManager] Not enough cards in deck to deal to new player ${playerInfo.id} in game ${gameId}. Deck size: ${gameRoom.gameState.deck.length}`);
    return { success: false, message: "Not enough cards in deck to deal to new player." };
  }

  const newPlayerState: PlayerState = {
    hand: newPlayerHand, 
    hasUsedInitialPeek: false,
    isReadyForInitialPeek: false,
    hasCompletedInitialPeek: false,
    cardsToPeek: null,
    peekAcknowledgeDeadline: null,
    pendingDrawnCard: null,
    pendingDrawnCardSource: null,
    pendingSpecialAbility: null,
    hasCalledCheck: false,
    isLocked: false,
    score: 0,
    name: playerInfo.name,
    isConnected: true,
    socketId: socketId,
  };

  gameRoom.gameState.players[playerInfo.id] = newPlayerState;
  gameRoom.gameState.turnOrder.push(playerInfo.id);
  
  activeGames[gameId] = gameRoom;

  console.log(`[GameManager] Player ${playerInfo.id} added to game ${gameId}. Total players: ${Object.keys(gameRoom.gameState.players).length}`);
  return { success: true, gameRoom, newPlayerState };
};

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

  if (player.pendingDrawnCard) {
    return { success: false, message: "Player already has a pending drawn card." };
  }
  if (player.pendingSpecialAbility) {
    return { success: false, message: "Player has a pending special ability to resolve." };
  }
  
  if (gameRoom.gameState.deck.length === 0) {
    return { success: false, message: "Deck is empty." };
  }

  const card = gameRoom.gameState.deck.pop(); 
  if (!card) {
    return { success: false, message: "Failed to draw card (deck might be unexpectedly empty)." };
  }

  player.pendingDrawnCard = card;
  player.pendingDrawnCardSource = 'deck';
  
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

  if (player.pendingDrawnCard) {
    return { success: false, message: "Player already has a pending drawn card." };
  }
  if (player.pendingSpecialAbility) {
    return { success: false, message: "Player has a pending special ability to resolve." };
  }
  
  if (gameRoom.gameState.discardPile.length === 0) {
    return { success: false, message: "Discard pile is empty." };
  }

  if (gameRoom.gameState.discardPileIsSealed) {
    return { success: false, message: "Discard pile is sealed." };
  }

  const topCard = gameRoom.gameState.discardPile[0];
  if (topCard && (topCard.rank === Rank.King || topCard.rank === Rank.Queen || topCard.rank === Rank.Jack)) {
    return { success: false, message: "Cannot draw special ability cards (K, Q, J) from the discard pile." };
  }

  const card = gameRoom.gameState.discardPile.shift();
  if (!card) {
    return { success: false, message: "Failed to draw card (discard pile might be unexpectedly empty)." };
  }

  player.pendingDrawnCard = card;
  player.pendingDrawnCardSource = 'discard';
  
  activeGames[gameId] = gameRoom; 

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

  const cardFromHand = player.hand.splice(handIndex, 1, player.pendingDrawnCard)[0];
  player.pendingDrawnCard = null;
  player.pendingDrawnCardSource = null;

  // Add the card from hand to the discard pile
  gameRoom.gameState.discardPile.unshift(cardFromHand);
  gameRoom.gameState.discardPileIsSealed = false;
  
  console.log(`[GameManager] Player ${playerId} swapped drawn card with hand[${handIndex}]. Discarded: ${cardFromHand.rank}${cardFromHand.suit}`);

  const potentialMatchers = Object.keys(gameRoom.gameState.players).filter(pId => {
    const p = gameRoom.gameState.players[pId];
    return p && !p.isLocked && !p.hasCalledCheck;
  });

  gameRoom.gameState.matchingOpportunityInfo = {
    cardToMatch: cardFromHand,
    originalPlayerID: playerId,
    potentialMatchers,
  };

  gameRoom.gameState.currentPhase = 'matchingStage';
  const newActivePlayers: { [playerID: string]: string } = {};
  potentialMatchers.forEach(pId => {
    newActivePlayers[pId] = 'awaitingMatchAction';
  });
  gameRoom.gameState.activePlayers = newActivePlayers;

  activeGames[gameId] = gameRoom;
  console.log(`[GameManager] Player ${playerId} swapped and discarded in ${gameId}. Card: ${cardFromHand.rank}${cardFromHand.suit}. Phase -> matchingStage. Active matchers: ${Object.keys(newActivePlayers).join(', ')}`);
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
  // Rule: can only discard a card drawn from deck. If drawn from discard, must swap or use for ability.
  if (player.pendingDrawnCardSource !== 'deck') return { success: false, message: "Cannot discard card not drawn from deck." };

  const drawnCard = player.pendingDrawnCard;
  player.pendingDrawnCard = null;
  player.pendingDrawnCardSource = null;
  gameRoom.gameState.discardPile.unshift(drawnCard);
  gameRoom.gameState.discardPileIsSealed = false;
  
  console.log(`[GameManager] Player ${playerId} discarded drawn card: ${drawnCard.rank}${drawnCard.suit}`);

  const potentialMatchers = Object.keys(gameRoom.gameState.players).filter(pId => {
    const p = gameRoom.gameState.players[pId];
    return p && !p.isLocked && !p.hasCalledCheck;
  });
  
  gameRoom.gameState.matchingOpportunityInfo = {
    cardToMatch: drawnCard,
    originalPlayerID: playerId,
    potentialMatchers,
  };

  gameRoom.gameState.currentPhase = 'matchingStage';
  const newActivePlayers: { [playerID: string]: string } = {};
  potentialMatchers.forEach(pId => {
    newActivePlayers[pId] = 'awaitingMatchAction';
  });
  gameRoom.gameState.activePlayers = newActivePlayers;

  activeGames[gameId] = gameRoom;
  console.log(`[GameManager] Player ${playerId} discarded drawn card in ${gameId}. Card: ${drawnCard.rank}${drawnCard.suit}. Phase -> matchingStage. Active matchers: ${Object.keys(newActivePlayers).join(', ')}`);
  return { success: true, updatedGameState: gameRoom.gameState };
};

export const handleAttemptMatch = (
  gameId: string,
  playerId: string,
  handIndex: number
): { success: boolean; message?: string; updatedGameState?: ServerCheckGameState } => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return { success: false, message: "Game not found." };

  const G = gameRoom.gameState; 
  const player = G.players[playerId];

  if (!player) return { success: false, message: "Player not found." };
  if (handIndex < 0 || handIndex >= player.hand.length) return { success: false, message: "Invalid hand index." };
  
  if (G.currentPhase !== 'matchingStage') return { success: false, message: "Not in matching stage." };
  if (!G.activePlayers || !G.activePlayers[playerId]) return { success: false, message: "Player not active for matching." };

  const { cardToMatch, originalPlayerID, potentialMatchers } = G.matchingOpportunityInfo || {};
  if (!cardToMatch || !originalPlayerID || !potentialMatchers) return { success: false, message: "No matching opportunity active or missing details." };
  
  if (!potentialMatchers.includes(playerId)) return { success: false, message: "Player not eligible to match this opportunity." };

  const cardY = player.hand[handIndex]; 
  const cardX = cardToMatch; 

  console.log(`[GameManager] handleAttemptMatch: Player ${playerId} attempting to match.`);
  console.log(`[GameManager] Card from Hand (cardY at index ${handIndex}): ${cardY ? cardY.rank + cardY.suit : 'undefined'}`);
  console.log(`[GameManager] Card to Match (cardX from discard): ${cardX ? cardX.rank + cardX.suit : 'undefined'}`);

  if (cardY.rank === cardX.rank) {
    player.hand.splice(handIndex, 1); 
    G.discardPile.unshift(cardY); 
    G.discardPileIsSealed = true;
    
    let abilityResolutionRequired = false;
    const isCardXSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(cardX.rank);
    const isCardYSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(cardY.rank);

    if (isCardXSpecial && isCardYSpecial) {
      let stageForCardY: 'peek' | 'swap' | undefined = undefined;
      let stageForCardX: 'peek' | 'swap' | undefined = undefined;

      if (G.players[playerId]) {
        G.pendingAbilities = G.pendingAbilities || [];
        if (cardY.rank === Rank.King || cardY.rank === Rank.Queen) stageForCardY = 'peek';
        else if (cardY.rank === Rank.Jack) stageForCardY = 'swap';
        G.pendingAbilities.push({ playerId: playerId, card: cardY, source: 'stack', pairTargetId: originalPlayerID, currentAbilityStage: stageForCardY });
      }
      if (G.players[originalPlayerID]) {
        G.pendingAbilities = G.pendingAbilities || [];
        if (cardX.rank === Rank.King || cardX.rank === Rank.Queen) stageForCardX = 'peek';
        else if (cardX.rank === Rank.Jack) stageForCardX = 'swap';
        G.pendingAbilities.push({ playerId: originalPlayerID, card: cardX, source: 'stackSecondOfPair', pairTargetId: playerId, currentAbilityStage: stageForCardX });
      }
      abilityResolutionRequired = true;
      console.log(`[GameManager] Special match pair: ${cardX.rank} & ${cardY.rank}. Abilities added for ${originalPlayerID} and ${playerId}. Stages: Y=${stageForCardY}, X=${stageForCardX}`);
    }

    let isAutoCheck = false;
    if (player.hand.length === 0) {
      player.hasCalledCheck = true;
      player.isLocked = true;
      if (!G.playerWhoCalledCheck) {
        G.playerWhoCalledCheck = playerId;
      G.finalTurnsTaken = 0; 
      }
      isAutoCheck = true;
      console.log(`[GameManager] Player ${playerId} emptied hand on match. Auto-Check!`);
    }

    G.matchResolvedDetails = {
      byPlayerId: playerId,
      isAutoCheck,
      abilityResolutionRequired,
    };
    
    const finalGameState = checkMatchingStageEnd(gameId);
    if (!finalGameState) return {success: false, message: "Error after attempting match (checkMatchingStageEnd failed processing match details)." };
    
    return { success: true, updatedGameState: finalGameState };

  } else {
    // Cards do not match. Player incurs a penalty and their attempt for this opportunity is over.
    console.log(`[GameManager] Player ${playerId} failed match attempt in game ${gameId}. Cards ${cardY.rank} and ${cardX.rank} do not match.`);
    
    // Penalty: Draw a card from the deck
    if (G.deck.length > 0) {
      const penaltyCard = G.deck.pop();
      if (penaltyCard) {
        player.hand.push(penaltyCard);
        console.log(`[GameManager] Player ${playerId} drew a penalty card: ${penaltyCard.rank}${penaltyCard.suit}. Hand size: ${player.hand.length}. Deck size: ${G.deck.length}`);
      } else {
        console.warn(`[GameManager] Penalty card draw failed for ${playerId} in game ${gameId} - deck pop returned undefined despite length > 0.`);
      }
    } else {
      console.warn(`[GameManager] Player ${playerId} should receive a penalty card in game ${gameId}, but deck is empty.`);
      // Potentially handle game-specific rules for empty deck penalties if any.
    }

    // Treat them as if they passed for this specific opportunity.
    if (G.activePlayers && G.activePlayers[playerId]) {
        delete G.activePlayers[playerId];
    }
    const updatedGameState = checkMatchingStageEnd(gameId);
    if (!updatedGameState) return {success: false, message: "Error processing after failed match attempt and penalty."}; 
    
    return { success: true, message: "The cards did not match. Penalty card drawn.", updatedGameState };
  }
};

const checkMatchingStageEnd = (gameId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return null;
  const G = gameRoom.gameState;

  if (G.matchResolvedDetails) {
    const { byPlayerId, isAutoCheck, abilityResolutionRequired } = G.matchResolvedDetails;
    console.log(`[GameManager] checkMatchingStageEnd: Processing resolved match by ${byPlayerId} in game ${gameId}.`);

    G.matchingOpportunityInfo = null; 
    if (G.activePlayers[byPlayerId]) {
        delete G.activePlayers[byPlayerId]; 
    }
    
    const remainingActiveKeys = Object.keys(G.activePlayers);
    for (const pId of remainingActiveKeys) {
        if (G.activePlayers[pId] === 'awaitingMatchAction') {
            delete G.activePlayers[pId];
        }
    }

    G.matchResolvedDetails = null; 

    if (abilityResolutionRequired) {
      console.log("[GameManager] checkMatchingStageEnd (after match): Match resulted in abilities. Transitioning to abilityResolutionStage.");
      setupAbilityResolutionPhase(gameId);
    } else if (isAutoCheck) {
      console.log("[GameManager] checkMatchingStageEnd (after match): Match resulted in auto-check. Transitioning to finalTurnsPhase.");
      setupFinalTurnsPhase(gameId, byPlayerId);
    } else {
      // Match successful, no abilities/autocheck
      if (G.playerWhoCalledCheck) { // If final turns ARE active
        console.log(`[GameManager] checkMatchingStageEnd (after match in final turns): Match by ${byPlayerId} successful. Phase remains finalTurnsPhase. Player's final turn action complete.`);
        G.currentPhase = 'finalTurnsPhase'; // Explicitly ensure it stays finalTurnsPhase
        G.currentPlayerId = byPlayerId;   // Player who made the match
        // This player's "active" part of the turn is done. They don't get to do more actions.
        // The next call to setupNextPlayTurn/setupAbilityResolutionPhase from a higher level will trigger continueOrEndFinalTurns.
        G.activePlayers = {}; // Clear active players for this specific part.
      } else { // Final turns are NOT active
        console.log("[GameManager] checkMatchingStageEnd (after match, not in final turns): Match successful. Player's turn continues in playPhase.");
        G.currentPhase = 'playPhase';
        G.currentPlayerId = byPlayerId;
        G.activePlayers = { [byPlayerId]: 'playPhaseActive' };
      }
    }
    activeGames[gameId] = gameRoom; 
    return G;
  }

  const remainingActiveMatchers = G.activePlayers && 
                                Object.values(G.activePlayers).some(status => status === 'awaitingMatchAction');

  if (!remainingActiveMatchers && G.matchingOpportunityInfo) { 
    console.log(`[GameManager] checkMatchingStageEnd: All players passed or resolved for game ${gameId}. Ending matching stage.`);
    const { cardToMatch, originalPlayerID } = G.matchingOpportunityInfo;
    G.matchingOpportunityInfo = null;

    const originalDiscarder = G.players[originalPlayerID];
    const isOriginalDiscardSpecial = originalDiscarder && cardToMatch && [Rank.King, Rank.Queen, Rank.Jack].includes(cardToMatch.rank);
    
    if (isOriginalDiscardSpecial && !originalDiscarder.pendingSpecialAbility) {
      const hasOtherPending = G.pendingAbilities && G.pendingAbilities.some(ab => ab.playerId === originalPlayerID);
      if (!hasOtherPending) {
        console.log(`[GameManager] checkMatchingStageEnd (all passed): Original discarder ${originalPlayerID} has ${cardToMatch.rank} ability from discard.`);
        G.pendingAbilities = G.pendingAbilities || [];
        let stageForDiscardedCard: 'peek' | 'swap' | undefined = undefined;
        if (cardToMatch.rank === Rank.King || cardToMatch.rank === Rank.Queen) stageForDiscardedCard = 'peek';
        else if (cardToMatch.rank === Rank.Jack) stageForDiscardedCard = 'swap';
        G.pendingAbilities.push({ playerId: originalPlayerID, card: cardToMatch, source: 'discard', currentAbilityStage: stageForDiscardedCard });
        console.log(`[GameManager] Added discard ability for ${cardToMatch.rank} to ${originalPlayerID} with stage: ${stageForDiscardedCard}`);
        setupAbilityResolutionPhase(gameId);
      } else {
        console.log(`[GameManager] checkMatchingStageEnd (all passed): Original discarder ${originalPlayerID} already has other pending abilities. ${cardToMatch.rank} from discard not added.`);
        if (G.playerWhoCalledCheck) {
          console.log(`[GameManager] checkMatchingStageEnd (all passed, no new ability, check called): Restoring phase to finalTurnsPhase and proceeding.`);
          G.currentPhase = 'finalTurnsPhase'; // Ensure phase is correct before continuing final turns
          continueOrEndFinalTurns(gameId);
        } else {
        setupNextPlayTurn(gameId);
        }
      }
    } else {
      console.log(`[GameManager] checkMatchingStageEnd (all passed): No further abilities from discard.`);
      if (G.playerWhoCalledCheck) {
        console.log(`[GameManager] checkMatchingStageEnd (all passed, no ability, check called): Restoring phase to finalTurnsPhase and proceeding.`);
        G.currentPhase = 'finalTurnsPhase'; // Ensure phase is correct before continuing final turns
        continueOrEndFinalTurns(gameId);
      } else {
        console.log(`[GameManager] checkMatchingStageEnd (all passed, no ability, no check called): Returning to playPhase.`);
      setupNextPlayTurn(gameId);
      }
    }
    activeGames[gameId] = gameRoom;
    return G;
  }
  
  if (G.matchingOpportunityInfo && remainingActiveMatchers){
    console.log(`[GameManager] checkMatchingStageEnd: Matching stage continues for game ${gameId}. Active matchers present.`);
  }
  activeGames[gameId] = gameRoom; 
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
  delete G.activePlayers[playerId]; 

  const updatedGameState = checkMatchingStageEnd(gameId);
  if (!updatedGameState) return {success: false, message: "Error after passing."};
  
  activeGames[gameId] = gameRoom; 
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
  if (G.pendingAbilities && G.pendingAbilities.some(ab => ab.playerId === playerId)) {
    return { success: false, message: "Cannot call Check with a pending special ability." };
  }

  player.hasCalledCheck = true;
  player.isLocked = true;
  if (!G.playerWhoCalledCheck) {
    G.playerWhoCalledCheck = playerId;
  }
  G.finalTurnsTaken = 0;

  console.log(`[GameManager] Player ${playerId} called Check in game ${gameId}. Transitioning to finalTurnsPhase.`);
  
  setupFinalTurnsPhase(gameId, playerId); 

  activeGames[gameId] = gameRoom; 
  return { success: true, updatedGameState: G };
};


const setupNextPlayTurn = (gameId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) { console.error(`[GameManager] setupNextPlayTurn: Game room ${gameId} not found.`); return null; }
  const G = gameRoom.gameState;

  if (G.playerWhoCalledCheck && G.currentPhase === 'finalTurnsPhase') {
    console.log(`[GameManager] setupNextPlayTurn: In finalTurnsPhase for game ${gameId}. Calling continueOrEndFinalTurns.`);
    return continueOrEndFinalTurns(gameId);
  }

  if (G.playerWhoCalledCheck && G.currentPhase !== 'finalTurnsPhase') {
      console.warn(`[GameManager] setupNextPlayTurn: playerWhoCalledCheck is set for game ${gameId}, but not in finalTurnsPhase. Current phase: ${G.currentPhase}. This might indicate an issue if abilities didn't transition to setupFinalTurnsPhase correctly.`);
  }

  if (!G.turnOrder || G.turnOrder.length === 0) {
    console.error(`[GameManager] setupNextPlayTurn: No turn order for game ${gameId}`);
    G.currentPhase = 'error'; G.activePlayers = {}; G.currentPlayerId = "";
    activeGames[gameId] = gameRoom; return G;
  }

  let currentPlayerIndex = G.turnOrder.indexOf(G.currentPlayerId);
  if (currentPlayerIndex === -1) {
    console.warn(`[GameManager] setupNextPlayTurn: Current player ${G.currentPlayerId} not in turn order for game ${gameId}. Starting from first player.`);
    G.currentPlayerId = G.turnOrder[0];
    currentPlayerIndex = G.turnOrder.indexOf(G.currentPlayerId); 
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
    if (G.playerWhoCalledCheck) { 
        return setupScoringPhase(gameId); 
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

  console.log(`[GameManager] game ${gameId} setup for next play turn. Player: ${G.currentPlayerId}.`);
  activeGames[gameId] = gameRoom; 
  return G;
};

const setupFinalTurnsPhase = (gameId: string, checkerPlayerId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) { console.error(`[GameManager] setupFinalTurnsPhase: Game room ${gameId} not found.`); return null; }
  const G = gameRoom.gameState;

  G.currentPhase = 'finalTurnsPhase';
  if (!G.playerWhoCalledCheck) {
    G.playerWhoCalledCheck = checkerPlayerId; 
  G.finalTurnsTaken = 0; 
  }

  console.log(`[GameManager] setupFinalTurnsPhase: Game ${gameId} entering/re-evaluating final turns. Original Checker: ${G.playerWhoCalledCheck}. Initial/Current turns taken: ${G.finalTurnsTaken}. Player who triggered this call: ${checkerPlayerId}.`);
    
  let checkerIndex = G.turnOrder.indexOf(G.playerWhoCalledCheck);
  if (checkerIndex === -1) {
    console.error(`[GameManager] setupFinalTurnsPhase: Original checker ${G.playerWhoCalledCheck} not in turn order for game ${gameId}.`);
    G.currentPhase = 'error'; G.activePlayers = {}; G.currentPlayerId = "";
    activeGames[gameId] = gameRoom; return G;
  }

  // Find the next eligible player after the checker, skipping the checker and locked players
  let nextPlayerId = "";
  let attempts = 0;
  let foundNextPlayer = false;
  let currentTurnIdx = checkerIndex;
  do {
    currentTurnIdx = (currentTurnIdx + 1) % G.turnOrder.length;
    const candidateId = G.turnOrder[currentTurnIdx];
    console.log(`[DEBUG_FinalTurns] Attempt ${attempts + 1}: Candidate is ${candidateId} (index ${currentTurnIdx}). Is locked: ${G.players[candidateId]?.isLocked}. Is checker: ${candidateId === G.playerWhoCalledCheck}`);
    if (candidateId !== G.playerWhoCalledCheck && !G.players[candidateId]?.isLocked) {
      nextPlayerId = candidateId;
      foundNextPlayer = true;
      console.log(`[DEBUG_FinalTurns] Found next player: ${nextPlayerId}`);
      break;
    }
    attempts++;
  } while (attempts < G.turnOrder.length);

  if (!foundNextPlayer) {
    // If all other players are locked, go straight to scoring
    console.error(`[GameManager] setupFinalTurnsPhase: No eligible player found for final turns in game ${gameId}. Moving to scoring.`);
    return setupScoringPhase(gameId);
  }

  G.currentPlayerId = nextPlayerId;
  G.activePlayers = { [nextPlayerId]: 'finalTurnActive' }; 
  G.discardPileIsSealed = false; 

  console.log(`[GameManager] Game ${gameId} setup for final turns. Player: ${G.currentPlayerId}. Total final turns taken: ${G.finalTurnsTaken}`);
  activeGames[gameId] = gameRoom;
  return G;
};


const setupAbilityResolutionPhase = (gameId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) { console.error(`[GameManager] setupAbilityResolutionPhase: Game room ${gameId} not found.`); return null; }
  const G = gameRoom.gameState;

  if (!G.pendingAbilities || G.pendingAbilities.length === 0) {
    console.log(`[GameManager] setupAbilityResolutionPhase: No pending abilities for game ${gameId}. Determining next phase.`);
    if (G.playerWhoCalledCheck) {
      console.log(`[GameManager] setupAbilityResolutionPhase: Check was called. Proceeding to final turns setup.`);
      return setupFinalTurnsPhase(gameId, G.playerWhoCalledCheck);
    }
    console.log(`[GameManager] setupAbilityResolutionPhase: No check called. Proceeding to next play turn setup.`);
    return setupNextPlayTurn(gameId);
  }

  G.pendingAbilities.sort((a, b) => {
    const priorityOrder = { 'stack': 1, 'stackSecondOfPair': 2, 'discard': 3, 'deck': 4 };
    
    if ((a.source === 'stack' || a.source === 'stackSecondOfPair') && !(b.source === 'stack' || b.source === 'stackSecondOfPair')) return -1;
    if (!(a.source === 'stack' || a.source === 'stackSecondOfPair') && (b.source === 'stack' || b.source === 'stackSecondOfPair')) return 1;

    if ((a.source === 'stack' || a.source === 'stackSecondOfPair') && (b.source === 'stack' || b.source === 'stackSecondOfPair')) {
      if (a.pairTargetId && a.pairTargetId === G.lastPlayerToResolveAbility && a.source === 'stackSecondOfPair') return -1;
      if (b.pairTargetId && b.pairTargetId === G.lastPlayerToResolveAbility && b.source === 'stackSecondOfPair') return 1;
    }
    
    return (priorityOrder[a.source] || 99) - (priorityOrder[b.source] || 99);
  });
  
  const abilityToResolve = G.pendingAbilities[0];
  const playerToActId = abilityToResolve.playerId;

  G.currentPhase = 'abilityResolutionPhase';
  G.currentPlayerId = playerToActId;
  G.activePlayers = { [playerToActId]: 'abilityResolutionActive' };
  G.discardPileIsSealed = true;

  console.log(`[GameManager] Game ${gameId} setup for ability resolution. Player: ${playerToActId}, Ability: ${abilityToResolve.card.rank} from ${abilityToResolve.source}.`);
  activeGames[gameId] = gameRoom;
  return G;
};

const continueOrEndFinalTurns = (gameId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) { console.error(`[GameManager] continueOrEndFinalTurns: Game room ${gameId} not found.`); return null; }
  const G = gameRoom.gameState;

  console.log(`[DEBUG_FinalTurns] Entering continueOrEndFinalTurns. Current player (turn just ended): ${G.currentPlayerId}, Current Phase: ${G.currentPhase}, Player Who Called Check: ${G.playerWhoCalledCheck}`);

  if (G.currentPhase !== 'finalTurnsPhase' || !G.playerWhoCalledCheck) {
    console.error(`[GameManager] continueOrEndFinalTurns: Not in final turns phase or no checker defined for game ${gameId}. Current phase: ${G.currentPhase}`);
    return setupNextPlayTurn(gameId); 
  }

  const playerWhoseTurnJustEnded = G.currentPlayerId;
  console.log(`[DEBUG_FinalTurns] finalTurnsTaken (before increment): ${G.finalTurnsTaken === undefined ? 'undefined' : G.finalTurnsTaken}`);
  if (!G.finalTurnsTaken) G.finalTurnsTaken = 0;
  G.finalTurnsTaken += 1;
  console.log(`[GameManager] continueOrEndFinalTurns: Player ${playerWhoseTurnJustEnded} completed final turn. finalTurnsTaken (after increment): ${G.finalTurnsTaken} for game ${gameId}.`);

  const eligiblePlayerIds = G.turnOrder.filter(pid => pid !== G.playerWhoCalledCheck && !G.players[pid]?.isLocked);
  const numEligiblePlayers = eligiblePlayerIds.length;
  console.log(`[DEBUG_FinalTurns] Eligible players for final turns: ${eligiblePlayerIds.join(', ') || 'NONE'}. Total numEligiblePlayers: ${numEligiblePlayers}`);

  const allTurnsTaken = G.finalTurnsTaken >= numEligiblePlayers;
  console.log(`[DEBUG_FinalTurns] Comparison: finalTurnsTaken (${G.finalTurnsTaken}) >= numEligiblePlayers (${numEligiblePlayers})? Result: ${allTurnsTaken}`);

  if (allTurnsTaken) {
    console.log(`[GameManager] continueOrEndFinalTurns: All eligible players (${numEligiblePlayers}) have taken their final turn in game ${gameId}. Proceeding to scoring.`);
    return setupScoringPhase(gameId);
  } else {
    let lastTurnPlayerIndex = G.turnOrder.indexOf(playerWhoseTurnJustEnded);
    let attempts = 0;
    let nextPlayerId = "";
    let foundNextPlayer = false;
    console.log(`[DEBUG_FinalTurns] Finding next player. Starting search after player ${playerWhoseTurnJustEnded} (index ${lastTurnPlayerIndex}).`);
    do {
      lastTurnPlayerIndex = (lastTurnPlayerIndex + 1) % G.turnOrder.length;
      const candidateId = G.turnOrder[lastTurnPlayerIndex];
      console.log(`[DEBUG_FinalTurns] Attempt ${attempts + 1}: Candidate is ${candidateId} (index ${lastTurnPlayerIndex}). Is locked: ${G.players[candidateId]?.isLocked}. Is checker: ${candidateId === G.playerWhoCalledCheck}`);
      if (candidateId !== G.playerWhoCalledCheck && !G.players[candidateId]?.isLocked) {
        nextPlayerId = candidateId;
        foundNextPlayer = true;
        console.log(`[DEBUG_FinalTurns] Found next player: ${nextPlayerId}`);
        break;
      }
      attempts++;
    } while (attempts < G.turnOrder.length);

    if (!foundNextPlayer) {
      console.error(`[GameManager] continueOrEndFinalTurns: Logic error - could not find next eligible player for final turn in game ${gameId}, but not all turns taken (finalTurnsTaken: ${G.finalTurnsTaken}, numEligiblePlayers: ${numEligiblePlayers}). Forcing scoring phase as fallback.`);
      return setupScoringPhase(gameId);
    }

    G.currentPlayerId = nextPlayerId;
    G.activePlayers = { [nextPlayerId]: 'finalTurnActive' };
    G.discardPileIsSealed = false;

    console.log(`[GameManager] Game ${gameId} continuing final turns. Next player: ${G.currentPlayerId}. Total final turns taken: ${G.finalTurnsTaken}`);
    activeGames[gameId] = gameRoom;
    return G;
  }
};

const setupScoringPhase = (gameId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) { console.error(`[GameManager] setupScoringPhase: Game room ${gameId} not found.`); return null; }
  const G = gameRoom.gameState;

  G.currentPhase = 'scoringPhase';
  G.activePlayers = {};
  G.currentPlayerId = "";

  console.log(`[GameManager] Game ${gameId} entering scoring phase.`);

  let minScore = Infinity;
  let roundWinnerIds: string[] = [];
  const scores: { [playerId: string]: number } = {};
  const finalHands: { [playerId: string]: Card[] } = {};

  for (const playerId in G.players) {
    const player = G.players[playerId];
    let playerScore = 0;
    player.hand.forEach(card => {
      playerScore += cardValues[card.rank];
    });
    player.score = playerScore;
    scores[playerId] = playerScore;
    finalHands[playerId] = [...player.hand];

    if (playerScore < minScore) {
      minScore = playerScore;
      roundWinnerIds = [playerId];
    } else if (playerScore === minScore) {
      roundWinnerIds.push(playerId);
    }
  }
  
  G.roundWinner = roundWinnerIds.length > 0 ? roundWinnerIds[0] : null; 
  
G.gameover = {
    winner: G.roundWinner === null ? undefined : G.roundWinner,
    scores: scores,
    finalHands: finalHands,
  };
  G.currentPhase = 'gameOver';

  console.log(`[GameManager] Game ${gameId} scoring complete. Round Winner: ${G.roundWinner}. Scores:`, scores);
  activeGames[gameId] = gameRoom;
  return G;
};


export interface AbilityArgs {
  peekTargets?: Array<{ playerID: string; cardIndex: number }>; 
  swapTargets?: Array<{ playerID: string; cardIndex: number }>;
}

export const handleResolveSpecialAbility = (
  gameId: string,
  playerId: string,
  abilityResolutionArgs?: AbilityArgs & { skipAbility?: boolean; skipType?: 'peek' | 'swap' | 'full' }
): { success: boolean; message?: string; updatedGameState?: ServerCheckGameState } => {
  console.log(`[GameManager-handleResolveSpecialAbility] Received for player ${playerId}, game ${gameId}. Args:`, JSON.stringify(abilityResolutionArgs, null, 2));

  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) { return { success: false, message: "Game not found." }; }
  const G = gameRoom.gameState;
  if (!G.pendingAbilities || G.pendingAbilities.length === 0) {
    return { success: false, message: "No pending abilities to resolve." };
  }
  // Do not shift yet, we might modify it for multi-stage
  let pendingAbility = G.pendingAbilities[0]; 

  if (pendingAbility.playerId !== playerId) {
    return { success: false, message: "Not your turn to resolve an ability." };
  }

  const player = G.players[playerId];
  const abilityRank = pendingAbility.card.rank;
  let message = `${abilityRank} ability action.`;

  // Handle player being locked (fizzles entire ability)
  if (!player || player.isLocked) {
    G.lastResolvedAbilityCardForCleanup = pendingAbility.card;
    G.lastResolvedAbilitySource = pendingAbility.source;
    G.lastPlayerToResolveAbility = pendingAbility.playerId;
    G.pendingAbilities.shift(); // Remove the fizzled ability
    message = `Ability ${abilityRank} fizzled: Player locked.`;
    // ... (standard phase transition logic) ...
    let nextState = setupAbilityResolutionPhase(gameId);
    if (!nextState) nextState = setupNextPlayTurn(gameId);
    if (!nextState && G.playerWhoCalledCheck) nextState = continueOrEndFinalTurns(gameId);
    if (!nextState && !G.gameover) nextState = setupScoringPhase(gameId);
    activeGames[gameId] = gameRoom;
    return { success: true, message, updatedGameState: nextState ?? G };
  }

  // Initialize stage if not present (e.g. first time K/Q is processed)
  if ((abilityRank === Rank.King || abilityRank === Rank.Queen) && !pendingAbility.currentAbilityStage) {
    pendingAbility.currentAbilityStage = 'peek';
  }

  // Handle skips
  if (abilityResolutionArgs?.skipAbility) {
    const skipType = abilityResolutionArgs.skipType || 'full';
    message = `Player chose to skip ${abilityRank} ability stage: ${skipType}.`;
    console.log(`[GameManager] Player ${playerId} skipping ${abilityRank}, type: ${skipType}`);

    if ((abilityRank === Rank.King || abilityRank === Rank.Queen) && skipType === 'peek' && pendingAbility.currentAbilityStage === 'peek') {
      pendingAbility.currentAbilityStage = 'swap'; // Advance to swap stage
      // DO NOT remove from G.pendingAbilities yet.
      // The game should re-enter ability resolution for this same player and ability.
      G.lastPlayerToResolveAbility = playerId; // Ensure this player gets to act again for the swap part
      activeGames[gameId] = gameRoom;
      // We need to trigger a state update that leads to setupAbilityResolutionPhase being called again
      // For now, returning the current G. The client should react to the change in pendingAbility.currentAbilityStage.
      // Or, we explicitly call setupAbilityResolutionPhase here. Let's try the latter for more direct control.
      const nextStateAfterPeekSkip = setupAbilityResolutionPhase(gameId); 
      return { success: true, message, updatedGameState: nextStateAfterPeekSkip ?? G };
    } else {
      // Full skip, or skipping swap stage, or skipping Jack's only stage
      G.lastResolvedAbilityCardForCleanup = pendingAbility.card;
      G.lastResolvedAbilitySource = pendingAbility.source;
      G.lastPlayerToResolveAbility = pendingAbility.playerId;
      G.pendingAbilities.shift(); // Remove the ability

      // If the resolved ability was from a discard, clear the matching opportunity that might have created it.
      if (pendingAbility.source === 'discard' || pendingAbility.source === 'stackSecondOfPair') {
        if (G.matchingOpportunityInfo && G.matchingOpportunityInfo.cardToMatch.rank === G.lastResolvedAbilityCardForCleanup?.rank && G.matchingOpportunityInfo.cardToMatch.suit === G.lastResolvedAbilityCardForCleanup?.suit) {
          console.log(`[GameManager] Clearing matchingOpportunityInfo for ${G.lastResolvedAbilityCardForCleanup?.rank}${G.lastResolvedAbilityCardForCleanup?.suit} after its discard-sourced ability was resolved.`);
          G.matchingOpportunityInfo = null;
        }
      }

      // ... (standard phase transition logic) ...
      let nextState = setupAbilityResolutionPhase(gameId);
      if (!nextState) nextState = setupNextPlayTurn(gameId);
      if (!nextState && G.playerWhoCalledCheck) nextState = continueOrEndFinalTurns(gameId);
      if (!nextState && !G.gameover) nextState = setupScoringPhase(gameId);
      activeGames[gameId] = gameRoom;
      return { success: true, message, updatedGameState: nextState ?? G };
    }
  }

  // --- Main ability logic (if not skipped) ---
  if (!abilityResolutionArgs) return { success: false, message: "Ability arguments missing for resolution." };
  const { peekTargets, swapTargets } = abilityResolutionArgs;

  // PEEK STAGE for King/Queen
  if ((abilityRank === Rank.King || abilityRank === Rank.Queen) && pendingAbility.currentAbilityStage === 'peek') {
    if (abilityRank === Rank.King && (!peekTargets || peekTargets.length !== 2)) return { success: false, message: "King PEEK requires 2 targets." };
    if (abilityRank === Rank.Queen && (!peekTargets || peekTargets.length !== 1)) return { success: false, message: "Queen PEEK requires 1 target." };
    for (const target of peekTargets!) {
      if (G.players[target.playerID]?.isLocked) return { success: false, message: `PEEK: Cannot target locked player ${target.playerID}.` };
    }
    // Peek is conceptual for server; client handles display. Server acknowledges to proceed.
    pendingAbility.currentAbilityStage = 'swap'; // Advance to swap stage
    message = `${abilityRank} PEEK stage complete. Ready for SWAP stage.`;
    G.lastPlayerToResolveAbility = playerId; // Ensure this player gets to act again for the swap part
    activeGames[gameId] = gameRoom;
    const nextStateAfterPeek = setupAbilityResolutionPhase(gameId); // Re-enter for swap
    return { success: true, message, updatedGameState: nextStateAfterPeek ?? G };
  }

  // SWAP STAGE for King/Queen (after peek/peekSkip) or Jack (direct swap)
  if (pendingAbility.currentAbilityStage === 'swap' || abilityRank === Rank.Jack) {
    if (!swapTargets || swapTargets.length !== 2) return { success: false, message: `${abilityRank} SWAP requires 2 targets.` };
    for (const target of swapTargets) {
      if (!G.players[target.playerID] || target.cardIndex < 0 || target.cardIndex >= G.players[target.playerID].hand.length) {
        return { success: false, message: `SWAP: Invalid target ${target.playerID}[${target.cardIndex}].` };
      }
      if (G.players[target.playerID]?.isLocked) return { success: false, message: `SWAP: Cannot target locked player ${target.playerID}.` };
    }
    if (swapTargets[0].playerID === swapTargets[1].playerID && swapTargets[0].cardIndex === swapTargets[1].cardIndex) {
      return { success: false, message: "SWAP: Targets must be two different cards." };
    }

    const p1State = G.players[swapTargets[0].playerID];
    const p2State = G.players[swapTargets[1].playerID];
    const card1 = p1State.hand[swapTargets[0].cardIndex];
    const card2 = p2State.hand[swapTargets[1].cardIndex];
    p1State.hand[swapTargets[0].cardIndex] = card2;
    p2State.hand[swapTargets[1].cardIndex] = card1;
    console.log(`[GameManager] ${abilityRank} SWAPPED ${swapTargets[0].playerID}[${swapTargets[0].cardIndex}] with ${swapTargets[1].playerID}[${swapTargets[1].cardIndex}]`);
    message = `${abilityRank} SWAP stage complete.`;

    // Ability fully resolved, remove it
    G.lastResolvedAbilityCardForCleanup = pendingAbility.card;
    G.lastResolvedAbilitySource = pendingAbility.source;
    G.lastPlayerToResolveAbility = pendingAbility.playerId;
    const resolvedAbilitySource = pendingAbility.source; // Store before shift
    G.pendingAbilities.shift(); 

    // If the resolved ability was from a discard, clear the matching opportunity that might have created it.
    if (resolvedAbilitySource === 'discard' || resolvedAbilitySource === 'stackSecondOfPair') {
      if (G.matchingOpportunityInfo && G.matchingOpportunityInfo.cardToMatch.rank === G.lastResolvedAbilityCardForCleanup?.rank && G.matchingOpportunityInfo.cardToMatch.suit === G.lastResolvedAbilityCardForCleanup?.suit) {
        console.log(`[GameManager] Clearing matchingOpportunityInfo for ${G.lastResolvedAbilityCardForCleanup?.rank}${G.lastResolvedAbilityCardForCleanup?.suit} after its discard-sourced ability was resolved.`);
        G.matchingOpportunityInfo = null;
      }
    }

    // ... (standard phase transition logic) ...
    let nextState = setupAbilityResolutionPhase(gameId);
    if (!nextState) nextState = setupNextPlayTurn(gameId);
    if (!nextState && G.playerWhoCalledCheck) nextState = continueOrEndFinalTurns(gameId);
    if (!nextState && !G.gameover) nextState = setupScoringPhase(gameId);
    activeGames[gameId] = gameRoom;
    return { success: true, message, updatedGameState: nextState ?? G };
  }

  // Fallback if somehow no stage matched
  console.warn(`[GameManager] handleResolveSpecialAbility: Ability ${abilityRank} for player ${playerId} did not match any processing stage. Current stage on ability: ${pendingAbility.currentAbilityStage}`);
  G.pendingAbilities.shift(); // Remove to prevent loop
  let fallbackState = setupAbilityResolutionPhase(gameId) ?? setupNextPlayTurn(gameId) ?? G; 
  activeGames[gameId] = gameRoom;
  return { success: false, message: "Error processing ability stage.", updatedGameState: fallbackState };
};

export const handleDeclareReadyForPeek = (
  gameId: string,
  playerId: string
): HandlePeekResult => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) {
    return { success: false, message: "Game not found." };
  }
  const G = gameRoom.gameState;
  const player = G.players[playerId];

  if (!player) return { success: false, message: "Player not found." };
  if (G.currentPhase !== 'initialPeekPhase') return { success: false, message: "Not in initial peek phase." };
  if (player.isReadyForInitialPeek) return { success: true, message: "Player already ready.", updatedGameState: G }; // Return current G if already ready

  // If player has already declared ready and peek is ongoing, or completed,
  // we might just return current state.
  // However, if they are clicking ready again, it implies they want to ensure they are marked.
  if (player.isReadyForInitialPeek && gameRoom.gameState.initialPeekAllReadyTimestamp) {
    console.log(`[GameManager] Player ${playerId} already ready and peek is/was active in game ${gameId}.`);
    // Optionally, could return a specific message or just the current state.
    // If cardsToPeek is still set on player, they will see them.
    return { success: true, updatedGameState: gameRoom.gameState, peekJustStarted: false };
  }

  player.isReadyForInitialPeek = true;
  console.log(`[GameManager] Player ${playerId} marked as ready for peek in game ${gameId}.`);

  let allPlayersReady = true;
  // Check against turnOrder to ensure we consider all expected players
  for (const pid of gameRoom.gameState.turnOrder) {
    const p = gameRoom.gameState.players[pid];
    if (!p || !p.isReadyForInitialPeek) { // Added check for p existence
      allPlayersReady = false;
      break;
    }
  }

  if (allPlayersReady && !gameRoom.gameState.initialPeekAllReadyTimestamp) {
    console.log(`[GameManager] All players are now ready for peek in game ${gameId}. Initiating peek sequence.`);
    gameRoom.gameState.initialPeekAllReadyTimestamp = Date.now(); // Mark that the peek sequence has started
    const deadline = Date.now() + PEEK_TOTAL_DURATION_MS;

    for (const pid of gameRoom.gameState.turnOrder) {
      const p = gameRoom.gameState.players[pid];
      if (p) {
        // Peek the bottom two cards (indices 2 and 3 of a 4-card hand)
        if (p.hand.length === 4) {
          p.cardsToPeek = [p.hand[2], p.hand[3]];
        } else {
          // Fallback or error if hand size is not 4, though it should be.
          console.warn(`[GameManager] Player ${pid} in game ${gameId} has ${p.hand.length} cards, expected 4 for initial peek. Peeking last available cards or empty.`);
          p.cardsToPeek = p.hand.slice(-2); // Peek last two if not 4, or fewer if hand is small
        }
        p.peekAcknowledgeDeadline = deadline;
        console.log(`[GameManager] Set cardsToPeek for player ${pid} in game ${gameId}:`, p.cardsToPeek?.map(c=>c.rank+c.suit));
      }
    }
    
    // Schedule the actions for after the peek duration
    setTimeout(() => {
      const currentRoom = getGameRoom(gameId);
      // Check if peek was indeed active for this game (initialPeekAllReadyTimestamp was set and not cleared by another process)
      if (currentRoom && currentRoom.gameState.initialPeekAllReadyTimestamp) { 
        console.log(`[GameManager] Peek timer expired for game ${gameId}. Clearing peek state and advancing.`);
        for (const pid of currentRoom.gameState.turnOrder) {
          const p = currentRoom.gameState.players[pid];
          if (p) {
            p.cardsToPeek = null;
            p.hasCompletedInitialPeek = true;
            p.peekAcknowledgeDeadline = null; // Clear deadline
          }
        }
        currentRoom.gameState.initialPeekAllReadyTimestamp = null; // Clear the timestamp to prevent re-entry
        
        // Transition to the next phase
        const nextPhaseState = setupNextPlayTurn(gameId); 
        if (nextPhaseState) {
            // IMPORTANT: Trigger a broadcast for the state *after* peek ends
            broadcastService.triggerBroadcast(gameId, nextPhaseState); 
            console.log(`[GameManager] Peek duration ended for game ${gameId}. State updated, broadcast triggered for next phase.`);
        } else {
            // This case should ideally not happen if setupNextPlayTurn always returns a state or handles errors
            console.error(`[GameManager] setupNextPlayTurn did not return a valid state for game ${gameId} after peek.`);
            // Fallback: broadcast current state, though it might be inconsistent
            broadcastService.triggerBroadcast(gameId, currentRoom.gameState);
        }
      } else {
        console.log(`[GameManager] Peek timer expired for game ${gameId}, but peek was not active or already processed.`);
      }
    }, PEEK_TOTAL_DURATION_MS);

    console.log(`[GameManager] All players ready for peek in game ${gameId}. cardsToPeek set. Timeout scheduled.`);
    // This state (with cardsToPeek populated) is returned immediately.
    // index.ts will broadcast this, allowing clients to see the cards.
    return { success: true, updatedGameState: gameRoom.gameState, peekJustStarted: true };
  } else if (allPlayersReady && gameRoom.gameState.initialPeekAllReadyTimestamp) {
    // This case means all players were already set to ready, and the peek process has started (timestamp is set).
    // This can happen if a player sends 'declareReadyForPeek' again while peek is active.
    // We send them the current state which should include their cardsToPeek.
    console.log(`[GameManager] Player ${playerId} declared ready, but peek already in progress for ${gameId}. Sending current peek state.`);
    return { success: true, updatedGameState: gameRoom.gameState, peekJustStarted: true }; // Indicate peek is active
  }

  // If not all players are ready yet, but this player is now ready
  console.log(`[GameManager] Player ${playerId} is ready for peek in game ${gameId}. Waiting for other players.`);
  return { success: true, updatedGameState: gameRoom.gameState, peekJustStarted: false };
};

export const generatePlayerView = (
  fullGameState: ServerCheckGameState,
  viewingPlayerId: string
): ClientCheckGameState => {
  const clientPlayers: { [playerID: string]: ClientPlayerState } = {};

  for (const pId in fullGameState.players) {
    const serverPlayerState = fullGameState.players[pId];
    let clientHand: ClientCard[];

    if (pId === viewingPlayerId) {
      clientHand = serverPlayerState.hand.map((card, index) => ({
        ...card, 
        id: `${pId}-card-${index}`
      }));
    } else {
      clientHand = serverPlayerState.hand.map((_, index) => ({ 
        isHidden: true, 
        id: `${pId}-hidden-${index}`
      }));
    }
    
    let cardsToPeekForClient: Card[] | null = null;
    if (pId === viewingPlayerId && serverPlayerState.cardsToPeek) {
        cardsToPeekForClient = serverPlayerState.cardsToPeek;
    }

    clientPlayers[pId] = {
      hand: clientHand,
      hasUsedInitialPeek: serverPlayerState.hasUsedInitialPeek,
      isReadyForInitialPeek: serverPlayerState.isReadyForInitialPeek,
      hasCompletedInitialPeek: serverPlayerState.hasCompletedInitialPeek,
      cardsToPeek: cardsToPeekForClient, 
      peekAcknowledgeDeadline: pId === viewingPlayerId ? serverPlayerState.peekAcknowledgeDeadline : null,
      
      pendingDrawnCard: pId === viewingPlayerId 
        ? serverPlayerState.pendingDrawnCard 
        : (serverPlayerState.pendingDrawnCard ? { isHidden: true, id: `pending-hidden-${pId}` } : null),
      pendingDrawnCardSource: pId === viewingPlayerId ? serverPlayerState.pendingDrawnCardSource : null,
      
      pendingSpecialAbility: serverPlayerState.pendingSpecialAbility, 
      
      hasCalledCheck: serverPlayerState.hasCalledCheck,
      isLocked: serverPlayerState.isLocked,
      score: serverPlayerState.score,
      name: serverPlayerState.name,
      isConnected: serverPlayerState.isConnected,
    };
  }

  // Calculate topDiscardIsSpecialOrUnusable for the entire game state view
  const topDiscardCard = fullGameState.discardPile.length > 0 ? fullGameState.discardPile[0] : null;
  let isTopDiscardActuallySpecial = false; // Default to false
  if (topDiscardCard) {
    isTopDiscardActuallySpecial = (topDiscardCard.rank === Rank.King || 
                                   topDiscardCard.rank === Rank.Queen || 
                                   topDiscardCard.rank === Rank.Jack);
  }
  const topDiscardFlagForClient = fullGameState.discardPileIsSealed || isTopDiscardActuallySpecial;

  let clientGameOverData: ClientCheckGameState['gameover'] = null;
  if (fullGameState.gameover) {
    clientGameOverData = {
      ...fullGameState.gameover,
      finalHands: fullGameState.gameover.finalHands 
        ? Object.fromEntries(
            Object.entries(fullGameState.gameover.finalHands).map(([pId, hand]) => [
              pId,
              hand.map((card, index) => ({ ...card, id: `${pId}-finalhand-${index}` }))
            ])
          )
        : undefined,
    };
  }

  const clientGameState: ClientCheckGameState = {
    ...fullGameState,
    deckSize: fullGameState.deck.length, 
    players: clientPlayers, 
    topDiscardIsSpecialOrUnusable: topDiscardFlagForClient,

    discardPile: fullGameState.discardPile, 
    discardPileIsSealed: fullGameState.discardPileIsSealed,
    matchingOpportunityInfo: fullGameState.matchingOpportunityInfo, 
    playerWhoCalledCheck: fullGameState.playerWhoCalledCheck,
    roundWinner: fullGameState.roundWinner,
    finalTurnsTaken: fullGameState.finalTurnsTaken,
    initialPeekAllReadyTimestamp: fullGameState.initialPeekAllReadyTimestamp,
    
    currentPhase: fullGameState.currentPhase,
    currentPlayerId: fullGameState.currentPlayerId,
    turnOrder: fullGameState.turnOrder,
    gameMasterId: fullGameState.gameMasterId,
    activePlayers: fullGameState.activePlayers, 
    pendingAbilities: fullGameState.pendingAbilities, 
    gameover: clientGameOverData, // Use the processed gameover data
    matchResolvedDetails: fullGameState.matchResolvedDetails, 

    viewingPlayerId: viewingPlayerId, 
  };
  
  delete (clientGameState as any).deck; 
  delete (clientGameState as any).lastPlayerToResolveAbility;
  delete (clientGameState as any).lastResolvedAbilityCardForCleanup;

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

export const markPlayerAsDisconnected = (gameId: string, playerId: string): { success: boolean; updatedGameState?: ServerCheckGameState, playerWasFound?: boolean } => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) {
    return { success: false };
  }
  const player = gameRoom.gameState.players[playerId];
  if (player) {
    player.isConnected = false;
    // We keep player.socketId as is, it represents the *last known* socketId.
    // This might be useful for logging or if the same socket reconnects quickly.
    console.log(`[GameManager] Player ${playerId} in game ${gameId} marked as disconnected. Last socket ID: ${player.socketId}`);
    activeGames[gameId] = gameRoom; 
    return { success: true, updatedGameState: gameRoom.gameState, playerWasFound: true };
  }
  return { success: false, playerWasFound: false };
};

export const attemptRejoin = (
  gameId: string, 
  playerId: string, 
  newSocketId: string
): { success: boolean; message?: string; gameState?: ServerCheckGameState } => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) {
    return { success: false, message: "Game not found." };
  }

  const playerState = gameRoom.gameState.players[playerId];
  if (!playerState) {
    return { success: false, message: "Player ID not found in this game." };
  }

  if (playerState.isConnected && playerState.socketId !== newSocketId) {
    console.warn(`[GameManager] Player ${playerId} (Game ${gameId}) is rejoining with new socket ${newSocketId}, but was already connected with socket ${playerState.socketId}. Updating to new socket ID.`);
  } else if (playerState.isConnected && playerState.socketId === newSocketId) {
     console.log(`[GameManager] Player ${playerId} (Game ${gameId}) rejoining with same socket ${newSocketId} and already connected. No state change.`);
     return { success: true, message: "Already connected.", gameState: gameRoom.gameState };
  } else if (!playerState.isConnected) {
     console.log(`[GameManager] Player ${playerId} (Game ${gameId}) was disconnected, rejoining with socket ${newSocketId}.`);
  }

  playerState.isConnected = true;
  playerState.socketId = newSocketId;
  activeGames[gameId] = gameRoom; 

  console.log(`[GameManager] Player ${playerId} successfully rejoined game ${gameId} with new socket ID ${newSocketId}.`);
  return { success: true, message: "Rejoined successfully.", gameState: gameRoom.gameState };
};

// Placeholder for playerSetupData, this should align with what the client sends when creating/joining a game.
// We'll need to define how players are identified (e.g. socket.id, or a persistent user ID if you have auth)
// For now, this is a minimal structure.
// export interface PlayerSetupInfo {
//   id: string; // e.g., socket.id or a user-chosen ID if unique
//   name?: string;
// } 