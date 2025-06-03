import { Card, Suit, Rank, PlayerState, CheckGameState as ServerCheckGameState, InitialPlayerSetupData, cardValues, HiddenCard, ClientCard, ClientPlayerState, ClientCheckGameState, SpecialAbilityInfo, PendingSpecialAbility, GameOverData, GamePhase, MatchResolvedDetails, RichGameLogMessage } from 'shared-types';

// Local RichGameLogMessage definition removed, imported from shared-types above.

const PEEK_COUNTDOWN_SECONDS = 5; // Define based on typical client value or make configurable
const PEEK_REVEAL_SECONDS = 5;    // Define based on typical client value or make configurable
const PEEK_TOTAL_DURATION_MS = 10 * 1000; // Simplified to 10 seconds total for server timer. Client handles its own countdown visuals.

// Turn Timer Constants (configurable)
const TURN_DURATION_MS = 60 * 1000; // 60 seconds
const DISCONNECT_GRACE_PERIOD_MS = 90 * 1000; // 90 seconds
const MATCHING_STAGE_DURATION_MS = 20 * 1000; // 20 seconds global timer for matching

const MAX_LOG_HISTORY = 100;
const NUM_RECENT_LOGS_ON_JOIN_REJOIN = 20; // Define the constant here

// Server-only map for managing active timer IDs
const activeTurnTimerIds = new Map<string, NodeJS.Timeout>(); // Key: gameId_playerId
const activeDisconnectGraceTimerIds = new Map<string, NodeJS.Timeout>(); // Key: gameId_playerId
const activeMatchingStageTimer = new Map<string, NodeJS.Timeout>(); // Key: gameId

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
      // Assign a unique ID to each card, e.g., "RANK_SUIT"
      deck.push({ suit, rank, id: `${rank}_${suit}` });
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
        console.warn("[GameManager] broadcastService.triggerBroadcast called but not implemented. This should be set by index.ts. GAT: " + JSON.stringify(gameState.globalAbilityTargets));
    }
};

// New service for broadcasting log entries
const logBroadcastService = {
    triggerLogBroadcast: (gameId: string, logEntry: RichGameLogMessage) => {
        console.warn("[GameManager] logBroadcastService.triggerLogBroadcast called but not implemented. This should be set by index.ts.");
    }
};

export const setTriggerBroadcastFunction = (fn: (gameId: string, gameState: ServerCheckGameState) => void) => {
    broadcastService.triggerBroadcast = fn;
    console.log("[GameManager] triggerBroadcast function has been set.");
};

export const setTriggerLogBroadcastFunction = (fn: (gameId: string, logEntry: RichGameLogMessage) => void) => {
    logBroadcastService.triggerLogBroadcast = fn;
    console.log("[GameManager] triggerLogBroadcast function has been set.");
};

// Helper to get player name, avoiding null/undefined issues for logging
const getPlayerNameForLog = (playerId: string, gameState: ServerCheckGameState): string => {
    return gameState.players[playerId]?.name || `P-${playerId.slice(-4)}`;
};

// Helper function to emit a log entry
const emitLogEntry = (
    gameId: string, 
    gameStateForContext: ServerCheckGameState, 
    publicLogData: Omit<RichGameLogMessage, 'timestamp' | 'actorName' | 'isPublic' | 'recipientPlayerId'> & { actorId?: string },
    privateLogConfig?: { 
        message: string; 
        recipientPlayerId: string; 
        cardContext?: string; 
        type?: RichGameLogMessage['type'];
        actorId?: string; // Optional: if different from publicLogData.actorId or if public has no actor
    }
) => {
    // Process and send the public log entry
    const publicEntry: RichGameLogMessage = {
        ...publicLogData,
        logId: `log_${Math.random().toString(36).substring(2, 15)}`, // Generate unique ID
        isPublic: true, // Explicitly mark as public
        timestamp: new Date().toISOString(), // CHANGED HERE
    };
    if (publicLogData.actorId && gameStateForContext && gameStateForContext.players[publicLogData.actorId]) {
        publicEntry.actorName = getPlayerNameForLog(publicLogData.actorId, gameStateForContext);
    }
    
    // If a private log is being sent, mark the public log so the recipient of the private log doesn't get both.
    if (privateLogConfig && privateLogConfig.recipientPlayerId) {
        publicEntry.privateVersionRecipientId = privateLogConfig.recipientPlayerId;
    }
    
    // Store public entry in game state log history
    const gameRoom = getGameRoom(gameId);
    if (gameRoom) {
        if (!gameRoom.gameState.logHistory) {
            gameRoom.gameState.logHistory = [];
        }
        gameRoom.gameState.logHistory.push(publicEntry);
        if (gameRoom.gameState.logHistory.length > MAX_LOG_HISTORY) {
            gameRoom.gameState.logHistory = gameRoom.gameState.logHistory.slice(-MAX_LOG_HISTORY);
        }
    } else {
        console.warn(`[GameManager-emitLogEntry] Game room ${gameId} not found when trying to store public log history.`);
    }
    logBroadcastService.triggerLogBroadcast(gameId, publicEntry);

    // Process and send the private log entry if configured
    if (privateLogConfig && privateLogConfig.recipientPlayerId) {
        const privateEntry: RichGameLogMessage = {
            message: privateLogConfig.message,
            type: privateLogConfig.type || publicLogData.type, // Default to public type if not specified
            cardContext: privateLogConfig.cardContext,
            logId: `log_${Math.random().toString(36).substring(2, 15)}`, // Generate unique ID
            isPublic: false,
            recipientPlayerId: privateLogConfig.recipientPlayerId,
            timestamp: new Date().toISOString(), // CHANGED HERE
        };

        const actorForPrivateLog = privateLogConfig.actorId || publicLogData.actorId;
        if (actorForPrivateLog && gameStateForContext && gameStateForContext.players[actorForPrivateLog]) {
            privateEntry.actorName = getPlayerNameForLog(actorForPrivateLog, gameStateForContext);
        }
        // Note: Private logs are NOT added to the general gameRoom.gameState.logHistory here.
        logBroadcastService.triggerLogBroadcast(gameId, privateEntry);
    }
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
    // The socketId is expected to be set by the caller (e.g., server/src/index.ts)
    // before this function is invoked. If it were missing, it would indicate a
    // problem in the upstream call sequence rather than something to be patched here.
    if (!playerInfo.socketId) {
        // This case should ideally not be reached if server/src/index.ts correctly sets it.
        // Throwing an error or logging a more severe warning might be appropriate
        // if this path is ever taken, as it indicates a logic flaw elsewhere.
        console.error(`[GameManager-InitializeGame] CRITICAL: socketId missing for player ${playerId} during game initialization. This should have been set by the server.`);
        // Proceeding without a socketId will likely lead to issues with disconnect/rejoin or player tracking.
        // Forcing a placeholder or returning null here are options, but the root cause should be fixed.
        // For now, let's return null to indicate a critical failure in setup.
        // Consider making playerInfo.socketId non-optional in InitialPlayerSetupData if it's always required here.
        return null; 
    }
    initialPlayers[playerId] = {
      hand: shuffledDeck.splice(0, 4).map(card => ({ ...card, isFaceDownToOwner: true })),
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
      forfeited: false, // Initialize new field
      numMatches: 0, // Initialize new stat
      numPenalties: 0, // Initialize new stat
    };
    console.log(`[GameManager] Dealt 4 cards to player ${playerInfo.name || playerId} during game initialization.`);
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
    globalAbilityTargets: null, // Initialize new field
    currentPhase: 'initialPeekPhase',
    currentPlayerId: playerSetupData[0].id, 
    turnOrder: playerSetupData.map(p => p.id),
    gameMasterId: playerSetupData[0].id,
    activePlayers: playerSetupData.reduce((acc, p) => {
      acc[p.id] = 'awaitingReadiness';
      return acc;
    }, {} as { [playerID: string]: string }),
    totalTurnsInRound: 0, // Initialize new stat
    lastRegularSwapInfo: null, // Initialize new field
    playerTimers: {}, // Initialize new field
    currentTurnSegment: 'initialAction', // Initialize new field
    logHistory: [], // Initialize log history
  };

  const newGameRoom: GameRoom = {
    gameId,
    players: initialPlayers, 
    gameState: initialGameState,
  };

  activeGames[gameId] = newGameRoom;
  console.log(`[GameManager] New game room created: ${gameId} with players: ${playerSetupData.map(p=>(p.name || p.id)).join(', ')}`);
  
  // Log game creation
  if (playerSetupData.length > 0) {
    const creatorName = playerSetupData[0].name || `P-${playerSetupData[0].id.slice(-4)}`;
    // gameStateForContext is newGameRoom.gameState here. Need to pass it.
    emitLogEntry(gameId, newGameRoom.gameState, { 
        message: `Game created by ${creatorName}. Game ID: ${gameId.slice(-6)}.`, 
        type: 'game_event' 
    });
  }
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
        // Ensure cards dealt to the new player also respect initial visibility and have an ID
        newPlayerHand.push({ ...card, isFaceDownToOwner: true, id: card.id || `${playerInfo.id}-hand-${i}` });
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
    forfeited: false, // Initialize new field
    numMatches: 0, // Initialize new stat
    numPenalties: 0, // Initialize new stat
  };

  gameRoom.gameState.players[playerInfo.id] = newPlayerState;
  gameRoom.gameState.turnOrder.push(playerInfo.id);
  
  activeGames[gameId] = gameRoom;

  // Log player joining
  const playerName = newPlayerState.name || `P-${playerInfo.id.slice(-4)}`;
  emitLogEntry(gameId, gameRoom.gameState, { 
      message: `${playerName} joined the game.`, 
      type: 'game_event', 
      actorId: playerInfo.id // actorId to resolve name
    });

  console.log(`[GameManager] Player ${playerInfo.name || playerInfo.id} (Socket: ${socketId}) added to game ${gameId}. Dealt 4 cards. Total players: ${Object.keys(gameRoom.gameState.players).length}`);
  
  // Broadcast the updated game state to all players in the room
  broadcastService.triggerBroadcast(gameId, gameRoom.gameState);
  
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
  clearGlobalAbilityTargetsIfNeeded(gameRoom.gameState); // Clear GATs at the start of this action

  const player = gameRoom.gameState.players[playerId];
  if (!player) {
    return { success: false, message: "Player not found in game." };
  }

  // --- Start: Segment and Timer Logic ---
  clearPlayerTimers(gameId, playerId); // Clear timer for 'initialAction' segment
  // --- End: Segment and Timer Logic ---

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
  
  // --- Start: Segment and Timer Logic ---
  gameRoom.gameState.currentTurnSegment = 'postDrawAction';
  startTurnTimer(gameId, playerId); // Start timer for 'postDrawAction' segment
  // --- End: Segment and Timer Logic ---

  activeGames[gameId] = gameRoom;

  console.log(`[GameManager] Player ${player.name || playerId} drew from deck in game ${gameId}. Card: ${card.rank}${card.suit}. Deck size: ${gameRoom.gameState.deck.length}. Segment: ${gameRoom.gameState.currentTurnSegment}.`);
  
  // Public and private logs for drawing from deck
  const playerName = getPlayerNameForLog(playerId, gameRoom.gameState);
  const publicMessage = `${playerName} drew a card from the deck.`;
  const privateMessage = `You drew ${card.rank}${suitSymbols[card.suit] || card.suit} from the deck.`;

  emitLogEntry(
    gameId, 
    gameRoom.gameState, 
    { // Public log data
      message: publicMessage,
      type: 'player_action', 
      actorId: playerId 
    },
    { // Private log config
      message: privateMessage,
      recipientPlayerId: playerId,
      cardContext: `${card.rank}${suitSymbols[card.suit] || card.suit}`, // Private context shows the card
      type: 'player_action' // Explicitly type, though it would default to public's type
    }
  );

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
  clearGlobalAbilityTargetsIfNeeded(gameRoom.gameState); // Clear GATs at the start of this action

  const player = gameRoom.gameState.players[playerId];
  if (!player) {
    return { success: false, message: "Player not found in game." };
  }

  // --- Start: Segment and Timer Logic ---
  clearPlayerTimers(gameId, playerId); // Clear timer for 'initialAction' segment
  // --- End: Segment and Timer Logic ---

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
  
  // --- Start: Segment and Timer Logic ---
  gameRoom.gameState.currentTurnSegment = 'postDrawAction';
  startTurnTimer(gameId, playerId); // Start timer for 'postDrawAction' segment
  // --- End: Segment and Timer Logic ---
  
  activeGames[gameId] = gameRoom; 

  console.log(`[GameManager] Player ${player.name || playerId} drew from discard in game ${gameId}. Card: ${card.rank}${card.suit}. Discard pile size: ${gameRoom.gameState.discardPile.length}. Segment: ${gameRoom.gameState.currentTurnSegment}.`);
  
  const playerName = getPlayerNameForLog(playerId, gameRoom.gameState);
  const cardString = `${card.rank}${suitSymbols[card.suit] || card.suit}`;
  emitLogEntry(gameId, gameRoom.gameState, { 
    message: `${playerName} drew ${cardString} from the discard pile.`, 
    type: 'player_action', 
    actorId: playerId,
    cardContext: cardString
  });
  
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

  // Ensure the card being swapped into the hand is marked as face-down to its owner.
  const cardToPlaceInHand: Card = { 
    ...player.pendingDrawnCard,
    isFaceDownToOwner: true 
  };

  const cardFromHand = player.hand.splice(handIndex, 1, cardToPlaceInHand)[0];
  player.pendingDrawnCard = null;
  player.pendingDrawnCardSource = null;

  // --- Start: Segment and Timer Logic ---
  clearPlayerTimers(gameId, playerId); // Clear timer for 'postDrawAction' segment
  gameRoom.gameState.currentTurnSegment = null; // End of player's active turn segments
  // --- End: Segment and Timer Logic ---

  // Add the card from hand to the discard pile
  gameRoom.gameState.discardPile.unshift(cardFromHand);
  gameRoom.gameState.discardPileIsSealed = false;
  
  // NEW: Record the swap event
  gameRoom.gameState.lastRegularSwapInfo = {
    playerId: playerId,
    handIndex: handIndex,
    timestamp: Date.now()
  };
  console.log(`[GameManager] Recorded lastRegularSwapInfo for player ${player.name || playerId}, index ${handIndex}`);

  console.log(`[GameManager] Player ${player.name || playerId} swapped drawn card with hand[${handIndex}]. Discarded: ${cardFromHand.rank}${cardFromHand.suit}`);

  const potentialMatchers = Object.keys(gameRoom.gameState.players).filter(pId => {
    const p = gameRoom.gameState.players[pId];
    return p && !p.isLocked && !p.hasCalledCheck;
  });

  // Store previous phase before changing it
  const previousPhase = gameRoom.gameState.currentPhase;

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

  // Log if we just entered matchingStage
  if (previousPhase !== 'matchingStage' && gameRoom.gameState.currentPhase === 'matchingStage') {
    emitLogEntry(gameId, gameRoom.gameState, {
      message: "Matching stage has begun!",
      type: 'game_event'
    });
  }

  activeGames[gameId] = gameRoom;
  console.log(`[GameManager] Player ${player.name || playerId} swapped and discarded in ${gameId}. Card: ${cardFromHand.rank}${cardFromHand.suit}. Phase -> matchingStage. Active matchers: ${Object.keys(newActivePlayers).map(pId => gameRoom.gameState.players[pId]?.name || pId).join(', ')}`);
  
  const cardFromHandStr = `${cardFromHand.rank}${suitSymbols[cardFromHand.suit] || cardFromHand.suit}`;
  const takenCard = player.hand[handIndex]; 
  const takenCardStr = takenCard ? `${takenCard.rank}${suitSymbols[takenCard.suit] || takenCard.suit}` : 'a card';
  
  // Public and private logs for swapping and discarding
  const playerName = getPlayerNameForLog(playerId, gameRoom.gameState);
  const publicMessage = `${playerName} discarded ${cardFromHandStr} and kept their drawn card.`;
  const privateMessage = `You discarded ${cardFromHandStr} and kept ${takenCardStr}.`;

  emitLogEntry(
    gameId, 
    gameRoom.gameState, 
    { // Public log data
      message: publicMessage,
      type: 'player_action', 
      actorId: playerId,
      cardContext: `Discarded ${cardFromHandStr}` // Public context now specific
    },
    { // Private log config
      message: privateMessage,
      recipientPlayerId: playerId,
      cardContext: `Discarded: ${cardFromHandStr}, Kept: ${takenCardStr}`,
      type: 'player_action'
    }
  );

  startMatchingStageTimer(gameId); // <<< START MATCHING STAGE TIMER
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
  
  // --- Start: Segment and Timer Logic ---
  clearPlayerTimers(gameId, playerId); // Clear timer for 'postDrawAction' segment
  gameRoom.gameState.currentTurnSegment = null; // End of player's active turn segments
  // --- End: Segment and Timer Logic ---
  
  gameRoom.gameState.discardPile.unshift(drawnCard);
  gameRoom.gameState.discardPileIsSealed = false;
  
  console.log(`[GameManager] Player ${player.name || playerId} discarded drawn card: ${drawnCard.rank}${drawnCard.suit}`);

  const playerName = getPlayerNameForLog(playerId, gameRoom.gameState);
  const drawnCardStr = `${drawnCard.rank}${suitSymbols[drawnCard.suit] || drawnCard.suit}`;
  emitLogEntry(gameId, gameRoom.gameState, { 
    message: `${playerName} discarded their drawn card ${drawnCardStr}.`, 
    type: 'player_action', 
    actorId: playerId,
    cardContext: drawnCardStr 
  });

  const potentialMatchers = Object.keys(gameRoom.gameState.players).filter(pId => {
    const p = gameRoom.gameState.players[pId];
    return p && !p.isLocked && !p.hasCalledCheck;
  });
  
  const previousPhase = gameRoom.gameState.currentPhase; // Store previous phase

  gameRoom.gameState.matchingOpportunityInfo = {
    cardToMatch: drawnCard,
    originalPlayerID: playerId,
    potentialMatchers,
  };

  gameRoom.gameState.currentPhase = 'matchingStage'; // Update current phase

  const newActivePlayers: { [playerID: string]: string } = {};
  potentialMatchers.forEach(pId => {
    newActivePlayers[pId] = 'awaitingMatchAction';
  });
  gameRoom.gameState.activePlayers = newActivePlayers;

  // Log if we just entered matchingStage
  if (previousPhase !== 'matchingStage') {
    emitLogEntry(gameId, gameRoom.gameState, { 
      message: "Matching stage has begun!", 
      type: 'game_event' 
    });
  }

  activeGames[gameId] = gameRoom;
  console.log(`[GameManager] Player ${player.name || playerId} discarded drawn card in ${gameId}. Card: ${drawnCard.rank}${drawnCard.suit}. Phase -> matchingStage. Active matchers: ${Object.keys(newActivePlayers).map(pId => gameRoom.gameState.players[pId]?.name || pId).join(', ')}`);
  startMatchingStageTimer(gameId); // <<< START MATCHING STAGE TIMER
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

  console.log(`[GameManager] handleAttemptMatch: Player ${player.name || playerId} attempting to match.`);
  console.log(`[GameManager] Card from Hand (cardY at index ${handIndex}): ${cardY ? cardY.rank + cardY.suit : 'undefined'}`);
  console.log(`[GameManager] Card to Match (cardX from discard): ${cardX ? cardX.rank + cardX.suit : 'undefined'}`);

  if (cardY.rank === cardX.rank) {
    player.hand.splice(handIndex, 1); 
    G.discardPile.unshift(cardY); 
    G.discardPileIsSealed = true;
    player.numMatches++; // Increment successful matches
    
    // Log successful match
    const originalPlayerName = getPlayerNameForLog(originalPlayerID, G);
    // Simplified card string representation
    const cardXStr = `${cardX.rank}${suitSymbols[cardX.suit] || cardX.suit}`;
    const cardYStr = `${cardY.rank}${suitSymbols[cardY.suit] || cardY.suit}`;
    
    emitLogEntry(gameId, G, {
      message: `matched ${originalPlayerName}'s ${cardXStr} with their ${cardYStr}.`,
      type: 'player_action',
      actorId: playerId, // The player who made the match
      targetName: originalPlayerName, // The player whose card was matched
      cardContext: `${cardYStr} matches ${cardXStr}`
    });
    
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
      console.log(`[GameManager] Player ${player.name || playerId} emptied hand on match. Auto-Check!`);
    }

    G.matchResolvedDetails = {
      byPlayerId: playerId,
      isAutoCheck,
      abilityResolutionRequired,
    };
    
    const finalGameState = checkMatchingStageEnd(gameId);
    if (!finalGameState) return {success: false, message: "Error after attempting match (checkMatchingStageEnd failed processing match details)." };
    
    return { success: true, message: "Match successful!", updatedGameState: finalGameState };

  } else {
    // Cards do not match. Player incurs a penalty and their attempt for this opportunity is over.
    console.log(`[GameManager] Match FAILED for player ${player.name || playerId} in game ${gameId}. Card ${cardY.rank}${cardY.suit} (hand) does not match ${cardX.rank}${cardX.suit} (discard).`);
    
    // Penalty: Draw a card from the deck
    let privatePenaltyCardContext = "No card drawn (deck empty)"; // For private log
    let publicPenaltyMessage = "and drew a penalty card."; // For public log
    if (G.deck.length > 0) {
      const penaltyCard = G.deck.pop();
      if (penaltyCard) {
        penaltyCard.isFaceDownToOwner = true; // Mark as face-down to owner
        player.hand.push(penaltyCard);
        player.numPenalties++; // Increment penalties
        privatePenaltyCardContext = "a face-down card"; // Updated private context
        console.log(`[GameManager] Player ${player.name || playerId} drew a penalty card face-down. Hand size: ${player.hand.length}. Deck size: ${G.deck.length}`);
      } else {
        console.warn(`[GameManager] Penalty card draw failed for ${player.name || playerId} in game ${gameId} - deck pop returned undefined despite length > 0.`);
        publicPenaltyMessage = "but no penalty card could be drawn (deck error).";
      }
    } else {
      console.warn(`[GameManager] Player ${player.name || playerId} should receive a penalty card in game ${gameId}, but deck is empty.`);
      publicPenaltyMessage = "and would draw a penalty, but the deck is empty.";
    }

    const attemptedCardStr = `${cardY.rank}${suitSymbols[cardY.suit] || cardY.suit}`;
    const targetCardStr = `${cardX.rank}${suitSymbols[cardX.suit] || cardX.suit}`;

    // Emit public and private logs for failed match
    // Public message should reveal the card they attempted with, as per real-life analogy described by user.
    const playerName = getPlayerNameForLog(playerId, G);
    const publicMessage = `${playerName} failed to match ${targetCardStr} (on discard) with their ${attemptedCardStr}. ${publicPenaltyMessage}`;
    const privateMessage = `You failed to match ${targetCardStr} with your ${attemptedCardStr}. You drew ${privatePenaltyCardContext} as a penalty.`;

    emitLogEntry(
      gameId, 
      G, 
      { // Public log data
        message: publicMessage,
        type: 'player_action',
        actorId: playerId,
        cardContext: `Attempt: ${attemptedCardStr} vs ${targetCardStr}` // Public context reveals both cards
      },
      { // Private log config
        message: privateMessage,
        recipientPlayerId: playerId,
        cardContext: `Attempt: ${attemptedCardStr} vs ${targetCardStr}. Penalty: ${privatePenaltyCardContext}`,
        type: 'player_action'
      }
    );

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
    const matchPlayerName = G.players[byPlayerId]?.name || byPlayerId;
    console.log(`[GameManager] checkMatchingStageEnd: Processing resolved match by ${matchPlayerName} in game ${gameId}. AutoCheck: ${isAutoCheck}, AbilityRequired: ${abilityResolutionRequired}.`);

    G.matchingOpportunityInfo = null; 
    clearMatchingStageTimer(gameId); // <<< CLEAR MATCHING STAGE TIMER
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
        console.log(`[GameManager] checkMatchingStageEnd (after match in final turns): Match by ${matchPlayerName} successful. Phase remains finalTurnsPhase. Player's final turn action complete.`);
        G.currentPhase = 'finalTurnsPhase'; // Explicitly ensure it stays finalTurnsPhase
        G.currentPlayerId = byPlayerId;   // Player who made the match
        // This player's "active" part of the turn is done. They don't get to do more actions.
        // The next call to setupNextPlayTurn/setupAbilityResolutionPhase from a higher level will trigger continueOrEndFinalTurns.
        G.activePlayers = {}; // Clear active players for this specific part.
      } else { // Final turns are NOT active
        console.log("[GameManager] checkMatchingStageEnd (after match, not in final turns): Match successful. Setting up next regular play turn.");
        // G.currentPlayerId remains the player who initiated the discard.
        // setupNextPlayTurn will determine the actual next player and set phase, currentPlayerId, and activePlayers.
      setupNextPlayTurn(gameId);
      }
    }
    activeGames[gameId] = gameRoom; 
    return G;
  }

  const remainingActiveMatchers = G.activePlayers && 
                                Object.values(G.activePlayers).some(status => status === 'awaitingMatchAction');

  if (!remainingActiveMatchers && G.matchingOpportunityInfo) { 
    console.log(`[GameManager] checkMatchingStageEnd: All players passed or resolved for game ${gameId}. Ending matching stage for card ${G.matchingOpportunityInfo.cardToMatch.rank}${G.matchingOpportunityInfo.cardToMatch.suit} (discarded by ${G.players[G.matchingOpportunityInfo.originalPlayerID]?.name || G.matchingOpportunityInfo.originalPlayerID}).`);
    const { cardToMatch, originalPlayerID } = G.matchingOpportunityInfo;

    // Log that the matching stage ended without a successful match made by a player
    const cardStr = `${cardToMatch.rank}${suitSymbols[cardToMatch.suit] || cardToMatch.suit}`;
    const originalPlayerName = getPlayerNameForLog(originalPlayerID, G);
    emitLogEntry(gameId, G, {
      message: `Matching stage ended. No matches were made for ${cardStr} discarded by ${originalPlayerName}.`,
      type: 'game_event',
      cardContext: cardStr
    });

    G.matchingOpportunityInfo = null;
    clearMatchingStageTimer(gameId); // <<< CLEAR MATCHING STAGE TIMER

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

  console.log(`[GameManager] Player ${G.players[playerId]?.name || playerId} passed in matching stage for game ${gameId}.`);
  delete G.activePlayers[playerId]; 

  const playerName = getPlayerNameForLog(playerId, G);
  emitLogEntry(gameId, G, { 
    message: `${playerName} passed the match.`, 
    type: 'player_action', 
    actorId: playerId 
  });

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

  console.log(`[GameManager] Player ${G.players[playerId]?.name || playerId} called Check in game ${gameId}. Transitioning to finalTurnsPhase.`);
  
  const playerName = getPlayerNameForLog(playerId, G);
  emitLogEntry(gameId, G, { 
    message: `${playerName} called Check!`, 
    type: 'player_action', 
    actorId: playerId 
  });
  
  setupFinalTurnsPhase(gameId, playerId); 

  activeGames[gameId] = gameRoom; 
  return { success: true, updatedGameState: G };
};


const setupNextPlayTurn = (gameId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) { console.error(`[GameManager] setupNextPlayTurn: Game room ${gameId} not found.`); return null; }
  const G = gameRoom.gameState;

  clearGlobalAbilityTargetsIfNeeded(G);
  clearTransientVisualCues(G);

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
    console.warn(`[GameManager] setupNextPlayTurn: Current player ${G.players[G.currentPlayerId]?.name || G.currentPlayerId} not in turn order for game ${gameId}. Starting from first player.`);
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
        const potentialPlayer = G.players[potentialNextPlayerId];
        if (potentialPlayer && !potentialPlayer.isLocked && potentialPlayer.isConnected && !potentialPlayer.forfeited) { // Added forfeited check
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
    console.warn(`[GameManager] setupNextPlayTurn: No unlocked, connected, and non-forfeited player found in game ${gameId}.`);
    if (G.playerWhoCalledCheck) { 
        return setupScoringPhase(gameId); 
    }
    G.currentPhase = 'errorOrStalemate'; 
    G.activePlayers = {}; G.currentPlayerId = "";
    console.error(`[GameManager] Game ${gameId} is stuck. All players locked, disconnected, or forfeited, no check path to scoring defined here.`);
    activeGames[gameId] = gameRoom; return G;
  }
  
  // Store the previous phase to detect if we are *entering* playPhase
  const previousPhase = G.currentPhase;

  G.currentPhase = 'playPhase';
  G.currentPlayerId = nextPlayerId;
  G.activePlayers = { [nextPlayerId]: 'playPhaseActive' };
  G.discardPileIsSealed = false; 

  // Log if we just entered playPhase
  if (previousPhase !== 'playPhase') {
    emitLogEntry(gameId, G, {
      message: "Play phase has started.",
      type: 'game_event'
    });
  }

  if (!G.playerWhoCalledCheck) {
    G.totalTurnsInRound++;
    console.log(`[GameManager] Total turns in round for game ${gameId} incremented to: ${G.totalTurnsInRound} (playPhase start)`);
  }
  G.currentTurnSegment = 'initialAction'; // Set for the new turn

  startTurnTimer(gameId, nextPlayerId); // <<< ADD THIS LINE

  console.log(`[GameManager] game ${gameId} setup for next play turn. Player: ${G.players[G.currentPlayerId]?.name || G.currentPlayerId}. Segment: ${G.currentTurnSegment}.`);
  activeGames[gameId] = gameRoom; 
  return G;
};

const setupFinalTurnsPhase = (gameId: string, checkerPlayerId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) { console.error(`[GameManager] setupFinalTurnsPhase: Game room ${gameId} not found.`); return null; }
  const G = gameRoom.gameState;

  clearGlobalAbilityTargetsIfNeeded(G); // Clear when initiating final turns
  clearTransientVisualCues(G); // NEW: Clear transient cues
  G.currentPhase = 'finalTurnsPhase';
  if (!G.playerWhoCalledCheck) {
    G.playerWhoCalledCheck = checkerPlayerId; 
  G.finalTurnsTaken = 0; 
    // Increment total turns when final turns phase is *first* initiated
    G.totalTurnsInRound++; 
    console.log(`[GameManager] Total turns in round for game ${gameId} incremented to: ${G.totalTurnsInRound} (finalTurnsPhase initiated by ${G.players[checkerPlayerId]?.name || checkerPlayerId})`);
  }

  console.log(`[GameManager] setupFinalTurnsPhase: Game ${gameId} entering/re-evaluating final turns. Original Checker: ${G.players[G.playerWhoCalledCheck]?.name || G.playerWhoCalledCheck}. Initial/Current turns taken: ${G.finalTurnsTaken}. Player who triggered this call: ${G.players[checkerPlayerId]?.name || checkerPlayerId}.`);
    
  let checkerIndex = G.turnOrder.indexOf(G.playerWhoCalledCheck);
  if (checkerIndex === -1) {
    console.error(`[GameManager] setupFinalTurnsPhase: Original checker ${G.players[G.playerWhoCalledCheck]?.name || G.playerWhoCalledCheck} not in turn order for game ${gameId}.`);
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
    const candidatePlayer = G.players[candidateId];
    console.log(`[DEBUG_FinalTurns] Attempt ${attempts + 1}: Candidate is ${candidateId} (index ${currentTurnIdx}). Is locked: ${candidatePlayer?.isLocked}. Is checker: ${candidateId === G.playerWhoCalledCheck}. Is connected: ${candidatePlayer?.isConnected}. Is forfeited: ${candidatePlayer?.forfeited}`);
    if (candidatePlayer && candidateId !== G.playerWhoCalledCheck && !candidatePlayer.isLocked && candidatePlayer.isConnected && !candidatePlayer.forfeited) { // Added forfeited check
      nextPlayerId = candidateId;
      foundNextPlayer = true;
      console.log(`[DEBUG_FinalTurns] Found next player: ${nextPlayerId}`);
      break;
    }
    attempts++;
  } while (attempts < G.turnOrder.length);

  if (!foundNextPlayer) {
    console.error(`[GameManager] setupFinalTurnsPhase: No eligible (unlocked, connected, non-forfeited, not checker) player found for final turns in game ${gameId}. Moving to scoring.`);
    return setupScoringPhase(gameId);
  }

  G.currentPlayerId = nextPlayerId;
  G.activePlayers = { [nextPlayerId]: 'finalTurnActive' }; 
  G.discardPileIsSealed = false; 
  G.currentTurnSegment = 'initialAction'; // Set for the new final turn

  startTurnTimer(gameId, nextPlayerId); // <<< ADD THIS LINE

  console.log(`[GameManager] Game ${gameId} setup for final turns. Player: ${G.players[G.currentPlayerId]?.name || G.currentPlayerId}. Total final turns taken: ${G.finalTurnsTaken}. Segment: ${G.currentTurnSegment}.`);
  activeGames[gameId] = gameRoom;
  return G;
};


const setupAbilityResolutionPhase = (gameId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) { console.error(`[GameManager] setupAbilityResolutionPhase: Game room ${gameId} not found.`); return null; }
  const G = gameRoom.gameState;

  if (!G.pendingAbilities || G.pendingAbilities.length === 0) {
    console.log(`[GameManager] setupAbilityResolutionPhase: No pending abilities for game ${gameId}. Determining next phase.`);
    clearGlobalAbilityTargetsIfNeeded(G); // Clear if no abilities left, before transitioning
    clearTransientVisualCues(G); // NEW: Clear transient cues
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
  // G.currentTurnSegment = 'abilityAction'; // Or some other appropriate segment if abilities have their own timed segments
  // For now, assuming ability resolution uses the standard turn timer initiated here.
  // If ability resolution is very quick or doesn't need its own distinct timer segment, 
  // currentTurnSegment might be null or inherited from the previous player if not explicitly set.
  // Let's set it to null for now, assuming ability resolution isn't a 'turn segment' in the same way.
  G.currentTurnSegment = null; 

  startTurnTimer(gameId, playerToActId); // <<< ADD THIS LINE (if abilities should be timed)

  console.log(`[GameManager] Game ${gameId} setup for ability resolution. Player: ${playerToActId}, Ability: ${abilityToResolve.card.rank} from ${abilityToResolve.source}. Segment: ${G.currentTurnSegment}.`);
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
  const playerNameOfTurnEnded = G.players[playerWhoseTurnJustEnded]?.name || playerWhoseTurnJustEnded;
  console.log(`[DEBUG_FinalTurns] finalTurnsTaken (before increment): ${G.finalTurnsTaken === undefined ? 'undefined' : G.finalTurnsTaken}`);
  if (!G.finalTurnsTaken) G.finalTurnsTaken = 0;
  G.finalTurnsTaken += 1;
  console.log(`[GameManager] continueOrEndFinalTurns: Player ${playerNameOfTurnEnded} completed final turn. finalTurnsTaken (after increment): ${G.finalTurnsTaken} for game ${gameId}.`);

  const eligiblePlayerIds = G.turnOrder.filter(pid => {
    const p = G.players[pid];
    return p && pid !== G.playerWhoCalledCheck && !p.isLocked && p.isConnected && !p.forfeited; // Added forfeited check
  });
  const numEligiblePlayers = eligiblePlayerIds.length;
  console.log(`[DEBUG_FinalTurns] Eligible players for final turns (unlocked, connected, non-forfeited, not checker): ${eligiblePlayerIds.join(', ') || 'NONE'}. Total numEligiblePlayers: ${numEligiblePlayers}`);

  const allTurnsTaken = G.finalTurnsTaken >= numEligiblePlayers;
  console.log(`[DEBUG_FinalTurns] Comparison: finalTurnsTaken (${G.finalTurnsTaken}) >= numEligiblePlayers (${numEligiblePlayers})? Result: ${allTurnsTaken}`);

  if (allTurnsTaken) {
    console.log(`[GameManager] continueOrEndFinalTurns: All eligible players (${numEligiblePlayers}) have taken their final turn in game ${gameId}. Proceeding to scoring.`);
    clearGlobalAbilityTargetsIfNeeded(G);
    clearTransientVisualCues(G);
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
      const candidatePlayer = G.players[candidateId];
      console.log(`[DEBUG_FinalTurns] Attempt ${attempts + 1}: Candidate is ${candidateId} (index ${lastTurnPlayerIndex}). Is locked: ${candidatePlayer?.isLocked}. Is checker: ${candidateId === G.playerWhoCalledCheck}. Is connected: ${candidatePlayer?.isConnected}. Is forfeited: ${candidatePlayer?.forfeited}`);
      if (candidatePlayer && candidateId !== G.playerWhoCalledCheck && !candidatePlayer.isLocked && candidatePlayer.isConnected && !candidatePlayer.forfeited) { // Added forfeited check
        nextPlayerId = candidateId;
        foundNextPlayer = true;
        console.log(`[DEBUG_FinalTurns] Found next player: ${nextPlayerId}`);
        break;
      }
      attempts++;
    } while (attempts < G.turnOrder.length);

    if (!foundNextPlayer) {
      console.error(`[GameManager] continueOrEndFinalTurns: Logic error - could not find next eligible (unlocked, connected, non-forfeited, not checker) player for final turn in game ${gameId}, but not all turns taken (finalTurnsTaken: ${G.finalTurnsTaken}, numEligiblePlayers: ${numEligiblePlayers}). Forcing scoring phase as fallback.`);
      return setupScoringPhase(gameId);
    }

    G.currentPlayerId = nextPlayerId;
    G.activePlayers = { [nextPlayerId]: 'finalTurnActive' };
    G.discardPileIsSealed = false;
    clearGlobalAbilityTargetsIfNeeded(G);
    clearTransientVisualCues(G);
    G.totalTurnsInRound++;
    console.log(`[GameManager] Total turns in round for game ${gameId} incremented to: ${G.totalTurnsInRound} (final turn for ${G.players[nextPlayerId]?.name || nextPlayerId})`);
    
    startTurnTimer(gameId, nextPlayerId); // <<< ADD THIS LINE

    console.log(`[GameManager] Game ${gameId} continuing final turns. Next player: ${G.players[G.currentPlayerId]?.name || G.currentPlayerId}. Total final turns taken: ${G.finalTurnsTaken}. Segment: ${G.currentTurnSegment}.`);
    activeGames[gameId] = gameRoom;
    return G;
  }
};

const setupScoringPhase = (gameId: string): ServerCheckGameState | null => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) { console.error(`[GameManager] setupScoringPhase: Game room ${gameId} not found.`); return null; }
  const G = gameRoom.gameState;

  clearGlobalAbilityTargetsIfNeeded(G); // Clear at the start of scoring phase
  clearTransientVisualCues(G); // NEW: Clear transient cues
  G.currentPhase = 'scoringPhase';
  G.activePlayers = {};
  G.currentPlayerId = "";

  console.log(`[GameManager] Game ${gameId} entering scoring phase.`);

  let minScore = Infinity;
  let roundWinnerIds: string[] = [];
  const scores: { [playerId: string]: number } = {};
  const finalHands: { [playerId: string]: Card[] } = {};
  const playerStatsForGameOver: GameOverData['playerStats'] = {}; // Explicit type

  for (const playerId in G.players) {
    const player = G.players[playerId];
    let playerScore = 0;
    player.hand.forEach(card => {
      playerScore += cardValues[card.rank];
    });
    player.score = playerScore; // Update player's main score property
    scores[playerId] = playerScore; // Collect for gameover.scores
    finalHands[playerId] = [...player.hand]; // Collect for gameover.finalHands

    // Collect stats for gameover.playerStats
    playerStatsForGameOver[playerId] = {
      name: player.name || `P-${playerId.slice(-4)}`, // Use existing name or a fallback
      numMatches: player.numMatches,
      numPenalties: player.numPenalties,
    };

    if (playerScore < minScore) {
      minScore = playerScore;
      roundWinnerIds = [playerId];
    } else if (playerScore === minScore) {
      roundWinnerIds.push(playerId);
    }
  }
  
  G.roundWinner = roundWinnerIds.length > 0 ? roundWinnerIds[0] : null; 
  
G.gameover = {
    winner: G.roundWinner === null ? undefined : G.roundWinner, // Ensure undefined for no winner
    scores: scores,
    finalHands: finalHands,
    totalTurns: G.totalTurnsInRound, // Add total turns
    playerStats: playerStatsForGameOver, // Add collected player stats
  };
  G.currentPhase = 'gameOver';

  const roundWinnerName = G.roundWinner ? (G.players[G.roundWinner]?.name || G.roundWinner) : "None (Tie or Error)";
  console.log(`[GameManager] Game ${gameId} scoring complete. Round Winner: ${roundWinnerName}. Scores:`, scores, `Total Turns: ${G.totalTurnsInRound}, Player Stats:`, playerStatsForGameOver);
  
  // Emit Game Over logs
  const winnerLogName = G.roundWinner ? getPlayerNameForLog(G.roundWinner, G) : "No one (tie or error)";
  emitLogEntry(gameId, G, {
    message: `Game Over! Round Winner: ${winnerLogName}.`,
    type: 'game_event'
  });

  const scoreSummary = Object.entries(scores)
    .map(([pid, score]) => `${getPlayerNameForLog(pid, G)}: ${score}`)
    .join(', ');
  emitLogEntry(gameId, G, {
    message: `Final Scores: ${scoreSummary}.`,
    type: 'info' // Using 'info' to differentiate from the main game_event
  });

  emitLogEntry(gameId, G, {
    message: `Total turns played this round: ${G.totalTurnsInRound}.`,
    type: 'info'
  });

  clearAllGameTimers(gameId); // Ensure all timers are cleared when game definitively ends through scoring.
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
    G.globalAbilityTargets = null; // Clear if no abilities
    console.log(`[GameManager-handleResolveSpecialAbility] No pending abilities for player ${G.players[playerId]?.name || playerId} to resolve.`);
    return { success: false, message: "No pending abilities to resolve." };
  }
  // Do not shift yet, we might modify it for multi-stage
  let pendingAbility = G.pendingAbilities[0]; 

  if (pendingAbility.playerId !== playerId) {
    console.warn(`[GameManager-handleResolveSpecialAbility] Player ${G.players[pendingAbility.playerId]?.name || pendingAbility.playerId} attempting to resolve ability, but it's ${playerId}'s turn for ability.`);
    return { success: false, message: "Not your turn to resolve an ability." };
  }
  
  const abilityRank = pendingAbility.card.rank;
  let message = `${abilityRank} ability action.`;
  console.log(`[GameManager-handleResolveSpecialAbility] Player ${G.players[playerId]?.name || playerId} starting resolution for ${abilityRank}${pendingAbility.card.suit} from ${pendingAbility.source}. Stage: ${pendingAbility.currentAbilityStage || 'default'}. Args:`, JSON.stringify(abilityResolutionArgs, null, 2));

  // Handle player being locked (fizzles entire ability)
  if (!G.players[playerId] || G.players[playerId].isLocked) {
    G.lastResolvedAbilityCardForCleanup = pendingAbility.card;
    G.lastResolvedAbilitySource = pendingAbility.source;
    G.lastPlayerToResolveAbility = pendingAbility.playerId;
    G.pendingAbilities.shift(); // Remove the fizzled ability
    G.globalAbilityTargets = null; // Clear targets on fizzle
    message = `Ability ${abilityRank} fizzled: Player locked.`;

    // Log the fizzle
    emitLogEntry(gameId, G, {
      message: `'s ${abilityRank} ability fizzled because they are locked.`,
      type: 'game_event', // Or 'player_action' with a system-like tone
      actorId: playerId,
      cardContext: `${abilityRank} fizzled (locked)`
    });

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
    message = `Player ${G.players[playerId]?.name || playerId} chose to skip ${abilityRank} ability stage: ${skipType}.`;
    console.log(`[GameManager] Player ${G.players[playerId]?.name || playerId} skipping ${abilityRank}, type: ${skipType}`);
    // Log the skip action
    const playerName = getPlayerNameForLog(playerId, G);
    let logMessage = `${playerName} chose to skip the ${abilityRank} ability`;
    if (skipType === 'peek') {
      logMessage = `${playerName} chose to skip the PEEK stage of the ${abilityRank} ability.`;
    } else if (skipType === 'swap') {
      logMessage = `${playerName} chose to skip the SWAP stage of the ${abilityRank} ability.`;
    } else { // full skip
      logMessage = `${playerName} chose to skip the entire ${abilityRank} ability.`;
    }

    emitLogEntry(gameId, G, {
      message: logMessage,
      type: 'player_action',
      actorId: playerId,
      cardContext: `${abilityRank} skip ${skipType}`
    });

    if ((abilityRank === Rank.King || abilityRank === Rank.Queen) && skipType === 'peek' && pendingAbility.currentAbilityStage === 'peek') {
      pendingAbility.currentAbilityStage = 'swap'; // Advance to swap stage
      G.globalAbilityTargets = null; // Clear peek targets
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
      G.globalAbilityTargets = null; // Clear targets on full skip/swap skip

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
  if (!abilityResolutionArgs) {
    // If no args, means we might be re-entering for a swap stage where targets were already set by handleRequestPeekReveal
    // or for a Jack where client directly sends swap targets.
    // If it's a peek stage expecting client to send peekTargets for handleRequestPeekReveal, this path shouldn't be hit yet.
    // This function primarily processes the *results* of peek or swap actions.
    // Let's assume if args are missing here, it's not a critical error for now, but needs review.
    console.warn(`[GameManager-handleResolveSpecialAbility] abilityResolutionArgs missing. Ability: ${abilityRank}, Stage: ${pendingAbility.currentAbilityStage}. This might be okay if targets are set/cleared elsewhere for this stage transition.`);
  }
  const { peekTargets, swapTargets } = abilityResolutionArgs || {}; // Allow undefined args for now

  // PEEK STAGE for King/Queen - This stage is now primarily for server to acknowledge client's peek reveal request.
  // The actual setting of globalAbilityTargets for peek happens in handleRequestPeekReveal.
  // This function then transitions the ability state.
  if ((abilityRank === Rank.King || abilityRank === Rank.Queen) && pendingAbility.currentAbilityStage === 'peek') {
    // This part of handleResolveSpecialAbility is called *after* client's local peek timer ends,
    // and client sends resolveSpecialAbility with PEEK_TARGETS to confirm they saw them and server should move to swap.
    
    if (abilityRank === Rank.King && (!peekTargets || peekTargets.length !== 2)) {
        console.warn(`[GameManager] King PEEK confirmation: Client did not send 2 peekTargets with resolveSpecialAbility. Proceeding to swap stage anyway.`);
    }
    if (abilityRank === Rank.Queen && (!peekTargets || peekTargets.length !== 1)) {
        console.warn(`[GameManager] Queen PEEK confirmation: Client did not send 1 peekTarget with resolveSpecialAbility. Proceeding to swap stage anyway.`);
    }
    
    // Knowledge of self-peeked cards was temporary. No change to isFaceDownToOwner needed.
    // The client saw these cards via temporaryReveals in generatePlayerView.
    
    pendingAbility.currentAbilityStage = 'swap'; // Advance to swap stage
    // DO NOT clear G.globalAbilityTargets here. Let the 'peek' targets persist for others to see
    // while the current player is deciding on their swap. They will be overwritten by 'swap' targets later,
    // or cleared by general phase changes / ability completion.
    message = `${abilityRank} PEEK stage confirmed. Ready for SWAP stage. Peek targets remain visible.`;
    G.lastPlayerToResolveAbility = playerId;
    activeGames[gameId] = gameRoom;
    const nextStateAfterPeek = setupAbilityResolutionPhase(gameId); // This will use G with existing 'peek' targets.
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

    let justPerformedSwapTargets: Array<{ playerID: string; cardIndex: number; type: 'peek' | 'swap' }> | null = null;

    G.globalAbilityTargets = swapTargets.map(st => ({ ...st, type: 'swap' }));
    justPerformedSwapTargets = G.globalAbilityTargets; // Capture them
    console.log(`[GameManager] ${abilityRank} SWAP: Global targets set and captured:`, JSON.stringify(G.globalAbilityTargets));

    const p1State = G.players[swapTargets[0].playerID];
    const p2State = G.players[swapTargets[1].playerID];
    // Identify cards BEFORE the swap
    const originalCardAtPos1 = p1State.hand[swapTargets[0].cardIndex]; 
    const originalCardAtPos2 = p2State.hand[swapTargets[1].cardIndex]; 
    
    // Perform the swap: p1State's card at index becomes originalCardAtPos2, p2State's card at index becomes originalCardAtPos1
    p1State.hand[swapTargets[0].cardIndex] = originalCardAtPos2; 
    p2State.hand[swapTargets[1].cardIndex] = originalCardAtPos1; 

    console.log(`[GameManager] ${abilityRank} SWAPPED ${swapTargets[0].playerID}[${swapTargets[0].cardIndex}] with ${swapTargets[1].playerID}[${swapTargets[1].cardIndex}]`);
    message = `${abilityRank} SWAP stage complete.`;

    const jackUserPlayerId = playerId; // Player who used the Jack
    const juName = getPlayerNameForLog(jackUserPlayerId, G);

    const target1PlayerId = swapTargets[0].playerID;
    const target1CardIndex = swapTargets[0].cardIndex;
    const t1pName = getPlayerNameForLog(target1PlayerId, G);
    // originalCard1Str is what WAS at target1PlayerId's hand[target1CardIndex]
    const originalCard1Str = `${originalCardAtPos1.rank}${suitSymbols[originalCardAtPos1.suit] || originalCardAtPos1.suit}`;
    // newCardForT1Str is what IS NOW at target1PlayerId's hand[target1CardIndex] (which is originalCardAtPos2)
    const newCardForT1Str = `${originalCardAtPos2.rank}${suitSymbols[originalCardAtPos2.suit] || originalCardAtPos2.suit}`;

    const target2PlayerId = swapTargets[1].playerID;
    const target2CardIndex = swapTargets[1].cardIndex;
    const t2pName = getPlayerNameForLog(target2PlayerId, G);
    // originalCard2Str is what WAS at target2PlayerId's hand[target2CardIndex]
    const originalCard2Str = `${originalCardAtPos2.rank}${suitSymbols[originalCardAtPos2.suit] || originalCardAtPos2.suit}`;
    // newCardForT2Str is what IS NOW at target2PlayerId's hand[target2CardIndex] (which is originalCardAtPos1)
    const newCardForT2Str = `${originalCardAtPos1.rank}${suitSymbols[originalCardAtPos1.suit] || originalCardAtPos1.suit}`;

    // 1. Public Log (Vague - only positions and actors)
    let publicLogMessageText = "";
    if (target1PlayerId === target2PlayerId) {
        publicLogMessageText = `used ${abilityRank} to swap two of ${t1pName}'s cards (at indices ${target1CardIndex} & ${target2CardIndex}).`;
    } else {
        publicLogMessageText = `used ${abilityRank} to swap ${t1pName}'s card (at index ${target1CardIndex}) with ${t2pName}'s card (at index ${target2CardIndex}).`;
    }
    // This is a purely public log. Everyone, including the Jack user, sees this.
    emitLogEntry(gameId, G, {
        message: publicLogMessageText,
        type: 'player_action',
        actorId: jackUserPlayerId,
        cardContext: `Positions: ${t1pName}[${target1CardIndex}] <-> ${t2pName}[${target2CardIndex}]`
    });

    // 2. Private Notification to Owner of Card at Position 1 (target1PlayerId)
    //    Informs them what their card at this position was, and what it is now.
    const t1pNotificationText = `Due to ${juName}'s ${abilityRank} action, your card at index ${target1CardIndex} (which was ${originalCard1Str}) is now ${newCardForT1Str}.`;
    logBroadcastService.triggerLogBroadcast(gameId, {
        message: t1pNotificationText,
        type: 'game_event', 
        recipientPlayerId: target1PlayerId,
        isPublic: false,
        timestamp: new Date().toISOString(), // CHANGED HERE
        actorName: juName, 
        cardContext: `Your hand at index ${target1CardIndex}: ${originalCard1Str} -> ${newCardForT1Str}`
    });

    // 3. Private Notification to Owner of Card at Position 2 (target2PlayerId)
    //    Only if target2PlayerId is different from target1PlayerId.
    //    If they are the same player, a second notification for the other index is handled below.
    if (target1PlayerId !== target2PlayerId) {
        const t2pNotificationText = `Due to ${juName}'s ${abilityRank} action, your card at index ${target2CardIndex} (which was ${originalCard2Str}) is now ${newCardForT2Str}.`;
        logBroadcastService.triggerLogBroadcast(gameId, {
            message: t2pNotificationText,
            type: 'game_event',
            recipientPlayerId: target2PlayerId,
            isPublic: false,
            timestamp: new Date().toISOString(), // CHANGED HERE
            actorName: juName,
            cardContext: `Your hand at index ${target2CardIndex}: ${originalCard2Str} -> ${newCardForT2Str}`
        });
    } else if (target1PlayerId === target2PlayerId && target1CardIndex !== target2CardIndex) {
        // Case: Swapping two cards of the SAME player.
        // The first notification (t1pNotificationText) informed this player about the change at target1CardIndex.
        // Now, inform them about the change at target2CardIndex.
        // For this player (target1PlayerId), their card at target2CardIndex *was* originalCard2Str and *is now* newCardForT2Str.
        const samePlayerSecondCardNotificationText = `Due to ${juName}'s ${abilityRank} action, your card at index ${target2CardIndex} (which was ${originalCard2Str}) is now ${newCardForT2Str}.`;
        logBroadcastService.triggerLogBroadcast(gameId, {
            message: samePlayerSecondCardNotificationText,
            type: 'game_event',
            recipientPlayerId: target1PlayerId, // Recipient is the single player whose cards were swapped
            isPublic: false,
            timestamp: new Date().toISOString(), // CHANGED HERE
            actorName: juName,
            cardContext: `Your hand at index ${target2CardIndex}: ${originalCard2Str} -> ${newCardForT2Str}`
        });
    }
    // Ensure card suit symbols are available if not already defined globally in this file
    // const suitSymbols: { [key: string]: string } = { H: '♥', D: '♦', C: '♣', S: '♠' }; 
    // (Moved suitSymbols to the end of the file, should be fine)

    G.lastResolvedAbilityCardForCleanup = pendingAbility.card;
    G.lastResolvedAbilitySource = pendingAbility.source;
    G.lastPlayerToResolveAbility = pendingAbility.playerId;
    const resolvedAbilitySource = pendingAbility.source; 
    G.pendingAbilities.shift(); 
    
    if (resolvedAbilitySource === 'discard' || resolvedAbilitySource === 'stackSecondOfPair') {
      if (G.matchingOpportunityInfo && G.matchingOpportunityInfo.cardToMatch.rank === G.lastResolvedAbilityCardForCleanup?.rank && G.matchingOpportunityInfo.cardToMatch.suit === G.lastResolvedAbilityCardForCleanup?.suit) {
        console.log(`[GameManager] Clearing matchingOpportunityInfo for ${G.lastResolvedAbilityCardForCleanup?.rank}${G.lastResolvedAbilityCardForCleanup?.suit} after its discard-sourced ability was resolved.`);
        G.matchingOpportunityInfo = null;
      }
    }
    
    let nextStateIsErrorOrGameOver = false;
    let nextState = setupAbilityResolutionPhase(gameId); 
    if (!nextState) { 
        nextState = setupNextPlayTurn(gameId);
    }
    if (!nextState && G.playerWhoCalledCheck) {
        nextState = continueOrEndFinalTurns(gameId);
    }
    if (!nextState && !G.gameover) { 
        nextState = setupScoringPhase(gameId);
        if (nextState && (nextState.currentPhase === 'gameOver' || nextState.currentPhase === 'scoringPhase')) { // scoringPhase implies game over soon
            nextStateIsErrorOrGameOver = true;
        }
    } else if (G.gameover || (nextState && (nextState.currentPhase === 'gameOver' || nextState.currentPhase === 'scoringPhase'))) {
         nextStateIsErrorOrGameOver = true;
    }
    
    const finalGameStateToReturn = nextState ?? G;

    // The globalAbilityTargets were set directly on G when the swap happened.
    // If intermediate phase setups cleared G.globalAbilityTargets before finalGameStateToReturn was fully determined,
    // then finalGameStateToReturn might have them as null. 
    // The principle should be: the broadcast that immediately follows the resolution of the swap includes the GATs.
    // Subsequent phase setups (like for the next player's turn) should then clear them.
    // So, if finalGameStateToReturn (which is what will be broadcasted by the caller of this function)
    // has GATs as null, BUT we just performed a swap, it means an intermediate clearer was too aggressive.
    // However, the current structure is that `setupNextPlayTurn` will be called, and IT should do the clearing for ITS broadcast.
    // The state G *at the point of swap* had the GATs. This G is passed to subsequent setup functions.
    // The problem was re-adding them if the *final* state of *this entire resolution chain* had them as null.
    // We simply want the GATs set from the swap to be present in the G that forms the basis of the next step.

    // The `justPerformedSwapTargets` were set on `G.globalAbilityTargets` earlier in this block.
    // `finalGameStateToReturn` is derived from subsequent phase setups which might have cleared GATs on `G`.
    // The log was `[GameManager] Re-applying SWAP targets...`
    // The current G (which became finalGameStateToReturn after phase calls) might have null GATs.
    // We need to ensure the `updatedGameState` being returned from *this* function call (which triggers a broadcast)
    // *does* have the swap targets if a swap just occurred.

    // If a swap just occurred, ensure the GATs are in the state being returned for broadcast.
    if (justPerformedSwapTargets && !finalGameStateToReturn.globalAbilityTargets) {
        console.log(`[GameManager-SwapResolve-DEBUG] Swap happened. finalGameStateToReturn GATs were null. Setting them from justPerformedSwapTargets for this broadcast.`);
        finalGameStateToReturn.globalAbilityTargets = justPerformedSwapTargets;
    } else if (justPerformedSwapTargets && finalGameStateToReturn.globalAbilityTargets) {
        console.log(`[GameManager-SwapResolve-DEBUG] Swap happened. finalGameStateToReturn GATs were already present (hopefully correct swap ones). GATs:`, JSON.stringify(finalGameStateToReturn.globalAbilityTargets));
    }

    activeGames[gameId].gameState = finalGameStateToReturn; 
    return { success: true, message, updatedGameState: finalGameStateToReturn };
  }

  // Fallback if somehow no stage matched
  console.warn(`[GameManager] handleResolveSpecialAbility: Ability ${abilityRank} for player ${G.players[playerId]?.name || playerId} did not match any processing stage. Current stage on ability: ${pendingAbility.currentAbilityStage}`);
  G.pendingAbilities.shift(); // Remove to prevent loop
  G.globalAbilityTargets = null; // Clear targets
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
    console.log(`[GameManager] Player ${player.name || playerId} already ready and peek is/was active in game ${gameId}.`);
    // Optionally, could return a specific message or just the current state.
    // If cardsToPeek is still set on player, they will see them.
    return { success: true, updatedGameState: gameRoom.gameState, peekJustStarted: false };
  }

  player.isReadyForInitialPeek = true;
  console.log(`[GameManager] Player ${player.name || playerId} marked as ready for peek in game ${gameId}.`);

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

    emitLogEntry(gameId, gameRoom.gameState, { message: "All players ready. Initial peek starting!", type: 'game_event' });

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
            // Knowledge of peeked cards was temporary via p.cardsToPeek.
            // Cards in hand remain isFaceDownToOwner: true.
            p.cardsToPeek = null;
            p.hasCompletedInitialPeek = true;
            p.peekAcknowledgeDeadline = null; // Clear deadline
          }
        }
        currentRoom.gameState.initialPeekAllReadyTimestamp = null; // Clear the timestamp to prevent re-entry
        
        emitLogEntry(gameId, currentRoom.gameState, { message: "Initial peek has ended.", type: 'game_event' });
        
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
    console.log(`[GameManager] Player ${player.name || playerId} declared ready, but peek already in progress for ${gameId}. Sending current peek state.`);
    return { success: true, updatedGameState: gameRoom.gameState, peekJustStarted: true }; // Indicate peek is active
  }

  // If not all players are ready yet, but this player is now ready
  console.log(`[GameManager] Player ${player.name || playerId} is ready for peek in game ${gameId}. Waiting for other players.`);
  
  const playerName = getPlayerNameForLog(playerId, gameRoom.gameState);
  emitLogEntry(gameId, gameRoom.gameState, {
    message: `${playerName} is ready for the initial peek.`,
    type: 'player_action',
    actorId: playerId // actorId is still useful for potential client-side logic even if name is in message
  });

  return { success: true, updatedGameState: gameRoom.gameState, peekJustStarted: false };
};

export const generatePlayerView = (
  fullGameState: ServerCheckGameState,
  viewingPlayerId: string,
  // Optional parameter for temporary card reveals (e.g., for K/Q peek)
  temporaryReveals?: { [playerId: string]: { [cardIndex: number]: Card } }
): ClientCheckGameState => {
  const clientPlayers: { [playerID: string]: ClientPlayerState } = {};

  for (const pId in fullGameState.players) {
    const serverPlayerState = fullGameState.players[pId];
    let clientHand: ClientCard[];

    const revealsForThisPlayer = temporaryReveals?.[pId];

    if (pId === viewingPlayerId) {
      clientHand = serverPlayerState.hand.map((card, index) => {
        // SERVER-SIDE LOGGING FOR PLAYER VIEWING THEIR OWN HAND
        console.log(`[DEBUG_generatePlayerView] Player ${pId} viewing own hand. Card[${index}]: ID=${card.id}, isFaceDownToOwner=${card.isFaceDownToOwner}, RawCard: ${JSON.stringify(card)}`);

        // If the card is marked as face-down to the owner, send it as a HiddenCard
        if (card.isFaceDownToOwner) {
          return { 
            isHidden: true, 
            id: card.id || `${pId}-hidden-facedown-${index}` // Generate ID if needed
          };
        }
        // Otherwise, send the full card details
        return {
          ...card, 
          id: card.id || `${pId}-card-${index}` // Use existing ID if present, else generate
        };
      });
    } else {
      clientHand = serverPlayerState.hand.map((card, index) => {
        if (revealsForThisPlayer?.[index]) {
          const revealedCard = revealsForThisPlayer[index];
          return {
            ...revealedCard,
            id: revealedCard.id || `${pId}-revealed-${index}` // Use existing ID if present
          };
        }
        return { 
          isHidden: true, 
          id: `${pId}-hidden-${index}` // Hidden cards always get a generated ID based on position
        };
      });
    }
    
    let cardsToPeekForClient: Card[] | null = null;
    if (pId === viewingPlayerId && serverPlayerState.cardsToPeek) {
        // Ensure cardsToPeek also have IDs, though they are raw Cards from server state
        // They might be used in UI elements expecting IDs.
        cardsToPeekForClient = serverPlayerState.cardsToPeek.map((c, idx) => ({
            ...c,
            id: c.id || `${pId}-peek-${idx}`
        }));
    }

    let clientPendingDrawnCard: ClientCard | null = null;
    if (pId === viewingPlayerId) {
      if (serverPlayerState.pendingDrawnCard) {
        if (!('isHidden' in serverPlayerState.pendingDrawnCard)) {
          const pdc = serverPlayerState.pendingDrawnCard as Card;
          clientPendingDrawnCard = {
            ...pdc,
            id: pdc.id || `${pId}-pendingdrawn-${pdc.rank}-${pdc.suit}` // Assign ID if missing
          };
        } else {
          // This case should ideally not happen if it's a known card for viewing player,
          // but handle if it's somehow a HiddenCard type from server state.
          clientPendingDrawnCard = {
            ...serverPlayerState.pendingDrawnCard,
            id: (serverPlayerState.pendingDrawnCard as HiddenCard).id || `${pId}-pendinghidden`
          };
        }
      }
    } else {
      clientPendingDrawnCard = serverPlayerState.pendingDrawnCard 
        ? { isHidden: true, id: `pending-hidden-${pId}` } 
        : null;
    }

    clientPlayers[pId] = {
      hand: clientHand,
      hasUsedInitialPeek: serverPlayerState.hasUsedInitialPeek,
      isReadyForInitialPeek: serverPlayerState.isReadyForInitialPeek,
      hasCompletedInitialPeek: serverPlayerState.hasCompletedInitialPeek,
      cardsToPeek: cardsToPeekForClient, 
      peekAcknowledgeDeadline: pId === viewingPlayerId ? serverPlayerState.peekAcknowledgeDeadline : null,
      
      pendingDrawnCard: clientPendingDrawnCard, // Use the processed one with ID
      pendingDrawnCardSource: pId === viewingPlayerId ? serverPlayerState.pendingDrawnCardSource : null,
      
      pendingSpecialAbility: serverPlayerState.pendingSpecialAbility, 
      
      hasCalledCheck: serverPlayerState.hasCalledCheck,
      isLocked: serverPlayerState.isLocked,
      score: serverPlayerState.score,
      name: serverPlayerState.name,
      isConnected: serverPlayerState.isConnected,
      numMatches: serverPlayerState.numMatches, 
      numPenalties: serverPlayerState.numPenalties, 
      explicitlyRevealedCards: undefined, 
      forfeited: serverPlayerState.forfeited, // Pass through forfeited status
      turnTimerExpiresAt: fullGameState.playerTimers?.[pId]?.turnTimerExpiresAt,
      disconnectGraceTimerExpiresAt: fullGameState.playerTimers?.[pId]?.disconnectGraceTimerExpiresAt,
    };

    if (pId !== viewingPlayerId && revealsForThisPlayer) {
      clientPlayers[pId].explicitlyRevealedCards = { ...revealsForThisPlayer };
    }
  }

  const topDiscardCard = fullGameState.discardPile.length > 0 ? fullGameState.discardPile[0] : null;
  let isTopDiscardActuallySpecial = false; 
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
              hand.map((card, index) => ({ 
                ...card, 
                id: card.id || `${pId}-finalhand-${index}-${card.suit}-${card.rank}`
              }))
            ])
          )
        : undefined,
      playerStats: fullGameState.gameover.playerStats
        ? Object.fromEntries(
            Object.entries(fullGameState.gameover.playerStats).map(([pId, stats]) => [
                pId,
                {
                    ...stats,
                    name: stats.name || fullGameState.players[pId]?.name || `P-${pId.slice(-4)}`
                }
            ])
        )
        : undefined
    };
  }

  // Ensure all cards in the discard pile have IDs
  const clientDiscardPile = fullGameState.discardPile.map((card, index) => ({
    ...card,
    id: card.id || `discard-${index}-${card.rank}-${card.suit}` // Assign ID if missing
  }));

  const clientGameState: ClientCheckGameState = {
    ...fullGameState,
    deckSize: fullGameState.deck.length, 
    players: clientPlayers, 
    topDiscardIsSpecialOrUnusable: topDiscardFlagForClient,

    discardPile: clientDiscardPile, // Use the processed discard pile with IDs
    discardPileIsSealed: fullGameState.discardPileIsSealed,
    matchingOpportunityInfo: fullGameState.matchingOpportunityInfo, 
    playerWhoCalledCheck: fullGameState.playerWhoCalledCheck,
    roundWinner: fullGameState.roundWinner,
    finalTurnsTaken: fullGameState.finalTurnsTaken,
    initialPeekAllReadyTimestamp: fullGameState.initialPeekAllReadyTimestamp,
    globalAbilityTargets: fullGameState.globalAbilityTargets, // Pass through the new field
    
    currentPhase: fullGameState.currentPhase,
    currentPlayerId: fullGameState.currentPlayerId,
    turnOrder: fullGameState.turnOrder,
    gameMasterId: fullGameState.gameMasterId,
    activePlayers: fullGameState.activePlayers, 
    pendingAbilities: fullGameState.pendingAbilities, 
    gameover: clientGameOverData, 
    matchResolvedDetails: fullGameState.matchResolvedDetails, 

    viewingPlayerId: viewingPlayerId, 
  };
  
  delete (clientGameState as any).deck; 
  delete (clientGameState as any).lastResolvedAbilityCardForCleanup;
  delete (clientGameState as any).lastResolvedAbilitySource; // Also remove this one as it's in the Omit for ClientCheckGameState

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
    console.log(`[GameManager] Player ${player.name || playerId} in game ${gameId} marked as disconnected. Last socket ID: ${player.socketId}`);
    
    // Start disconnect grace timer only if the player is not already forfeited.
    if (!player.forfeited) {
      startDisconnectGraceTimer(gameId, playerId);
      // Emit a public log that the player has disconnected and has a grace period
      const playerName = getPlayerNameForLog(playerId, gameRoom.gameState);
      emitLogEntry(
        gameId,
        gameRoom.gameState,
        {
          message: `${playerName} has disconnected. They have a grace period to rejoin.`,
          type: 'game_event',
          actorId: playerId
        }
      );
    } else {
      // Emit a public log that a forfeited player (who might have briefly reconnected then DCd again) has disconnected
      const playerName = getPlayerNameForLog(playerId, gameRoom.gameState); // Get name again for this scope
      emitLogEntry(
        gameId,
        gameRoom.gameState,
        {
          message: `${playerName} has disconnected (was already forfeited).`,
          type: 'game_event',
          actorId: playerId
        }
      );
    } 

    activeGames[gameId] = gameRoom; 
    // The broadcastService.triggerBroadcast will be called by index.ts after this function returns,
    // and it will include the updated gameState with disconnectGraceTimerExpiresAt if set.
    return { success: true, updatedGameState: gameRoom.gameState, playerWasFound: true };
  }
  return { success: false, playerWasFound: false };
};

export const attemptRejoin = (
  gameId: string, 
  playerId: string, 
  newSocketId: string
): { success: boolean; message?: string; gameState?: ServerCheckGameState, initialLogsForRejoiner?: RichGameLogMessage[] } => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) {
    return { success: false, message: "Game not found." };
  }

  const playerState = gameRoom.gameState.players[playerId];
  if (!playerState) {
    return { success: false, message: "Player ID not found in this game." };
  }

  if (playerState.forfeited) {
    return { success: false, message: "Cannot rejoin: player is forfeited." };
  }

  // Restore existing logic for logging different rejoin scenarios
  if (playerState.isConnected && playerState.socketId !== newSocketId) {
    console.warn(`[GameManager] Player ${playerState.name || playerId} (Game ${gameId}) is rejoining with new socket ${newSocketId}, but was already connected with socket ${playerState.socketId}. Updating to new socket ID.`);
  } else if (playerState.isConnected && playerState.socketId === newSocketId) {
     console.log(`[GameManager] Player ${playerState.name || playerId} (Game ${gameId}) rejoining with same socket ${newSocketId} and already connected. No state change.`);
     // Still send initial logs even if already connected, as client might have refreshed
  } else if (!playerState.isConnected) {
     console.log(`[GameManager] Player ${playerState.name || playerId} (Game ${gameId}) was disconnected, rejoining with socket ${newSocketId}.`);
  }

  playerState.isConnected = true;
  playerState.socketId = newSocketId;

  if (!playerState.forfeited) { 
    clearDisconnectGraceTimer(gameId, playerId); 
  }

  // Emit a public log that the player has reconnected
  const playerName = getPlayerNameForLog(playerId, gameRoom.gameState);
  emitLogEntry(
    gameId,
    gameRoom.gameState,
    {
      message: `${playerName} has reconnected.`,
      type: 'game_event',
      actorId: playerId
    }
  );

  activeGames[gameId] = gameRoom;

  const welcomeMessage: RichGameLogMessage = {
    message: `Welcome back, ${playerState.name || playerId.slice(-4)}! You've rejoined Game ${gameId.slice(-6)}.`,
    type: 'system',
    timestamp: new Date().toISOString() // CHANGED HERE
  };
  const recentLogs = gameRoom.gameState.logHistory?.slice(-NUM_RECENT_LOGS_ON_JOIN_REJOIN) || [];
  const initialLogsForRejoiner = [welcomeMessage, ...recentLogs.filter(log => log.message !== welcomeMessage.message)];

  console.log(`[GameManager] Player ${playerState.name || playerId} successfully rejoined game ${gameId} with new socket ID ${newSocketId}.`);
  return { 
    success: true, 
    message: "Rejoined successfully.", 
    gameState: gameRoom.gameState, 
    initialLogsForRejoiner // Add this to the return payload
  };
};

// Placeholder for playerSetupData, this should align with what the client sends when creating/joining a game.
// We'll need to define how players are identified (e.g. socket.id, or a persistent user ID if you have auth)
// For now, this is a minimal structure.
// export interface PlayerSetupInfo {
//   id: string; // e.g., socket.id or a user-chosen ID if unique
//   name?: string;
// } 

// New function to handle client's request to see peeked cards
export const handleRequestPeekReveal = (
  gameId: string,
  requestingPlayerId: string,
  peekTargets: Array<{ playerID: string; cardIndex: number }>
): { success: boolean; message?: string; updatedPlayerSpecificGameState?: ClientCheckGameState } => {
  const room = getGameRoom(gameId);
  if (!room) return { success: false, message: "Game room not found." };
  if (room.gameState.currentPhase !== 'abilityResolutionPhase') {
    return { success: false, message: "Not in ability resolution phase." };
  }
  const pendingAbility = room.gameState.pendingAbilities.find(pa => pa.playerId === requestingPlayerId);
  if (!pendingAbility || (pendingAbility.card.rank !== Rank.King && pendingAbility.card.rank !== Rank.Queen) || pendingAbility.currentAbilityStage !== 'peek') {
    return { success: false, message: "No valid peek ability pending or not in peek stage." };
  }

  // Basic validation: Ensure targets are within bounds and not locked (if applicable to your rules)
  for (const target of peekTargets) {
    const targetPlayerState = room.gameState.players[target.playerID];
    if (!targetPlayerState || target.cardIndex < 0 || target.cardIndex >= targetPlayerState.hand.length) {
      return { success: false, message: "Invalid peek target: Card index out of bounds or player not found." };
    }
    // Add any other validation for locked players if necessary based on game rules
  }

  // Update global targets for all players to see (icons)
  room.gameState.globalAbilityTargets = peekTargets.map(t => ({ ...t, type: 'peek' }));
  
  // SERVER LOGGING POINT
  console.log(`[SERVER_DEBUG_GAT] GameID: ${gameId}, Player ${requestingPlayerId} requested peek. globalAbilityTargets set to:`, JSON.stringify(room.gameState.globalAbilityTargets));

  // Log the peek action
  const requestingPlayerName = getPlayerNameForLog(requestingPlayerId, room.gameState);
  const abilityCardRank = pendingAbility.card.rank;
  
  // Consolidate peek targets for a more readable log message
  const peekTargetSummary: { [playerName: string]: number } = {};
  peekTargets.forEach(target => {
    const targetPlayerName = getPlayerNameForLog(target.playerID, room.gameState);
    peekTargetSummary[targetPlayerName] = (peekTargetSummary[targetPlayerName] || 0) + 1;
  });
  
  const summaryParts: string[] = [];
  for (const [playerName, count] of Object.entries(peekTargetSummary)) {
    summaryParts.push(`${count} card${count > 1 ? 's' : ''} from ${playerName}`);
  }
  const peekDetails = summaryParts.join(' and ');

  emitLogEntry(gameId, room.gameState, {
    message: `used ${abilityCardRank} to peek at ${peekDetails}.`,
    type: 'player_action',
    actorId: requestingPlayerId,
    cardContext: `${abilityCardRank} peek`
  });

  // broadcastService.triggerBroadcast(gameId, room.gameState); // << REMOVE THIS LINE

  // For the requesting player, we send a more immediate state update with the revealed cards.
  const temporaryReveals: { [playerId: string]: { [cardIndex: number]: Card } } = {};
  peekTargets.forEach(target => {
    if (!temporaryReveals[target.playerID]) {
      temporaryReveals[target.playerID] = {};
    }
    const targetCard = room.gameState.players[target.playerID]?.hand[target.cardIndex];
    if (targetCard && !('isHidden' in targetCard)) { // Ensure it's a real card
      temporaryReveals[target.playerID][target.cardIndex] = targetCard as Card;
    }
  });

  const playerSpecificView = generatePlayerView(room.gameState, requestingPlayerId, temporaryReveals);

  return { success: true, message: "Peek targets registered. Card data included in your updated game state.", updatedPlayerSpecificGameState: playerSpecificView };
};

// Helper function to be called at the beginning of phases or actions that should clear transient global targets
const clearGlobalAbilityTargetsIfNeeded = (gameState: ServerCheckGameState) => {
    console.log(`[GameManager-ClearGATs-ENTRY] Called. Current GATs:`, JSON.stringify(gameState.globalAbilityTargets));
    if (!gameState.globalAbilityTargets) {
        console.log(`[GameManager-ClearGATs-EXIT] No GATs to clear.`);
        return;
    }

    const pendingAbility = gameState.pendingAbilities && gameState.pendingAbilities.length > 0 ? gameState.pendingAbilities[0] : null;
    console.log(`[GameManager-ClearGATs-INFO] Detected pendingAbility:`, pendingAbility ? `${pendingAbility.card.rank} by ${pendingAbility.playerId} stage: ${pendingAbility.currentAbilityStage}` : null);

    if (pendingAbility && 
        (pendingAbility.card.rank === Rank.King || pendingAbility.card.rank === Rank.Queen) && 
        pendingAbility.currentAbilityStage === 'swap') {
        
        if (gameState.globalAbilityTargets.every(t => t.type === 'peek')) {
            console.log('[GameManager-ClearGATs-DECISION] K/Q in swap stage. Clearing PEEK targets ONLY.');
            gameState.globalAbilityTargets = null;
        } else {
            console.log('[GameManager-ClearGATs-DECISION] K/Q in swap stage. GATs are not all peek (might be swap or mixed). Retaining GATs.');
            // If GATs are swap type, they were likely just set by K/Q swap resolution for broadcast, don't clear immediately.
        }
        console.log(`[GameManager-ClearGATs-EXIT] Exiting after K/Q swap stage check. GATs:`, JSON.stringify(gameState.globalAbilityTargets));
        return; 
    }

    console.log('[GameManager-ClearGATs-DECISION] Proceeding to general clear (not K/Q in swap stage, or no pending ability).');
    gameState.globalAbilityTargets = null;
    console.log(`[GameManager-ClearGATs-EXIT] Exiting after general clear. GATs set to null.`);
};

// NEW HELPER FUNCTION
const clearTransientVisualCues = (gameState: ServerCheckGameState) => {
    if (gameState.lastRegularSwapInfo) {
        console.log('[GameManager-ClearCues] Clearing lastRegularSwapInfo.');
        gameState.lastRegularSwapInfo = null;
    }
    // This function can be expanded to clear other transient cues in the future
};

// Example of use in setupNextPlayTurn (similar logic can be added to other phase setup functions)
// ... rest of the file (ensure all calls to clearGlobalAbilityTargetsIfNeeded are just clearGlobalAbilityTargetsIfNeeded(G) without other args)

// --- TIMER FUNCTIONS ---

const clearPlayerTimers = (gameId: string, playerId: string) => {
  const gameRoom = getGameRoom(gameId);
  const timerKey = `${gameId}_${playerId}`;

  if (activeTurnTimerIds.has(timerKey)) {
    clearTimeout(activeTurnTimerIds.get(timerKey)!);
    activeTurnTimerIds.delete(timerKey);
    console.log(`[GameManager-Timer] Cleared active turn timer for ${timerKey}`);
  }

  // Clear expiration from shared game state if it exists
  if (gameRoom && gameRoom.gameState.playerTimers && gameRoom.gameState.playerTimers[playerId]) {
    delete gameRoom.gameState.playerTimers[playerId].turnTimerExpiresAt;
    // If no other timer info exists for this player (e.g. disconnect timer), remove the player entry
    if (Object.keys(gameRoom.gameState.playerTimers[playerId]).length === 0) {
      delete gameRoom.gameState.playerTimers[playerId];
    }
    console.log(`[GameManager-Timer] Cleared turn timer expiration for player ${playerId} in game ${gameId} from gameState.`);
  }
  // We'll add disconnectGraceTimerId clearing later
};

const handleTurnTimeout = (gameId: string, playerId: string) => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) {
    console.warn(`[GameManager-Timer] handleTurnTimeout: Game ${gameId} not found.`);
    return;
  }
  const G = gameRoom.gameState;
  const player = G.players[playerId];
  const playerName = player?.name || playerId;

  // Ensure timer is cleared from the map and state
  const timerKey = `${gameId}_${playerId}`;
  if (activeTurnTimerIds.has(timerKey)) {
    clearTimeout(activeTurnTimerIds.get(timerKey)!);
    activeTurnTimerIds.delete(timerKey);
  }
  if (G.playerTimers && G.playerTimers[playerId] && G.playerTimers[playerId].turnTimerExpiresAt) {
    delete G.playerTimers[playerId].turnTimerExpiresAt;
    if (Object.keys(G.playerTimers[playerId]).length === 0) delete G.playerTimers[playerId];
  }

  // If game is in matching stage, individual turn timers are superseded by the global matching timer.
  if (G.currentPhase === 'matchingStage') {
    console.log(`[GameManager-Timer] handleTurnTimeout for ${playerName} in ${gameId}: Game is in matchingStage. Individual turn timer ignored. Timer might be stale.`);
    // Broadcast state to ensure client clears timer display if it was based on stale info
    broadcastService.triggerBroadcast(gameId, G);
    return; // Do not proceed with turn-specific timeout actions
  }

  if (!player || G.currentPhase === 'gameOver' || G.currentPhase === 'scoringPhase') {
    console.log(`[GameManager-Timer] handleTurnTimeout for ${playerName} in ${gameId}: Player not found, or game ended. Aborting timeout action.`);
    return;
  }

  // Check if it was actually this player's turn or active moment, otherwise, timer might be stale.
  let isPlayerActiveMoment = G.currentPlayerId === playerId;
  // If an ability is pending for THIS player (even if they are not G.currentPlayerId, though typically they would be)
  if (G.currentPhase === 'abilityResolutionPhase' && G.pendingAbilities && G.pendingAbilities.length > 0 && G.pendingAbilities[0].playerId === playerId) {
    isPlayerActiveMoment = true; // Their "turn" to resolve ability
  }

  if (!isPlayerActiveMoment) {
    console.log(`[GameManager-Timer] handleTurnTimeout for ${playerName} in ${gameId}: Not player's active moment (Phase: ${G.currentPhase}, CurrentPlayer: ${G.players[G.currentPlayerId]?.name || G.currentPlayerId}, Current Segment: ${G.currentTurnSegment}). Timer might be stale. No action taken.`);
    // Broadcast state to ensure client clears timer display if it was based on stale info
    broadcastService.triggerBroadcast(gameId, G);
    return;
  }

  console.log(`[GameManager-Timer] Turn timed out for player ${playerName} in game ${gameId}. Current phase: ${G.currentPhase}. Taking default action.`);

  let nextState: ServerCheckGameState | null = null;
  let broadcastManuallyAfterDefaultAction = false;
  let timeoutLogMessage = `timed out.`; // Default log message part

  // --- Start: Segment-aware Timeout Logic ---
  const currentSegment = G.currentTurnSegment;
  G.currentTurnSegment = null; // Clear segment as part of timeout processing
  // Timer ID and expiration in G.playerTimers already cleared by caller (handleTurnTimeout) or will be by clearPlayerTimers here

  if (currentSegment === 'initialAction') {
    console.log(`[GameManager-Timer] Player ${playerName} timed out during 'initialAction' segment.`);
    timeoutLogMessage = `timed out during their initial action.`
    // Player did nothing, simply advance the turn.
    clearPlayerTimers(gameId, playerId); // Ensure all timer aspects are cleared

    if (G.playerWhoCalledCheck) {
      nextState = continueOrEndFinalTurns(gameId);
    } else {
      nextState = setupNextPlayTurn(gameId);
    }
  } else if (currentSegment === 'postDrawAction') {
    console.log(`[GameManager-Timer] Player ${playerName} timed out during 'postDrawAction' segment.`);
    clearPlayerTimers(gameId, playerId); // Ensure all timer aspects are cleared
    timeoutLogMessage = `timed out after drawing a card.`

    if (player.pendingDrawnCard) {
      const cardHeld = player.pendingDrawnCard;
      const cardHeldStr = `${cardHeld.rank}${suitSymbols[cardHeld.suit] || cardHeld.suit}`;
      if (player.pendingDrawnCardSource === 'deck') {
        console.log(`[GameManager-Timer] Player ${playerName} timed out with card ${cardHeldStr} from deck. Auto-discarding.`);
        timeoutLogMessage = `timed out and their drawn card ${cardHeldStr} was automatically discarded.`
        handleDiscardDrawnCard(gameId, playerId); // This will broadcast and internally call setupNextPlayTurn/continueOrEndFinalTurns
      } else if (player.pendingDrawnCardSource === 'discard') {
        console.log(`[GameManager-Timer] Player ${playerName} timed out with card ${cardHeldStr} from discard. Attempting auto-swap with first hand card.`);
        timeoutLogMessage = `timed out with drawn card ${cardHeldStr} (from discard).`
        if (player.hand.length === 0) {
          console.error(`[GameManager-Timer] Player ${playerName} has no cards in hand to auto-swap with ${cardHeldStr} from discard. Discarding drawn card as fallback.`);
          G.discardPile.unshift(player.pendingDrawnCard);
          player.pendingDrawnCard = null;
          player.pendingDrawnCardSource = null;
          G.discardPileIsSealed = false;
          timeoutLogMessage += ` Card ${cardHeldStr} was discarded as no hand cards were available for swap.`;
          broadcastManuallyAfterDefaultAction = true;
        } else {
          const cardFromHand = player.hand.splice(0, 1, player.pendingDrawnCard)[0];
          const cardFromHandStr = `${cardFromHand.rank}${suitSymbols[cardFromHand.suit] || cardFromHand.suit}`;
          player.pendingDrawnCard = null;
          player.pendingDrawnCardSource = null;
          G.discardPile.unshift(cardFromHand);
          G.discardPileIsSealed = false;
          console.log(`[GameManager-Timer] Auto-swapped. Card from hand ${cardFromHandStr} discarded. No matching/ability triggered.`);
          timeoutLogMessage += ` Card ${cardHeldStr} was kept, and ${cardFromHandStr} from hand was discarded.`;
          broadcastManuallyAfterDefaultAction = true;
        }
        // After this auto-swap/discard, the turn ends for this player.
        if (G.playerWhoCalledCheck) {
          nextState = continueOrEndFinalTurns(gameId);
        } else {
          nextState = setupNextPlayTurn(gameId);
        }
      }
    } else {
      // Should not happen if in 'postDrawAction' segment, but as a fallback:
      console.warn(`[GameManager-Timer] Player ${playerName} in 'postDrawAction' but no pending card. Advancing turn.`);
      if (G.playerWhoCalledCheck) {
        nextState = continueOrEndFinalTurns(gameId);
      } else {
        nextState = setupNextPlayTurn(gameId);
      }
    }
  } else { // currentSegment is null or an unexpected value (e.g. during ability, matching)
    // This part handles timeouts for actions that are NOT part of the two main turn segments,
    // or if the segment was already nullified.
    console.log(`[GameManager-Timer] Player ${playerName} timed out. Segment was '${currentSegment}'. Applying generic timeout logic.`);
    clearPlayerTimers(gameId, playerId); // Ensure all timer aspects are cleared

    if (G.currentPhase === 'abilityResolutionPhase' && G.pendingAbilities && G.pendingAbilities.length > 0 && G.pendingAbilities[0].playerId === playerId) {
      const abilityTimedOut = G.pendingAbilities[0];
      const abilityStr = `${abilityTimedOut.card.rank}${suitSymbols[abilityTimedOut.card.suit] || abilityTimedOut.card.suit}`;
      console.log(`[GameManager-Timer] Player ${playerName} timed out during ability resolution for ${abilityStr}. Auto-skipping ability.`);
      timeoutLogMessage = `timed out and their ${abilityStr} ability was automatically skipped.`
      handleResolveSpecialAbility(gameId, playerId, { skipAbility: true, skipType: 'full' });
    // This block is unreachable because of the early return if G.currentPhase is 'matchingStage'
    // } else if (G.currentPhase === 'matchingStage' && G.activePlayers[playerId]) { 
    //   console.log(`[GameManager-Timer] Player ${playerName} timed out during matching stage for card ${G.matchingOpportunityInfo?.cardToMatch.rank}${G.matchingOpportunityInfo?.cardToMatch.suit}. Auto-passing.`);
    //   handlePassMatch(gameId, playerId);
    } else if (player.pendingDrawnCard) { // Fallback if segment was null but card is held (should be rare)
        const cardHeld = player.pendingDrawnCard;
        const cardHeldStr = `${cardHeld.rank}${suitSymbols[cardHeld.suit] || cardHeld.suit}`;
        if (player.pendingDrawnCardSource === 'deck') {
            console.log(`[GameManager-Timer] Player ${playerName} (segment: ${currentSegment}) timed out with card ${cardHeldStr} from deck. Auto-discarding.`);
            timeoutLogMessage = `timed out and their drawn card ${cardHeldStr} was automatically discarded.`
            handleDiscardDrawnCard(gameId, playerId);
        } else { // discard source, or unknown but has card
            console.log(`[GameManager-Timer] Player ${playerName} (segment: ${currentSegment}) timed out with card ${cardHeldStr}. Attempting auto-swap with first hand card or discard.`);
            timeoutLogMessage = `timed out holding ${cardHeldStr}.`
            if (player.hand.length === 0) {
                G.discardPile.unshift(player.pendingDrawnCard);
                player.pendingDrawnCard = null; player.pendingDrawnCardSource = null; G.discardPileIsSealed = false;
                timeoutLogMessage += ` Card ${cardHeldStr} was discarded as no hand cards were available for swap.`;
                broadcastManuallyAfterDefaultAction = true;
            } else {
                const cardFromHand = player.hand.splice(0, 1, player.pendingDrawnCard)[0];
                const cardFromHandStr = `${cardFromHand.rank}${suitSymbols[cardFromHand.suit] || cardFromHand.suit}`;
                player.pendingDrawnCard = null; player.pendingDrawnCardSource = null;
                G.discardPile.unshift(cardFromHand); G.discardPileIsSealed = false;
                timeoutLogMessage += ` Card ${cardHeldStr} was kept, and ${cardFromHandStr} from hand was discarded.`;
                broadcastManuallyAfterDefaultAction = true;
            }
            if (G.playerWhoCalledCheck) nextState = continueOrEndFinalTurns(gameId);
            else nextState = setupNextPlayTurn(gameId);
        }
    } else if (G.currentPhase === 'playPhase' || G.currentPhase === 'finalTurnsPhase') {
      console.log(`[GameManager-Timer] Player ${playerName} (segment: ${currentSegment}) timed out in ${G.currentPhase} (no card held, no specific action pending). Skipping turn.`);
      if (G.playerWhoCalledCheck) {
        nextState = continueOrEndFinalTurns(gameId);
      } else {
        nextState = setupNextPlayTurn(gameId);
      }
    } else {
      console.warn(`[GameManager-Timer] Turn timeout for ${playerName} (segment: ${currentSegment}) in unhandled situation or phase: ${G.currentPhase}. Attempting generic turn advance.`);
      if (G.playerWhoCalledCheck) {
        nextState = continueOrEndFinalTurns(gameId);
      } else {
        timeoutLogMessage = `timed out during ${G.currentPhase}.`;
        nextState = setupNextPlayTurn(gameId);
      }
    }
  }
  // --- End: Segment-aware Timeout Logic ---

  // Emit the consolidated log message for the timeout event
  const playerNameForLog = getPlayerNameForLog(playerId, G);
  emitLogEntry(gameId, G, {
    message: `${playerNameForLog} ${timeoutLogMessage}`,
    type: 'game_event',
    actorId: playerId
  });

  if (broadcastManuallyAfterDefaultAction) {
    // If a default action modified G directly (like auto-swap) and didn't call another handler that broadcasts.
    broadcastService.triggerBroadcast(gameId, G);
  }

  if (nextState) { // If a turn advancement function was called and returned a new state
    // These turn advancement functions (setupNextPlayTurn, continueOrEndFinalTurns)
    // already call startTurnTimer for the *next* player and broadcast.
    // No need to broadcast `nextState` here explicitly if it's the direct result of those calls,
    // as they handle their own broadcast. The primary broadcast here is for the `G` modified by the default action itself.
    // However, if `nextState` is different from `G` (e.g., game ended), it's already handled.
  }
  
  // Note: checkGameEndDueToForfeits is NOT called here anymore.
};

const startTurnTimer = (gameId: string, playerId: string) => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return;
  const G = gameRoom.gameState;
  const player = G.players[playerId];

  if (!player || player.forfeited || !player.isConnected) {
    console.log(`[GameManager-Timer] Cannot start turn timer for ${player.name || playerId} in ${gameId}: Player forfeited or not connected.`);
    return;
  }

  const timerKey = `${gameId}_${playerId}`;
  // Clear any existing timer ID from the map before setting a new one
  if (activeTurnTimerIds.has(timerKey)) {
    clearTimeout(activeTurnTimerIds.get(timerKey)!);
    activeTurnTimerIds.delete(timerKey); // Remove old key
  }

  // Set the expiration time on the shared game state
  if (!G.playerTimers) G.playerTimers = {};
  if (!G.playerTimers[playerId]) G.playerTimers[playerId] = {}; // Ensure player entry exists
  G.playerTimers[playerId].turnTimerExpiresAt = Date.now() + TURN_DURATION_MS;
  
  // Store the new timer ID in the server-local map
  activeTurnTimerIds.set(timerKey, setTimeout(() => handleTurnTimeout(gameId, playerId), TURN_DURATION_MS));
  
  console.log(`[GameManager-Timer] Started turn timer for player ${player.name || playerId} in game ${gameId}. Expires in ${TURN_DURATION_MS / 1000}s. Key: ${timerKey}`);
  
  // Optionally, broadcast updated G to let clients know about the new turnTimerExpiresAt
  broadcastService.triggerBroadcast(gameId, G);
};

const clearDisconnectGraceTimer = (gameId: string, playerId: string) => {
  const gameRoom = getGameRoom(gameId);
  const timerKey = `${gameId}_${playerId}`;

  if (activeDisconnectGraceTimerIds.has(timerKey)) {
    clearTimeout(activeDisconnectGraceTimerIds.get(timerKey)!);
    activeDisconnectGraceTimerIds.delete(timerKey);
    console.log(`[GameManager-Timer] Cleared active disconnect grace timer for ${timerKey}`);
  }

  if (gameRoom && gameRoom.gameState.playerTimers && gameRoom.gameState.playerTimers[playerId]) {
    delete gameRoom.gameState.playerTimers[playerId].disconnectGraceTimerExpiresAt;
    if (Object.keys(gameRoom.gameState.playerTimers[playerId]).length === 0) {
      delete gameRoom.gameState.playerTimers[playerId];
    }
    console.log(`[GameManager-Timer] Cleared disconnect grace timer expiration for player ${playerId} in game ${gameId} from gameState.`);
  }
};

const handleDisconnectTimeout = (gameId: string, playerId: string) => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) {
    console.warn(`[GameManager-Timer] handleDisconnectTimeout: Game ${gameId} not found.`);
    return;
  }
  const G = gameRoom.gameState;
  const player = G.players[playerId];

  // Clear timer ID from map and expiration from gameState
  const timerKey = `${gameId}_${playerId}`;
  if (activeDisconnectGraceTimerIds.has(timerKey)) {
    clearTimeout(activeDisconnectGraceTimerIds.get(timerKey)!);
    activeDisconnectGraceTimerIds.delete(timerKey);
  }
  if (G.playerTimers && G.playerTimers[playerId] && G.playerTimers[playerId].disconnectGraceTimerExpiresAt) {
    delete G.playerTimers[playerId].disconnectGraceTimerExpiresAt;
    if (Object.keys(G.playerTimers[playerId]).length === 0) delete G.playerTimers[playerId];
  }

  if (!player || player.forfeited || player.isConnected) {
    console.log(`[GameManager-Timer] handleDisconnectTimeout for ${player.name || playerId} in ${gameId}: Player not found, already forfeited, or reconnected. Aborting forfeit action.`);
    return;
  }

  console.log(`[GameManager-Timer] Disconnect grace period expired for player ${player.name || playerId} in game ${gameId}. Marking as forfeited.`);
  player.forfeited = true;
  // player.isConnected should already be false

  // Emit a public log that the player has forfeited
  const playerName = getPlayerNameForLog(playerId, G);
  emitLogEntry(
    gameId,
    G,
    {
      message: `${playerName} has forfeited the game due to inactivity.`,
      type: 'game_event',
      actorId: playerId
    }
  );

  broadcastService.triggerBroadcast(gameId, G); // Broadcast the forfeit update

  // Check if the game should end due to this forfeit
  if (checkGameEndDueToForfeits(gameId)) {
    console.log(`[GameManager-Timer] Game ${gameId} ended due to forfeits after player ${playerName} was marked forfeited by disconnect timeout.`);
    return; // Game has ended and scoring phase initiated by checkGameEndDueToForfeits
  }

  // After forfeiting, try to advance the game state if it was this player's turn or if their forfeit affects game flow
  // This is important so the game doesn't stall.
  let nextState: ServerCheckGameState | null = null;
  if (G.currentPlayerId === playerId) {
    console.log(`[GameManager-Timer] Disconnected player ${player.name || playerId} was current player. Advancing turn after forfeit.`);
    // Similar logic to handleTurnTimeout for advancing the game
    if (G.pendingAbilities && G.pendingAbilities.length > 0 && G.pendingAbilities[0].playerId === playerId) {
      handleResolveSpecialAbility(gameId, playerId, { skipAbility: true, skipType: 'full' });
    } else if (G.currentPhase === 'matchingStage' && G.activePlayers[playerId]) {
      handlePassMatch(gameId, playerId);
    } else if (G.currentPhase === 'playPhase' || G.currentPhase === 'finalTurnsPhase') {
      if (player.pendingDrawnCard) {
        handleDiscardDrawnCard(gameId, playerId);
      } else {
        if (G.playerWhoCalledCheck) {
          nextState = continueOrEndFinalTurns(gameId);
        } else {
          nextState = setupNextPlayTurn(gameId);
        }
      }
    } else {
      console.warn(`[GameManager-Timer] Disconnect timeout for current player ${player.name || playerId} in unhandled phase: ${G.currentPhase}. Attempting generic turn advance.`);
      if (G.playerWhoCalledCheck) {
        nextState = continueOrEndFinalTurns(gameId);
      } else {
        nextState = setupNextPlayTurn(gameId);
      }
    }
  } else {
    // If the disconnected player wasn't the current player, their forfeit might still affect turn order (e.g. if they were next).
    // Calling a general turn progression function can help recalculate.
    // However, if the game is in a state not expecting a turn progression (e.g. gameOver), do nothing more.
    if (G.currentPhase !== 'gameOver' && G.currentPhase !== 'scoringPhase'){
        console.log(`[GameManager-Timer] Disconnected player ${player.name || playerId} was not current player. Checking if game progression is needed.`);
        // Potentially, just a broadcast was enough. If their absence breaks a quorum for an action, that phase logic should handle it.
        // But if they were in turnOrder and now are forfeited, setupNextPlayTurn/continueOrEndFinalTurns will correctly skip them.
        // Re-evaluate if specific phase needs re-triggering here.
        // For now, the broadcast of their forfeit status is the main outcome if not current player.
    }
  }

  if (nextState) {
    broadcastService.triggerBroadcast(gameId, nextState); // Broadcast the new game state after advancing turn
  }
  // TODO: Add logic to check if game should end due to insufficient players after a forfeit.
};

const startDisconnectGraceTimer = (gameId: string, playerId: string) => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return;
  const G = gameRoom.gameState;
  const player = G.players[playerId];

  if (!player || player.forfeited || player.isConnected) { // Don't start if already forfeited or if they somehow reconnected before this fired
    console.log(`[GameManager-Timer] Cannot start disconnect grace timer for ${player.name || playerId} in ${gameId}: Player forfeited or already connected.`);
    return;
  }

  const timerKey = `${gameId}_${playerId}`;
  if (activeDisconnectGraceTimerIds.has(timerKey)) {
    clearTimeout(activeDisconnectGraceTimerIds.get(timerKey)!);
    activeDisconnectGraceTimerIds.delete(timerKey);
  }

  if (!G.playerTimers) G.playerTimers = {};
  if (!G.playerTimers[playerId]) G.playerTimers[playerId] = {};
  G.playerTimers[playerId].disconnectGraceTimerExpiresAt = Date.now() + DISCONNECT_GRACE_PERIOD_MS;

  activeDisconnectGraceTimerIds.set(timerKey, setTimeout(() => handleDisconnectTimeout(gameId, playerId), DISCONNECT_GRACE_PERIOD_MS));
  console.log(`[GameManager-Timer] Started disconnect grace timer for player ${player.name || playerId} in game ${gameId}. Expires in ${DISCONNECT_GRACE_PERIOD_MS / 1000}s. Key: ${timerKey}`);
  
  // Broadcast the updated gameState with the disconnectGraceTimerExpiresAt
  broadcastService.triggerBroadcast(gameId, G);
};

const clearAllGameTimers = (gameId: string) => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return;

  console.log(`[GameManager-Timer] Clearing ALL timers for game ${gameId} due to game end or critical phase change.`);
  // Iterate over all players who might have timers, typically from turnOrder or players object keys
  const playerIds = Object.keys(gameRoom.gameState.players);

  playerIds.forEach(playerId => {
    const turnTimerKey = `${gameId}_${playerId}`;
    if (activeTurnTimerIds.has(turnTimerKey)) {
      clearTimeout(activeTurnTimerIds.get(turnTimerKey)!);
      activeTurnTimerIds.delete(turnTimerKey);
    }
    const disconnectTimerKey = `${gameId}_${playerId}`;
    if (activeDisconnectGraceTimerIds.has(disconnectTimerKey)) {
      clearTimeout(activeDisconnectGraceTimerIds.get(disconnectTimerKey)!);
      activeDisconnectGraceTimerIds.delete(disconnectTimerKey);
    }
  });
  // Clear all timer expirations from the shared game state
  if (gameRoom.gameState.playerTimers) {
    gameRoom.gameState.playerTimers = {};
  }
  clearMatchingStageTimer(gameId); // Also clear the global matching stage timer
  // Note: A broadcast might be needed if playerTimers being empty is significant for clients immediately.
  // However, usually this is part of a larger state transition (like scoring) which will broadcast anyway.
};

const checkGameEndDueToForfeits = (gameId: string): boolean => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return false; // Game not found, can't end it.
  const G = gameRoom.gameState;

  if (G.currentPhase === 'gameOver' || G.currentPhase === 'scoringPhase') {
    return false; // Game is already ending or over.
  }

  const activeNonForfeitedPlayers = G.turnOrder.filter(playerId => {
    const player = G.players[playerId];
    // A player is considered active for continuing the game if they are not forfeited.
    // Connection status is handled by the disconnect grace timer; if that expires, they forfeit.
    return player && !player.forfeited;
  });

  // Game ends if fewer than 2 players are left non-forfeited.
  // Adjust this threshold as per game rules (e.g., 1 if a solo win is possible).
  const MIN_PLAYERS_TO_CONTINUE = 2;
  if (activeNonForfeitedPlayers.length < MIN_PLAYERS_TO_CONTINUE) {
    console.log(`[GameManager-ForfeitEndCheck] Game ${gameId} ending: ${activeNonForfeitedPlayers.length} non-forfeited players (less than ${MIN_PLAYERS_TO_CONTINUE}). Proceeding to scoring.`);
    clearAllGameTimers(gameId); // Clear all active timers for the game
    setupScoringPhase(gameId); // This will set phase to gameOver and broadcast
    // setupScoringPhase itself will call clearAllGameTimers again, but it's safe.
    return true; // Game ended
  }
  return false; // Game continues
};

const handleMatchingStageTimeout = (gameId: string) => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) {
    console.warn(`[GameManager-Timer] handleMatchingStageTimeout: Game ${gameId} not found.`);
    return;
  }
  const G = gameRoom.gameState;

  // Clear timer ID from map and expiration from gameState
  if (activeMatchingStageTimer.has(gameId)) {
    clearTimeout(activeMatchingStageTimer.get(gameId)!);
    activeMatchingStageTimer.delete(gameId);
  }
  delete G.matchingStageTimerExpiresAt;

  if (G.currentPhase !== 'matchingStage' || !G.matchingOpportunityInfo) {
    console.log(`[GameManager-Timer] handleMatchingStageTimeout for game ${gameId}: Not in matching stage or no opportunity. Aborting auto-pass.`);
    // The expiration is already cleared above. We just need to broadcast.
    broadcastService.triggerBroadcast(gameId, G);
    return;
  }

  console.log(`[GameManager-Timer] Matching stage timed out for game ${gameId}. Auto-passing remaining players.`);

  const { cardToMatch, originalPlayerID, potentialMatchers } = G.matchingOpportunityInfo;
  let broadcastNeeded = false;

  // Log that the matching stage timed out
  if (cardToMatch && originalPlayerID) {
    const cardStr = `${cardToMatch.rank}${suitSymbols[cardToMatch.suit] || cardToMatch.suit}`;
    const originalPlayerName = getPlayerNameForLog(originalPlayerID, G);
    emitLogEntry(gameId, G, {
      message: `Matching stage for ${cardStr} (discarded by ${originalPlayerName}) timed out. Auto-passing remaining players.`,
      type: 'game_event',
      cardContext: cardStr
    });
  }

  potentialMatchers.forEach(playerId => {
    if (G.activePlayers[playerId]) {
      console.log(`[GameManager-Timer] Auto-passing player ${G.players[playerId]?.name || playerId} in game ${gameId} for matching stage timeout.`);
      // Directly manipulate state as handlePassMatch would, then let one final checkMatchingStageEnd process.
      delete G.activePlayers[playerId];
      // Note: We are not calling handlePassMatch for each player to avoid multiple broadcasts
      // and potential race conditions. We modify the state here and then call checkMatchingStageEnd once.
      broadcastNeeded = true;
    }
  });

  if (broadcastNeeded) {
    // After all auto-passes, call checkMatchingStageEnd to process the end of the matching stage.
    const nextState = checkMatchingStageEnd(gameId);
    if (nextState) {
      broadcastService.triggerBroadcast(gameId, nextState); // Broadcast the final state after auto-passes
    }
  } else {
    console.log(`[GameManager-Timer] Matching stage timeout for game ${gameId}, but no players needed auto-passing.`);
    // Still, good to ensure the timer value is cleared from client view if it was showing
    broadcastService.triggerBroadcast(gameId, G);
  }
};

const startMatchingStageTimer = (gameId: string) => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom || gameRoom.gameState.currentPhase !== 'matchingStage') {
    console.warn(`[GameManager-Timer] Cannot start matching stage timer for game ${gameId}: Not in matching stage or game not found.`);
    return;
  }
  const G = gameRoom.gameState;

  if (activeMatchingStageTimer.has(gameId)) {
    clearTimeout(activeMatchingStageTimer.get(gameId)!);
    activeMatchingStageTimer.delete(gameId);
  }

  G.matchingStageTimerExpiresAt = Date.now() + MATCHING_STAGE_DURATION_MS;
  activeMatchingStageTimer.set(gameId, setTimeout(() => handleMatchingStageTimeout(gameId), MATCHING_STAGE_DURATION_MS));
  console.log(`[GameManager-Timer] Started matching stage timer for game ${gameId}. Expires in ${MATCHING_STAGE_DURATION_MS / 1000}s.`);
  // Broadcast state so clients know about the timer
  broadcastService.triggerBroadcast(gameId, G);
};

const clearMatchingStageTimer = (gameId: string) => {
  const gameRoom = getGameRoom(gameId);
  if (activeMatchingStageTimer.has(gameId)) {
    clearTimeout(activeMatchingStageTimer.get(gameId)!);
    activeMatchingStageTimer.delete(gameId);
    console.log(`[GameManager-Timer] Cleared active matching stage timer for game ${gameId}`);
  }
  if (gameRoom && gameRoom.gameState.matchingStageTimerExpiresAt) {
    delete gameRoom.gameState.matchingStageTimerExpiresAt;
    console.log(`[GameManager-Timer] Cleared matching stage timer expiration for game ${gameId} from gameState.`);
    // No need to broadcast here, the function that calls this (e.g. checkMatchingStageEnd) will broadcast the overall state change.
  }
};

// Add suitSymbols definition
const suitSymbols: { [key: string]: string } = {
  H: '♥',
  D: '♦',
  C: '♣',
  S: '♠',
};

