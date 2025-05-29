import { Card, Suit, Rank, PlayerState, CheckGameState as ServerCheckGameState, InitialPlayerSetupData, cardValues, HiddenCard, ClientCard, ClientPlayerState, ClientCheckGameState, SpecialAbilityInfo, PendingSpecialAbility } from 'shared-types';

const PEEK_COUNTDOWN_SECONDS = 5; // Define based on typical client value or make configurable
const PEEK_REVEAL_SECONDS = 5;    // Define based on typical client value or make configurable

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
  if (numPlayers < 1 || numPlayers > 4) { // Changed from < 2 to < 1 to allow 1 player to create
    console.error(`[GameManager] Invalid number of players: ${numPlayers} for game ${gameId}`);
    return null; // Ensure null is returned if invalid number of players
  }

  const deck = createDeck();
  const shuffledDeck = simpleShuffle(deck);

  const initialPlayers: { [playerID: string]: PlayerState } = {};
  playerSetupData.forEach((playerInfo) => {
    const playerId = playerInfo.id;
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
  playerInfo: InitialPlayerSetupData
): { success: boolean; message?: string; gameRoom?: GameRoom, newPlayerState?: PlayerState } => {
  const gameRoom = getGameRoom(gameId);

  if (!gameRoom) {
    return { success: false, message: "Game not found." };
  }

  if (gameRoom.gameState.players[playerInfo.id]) {
    return { success: true, message: "Player already in game.", gameRoom };
  }

  const currentNumPlayers = Object.keys(gameRoom.gameState.players).length;
  if (currentNumPlayers >= 4) { 
    return { success: false, message: "Game is full." };
  }

  const newPlayerState: PlayerState = {
    hand: [], 
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

  const card = gameRoom.gameState.discardPile.pop();
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

  const discardedCard = player.hand[handIndex];
  player.hand[handIndex] = player.pendingDrawnCard;
  player.pendingDrawnCard = null;
  player.pendingDrawnCardSource = null;
  gameRoom.gameState.discardPile.push(discardedCard);

  const potentialMatchers = Object.keys(gameRoom.gameState.players).filter(pId => {
    const p = gameRoom.gameState.players[pId];
    return pId !== playerId && p && !p.isLocked && !p.hasCalledCheck;
  });

  gameRoom.gameState.matchingOpportunityInfo = {
    cardToMatch: discardedCard,
    originalPlayerID: playerId,
    potentialMatchers,
  };

  gameRoom.gameState.currentPhase = 'matchingStage';
  const newActivePlayers: { [playerID: string]: string } = {};
  for (const pId in gameRoom.gameState.players) {
    newActivePlayers[pId] = 'awaitingMatchAction'; 
  }
  gameRoom.gameState.activePlayers = newActivePlayers;

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
  // Rule: can only discard a card drawn from deck. If drawn from discard, must swap or use for ability.
  if (player.pendingDrawnCardSource !== 'deck') return { success: false, message: "Cannot discard card not drawn from deck." };

  const discardedCard = player.pendingDrawnCard;
  player.pendingDrawnCard = null;
  player.pendingDrawnCardSource = null;
  gameRoom.gameState.discardPile.push(discardedCard);

  const potentialMatchers = Object.keys(gameRoom.gameState.players).filter(pId => {
    const p = gameRoom.gameState.players[pId];
    return pId !== playerId && p && !p.isLocked && !p.hasCalledCheck;
  });
  
  gameRoom.gameState.matchingOpportunityInfo = {
    cardToMatch: discardedCard,
    originalPlayerID: playerId,
    potentialMatchers,
  };

  gameRoom.gameState.currentPhase = 'matchingStage';
  const newActivePlayers: { [playerID: string]: string } = {};
  for (const pId in gameRoom.gameState.players) {
    newActivePlayers[pId] = 'awaitingMatchAction';
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

  if (cardY.rank === cardX.rank) {
    player.hand.splice(handIndex, 1); 
    G.discardPile.push(cardY); 
    G.discardPileIsSealed = true;
    
    let abilityResolutionRequired = false;
    const isCardXSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(cardX.rank);
    const isCardYSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(cardY.rank);

    if (isCardXSpecial && isCardYSpecial) {
      if (G.players[playerId]) {
        G.pendingAbilities = G.pendingAbilities || [];
        G.pendingAbilities.push({ playerId: playerId, card: cardY, source: 'stack', pairTargetId: originalPlayerID });
      }
      if (G.players[originalPlayerID]) {
        G.pendingAbilities = G.pendingAbilities || [];
        G.pendingAbilities.push({ playerId: originalPlayerID, card: cardX, source: 'stackSecondOfPair', pairTargetId: playerId });
      }
      abilityResolutionRequired = true;
      console.log(`[GameManager] Special match pair: ${cardX.rank} & ${cardY.rank}. Abilities added for ${originalPlayerID} and ${playerId}.`);
    }

    let isAutoCheck = false;
    if (player.hand.length === 0) {
      player.hasCalledCheck = true;
      player.isLocked = true;
      if (!G.playerWhoCalledCheck) G.playerWhoCalledCheck = playerId;
      G.finalTurnsTaken = 0; 
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
    return { success: false, message: "Cards do not match." };
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
      console.log("[GameManager] checkMatchingStageEnd (after match): Match successful, no abilities/autocheck. Returning to playPhase.");
      setupNextPlayTurn(gameId);
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
        G.pendingAbilities.push({ playerId: originalPlayerID, card: cardToMatch, source: 'discard' });
        setupAbilityResolutionPhase(gameId);
      } else {
        console.log(`[GameManager] checkMatchingStageEnd (all passed): Original discarder ${originalPlayerID} already has other pending abilities. ${cardToMatch.rank} from discard not added.`);
        setupNextPlayTurn(gameId);
      }
    } else {
      console.log(`[GameManager] checkMatchingStageEnd (all passed): No further abilities from discard. Returning to playPhase.`);
      setupNextPlayTurn(gameId);
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
  if (!G.playerWhoCalledCheck) G.playerWhoCalledCheck = checkerPlayerId; 
  G.finalTurnsTaken = 0; 

  console.log(`[GameManager] setupFinalTurnsPhase: Game ${gameId} entering final turns. Checker: ${checkerPlayerId}.`);
    
  let checkerIndex = G.turnOrder.indexOf(checkerPlayerId);
  if (checkerIndex === -1) {
    console.error(`[GameManager] setupFinalTurnsPhase: Checker ${checkerPlayerId} not in turn order for game ${gameId}.`);
    G.currentPhase = 'error'; G.activePlayers = {}; G.currentPlayerId = "";
    activeGames[gameId] = gameRoom; return G;
  }

  let nextPlayerId = "";
  let attempts = 0;
  let foundNextPlayer = false;
  let potentialNextPlayerIdLoopVar: string = "";

  if (G.turnOrder.length > 0) {
    let currentTurnIdx = checkerIndex;
    do {
      currentTurnIdx = (currentTurnIdx + 1) % G.turnOrder.length;
      potentialNextPlayerIdLoopVar = G.turnOrder[currentTurnIdx]; 
      if (!G.players[potentialNextPlayerIdLoopVar]?.isLocked || potentialNextPlayerIdLoopVar === checkerPlayerId) {
        if (!G.players[potentialNextPlayerIdLoopVar]?.isLocked || potentialNextPlayerIdLoopVar === checkerPlayerId) {
            if (potentialNextPlayerIdLoopVar === checkerPlayerId) {
                nextPlayerId = potentialNextPlayerIdLoopVar;
                foundNextPlayer = true;
                break;
            } else if (!G.players[potentialNextPlayerIdLoopVar]?.isLocked) {
                nextPlayerId = potentialNextPlayerIdLoopVar;
                foundNextPlayer = true;
                break;
            }
        }
      }
      attempts++;
    } while (attempts < G.turnOrder.length && potentialNextPlayerIdLoopVar !== checkerPlayerId);
    
    if (!foundNextPlayer && G.players[checkerPlayerId] && !G.players[checkerPlayerId].isLocked) {
         console.warn(`[GameManager] setupFinalTurnsPhase: No unlocked player found other than potentially the checker for game ${gameId}. Setting to checker.`);
         nextPlayerId = checkerPlayerId;
         foundNextPlayer = true;
     }
  } else {
    console.error("[GameManager] Turn order is empty in setupFinalTurnsPhase for game: ", gameId);
    G.currentPhase = 'error'; G.activePlayers = {}; G.currentPlayerId = "";
    activeGames[gameId] = gameRoom; return G;
  }

  if (!foundNextPlayer) {
    console.error(`[GameManager] setupFinalTurnsPhase: Could not determine starting player for final turns in game ${gameId}. All players might be locked including checker. Moving to scoring.`);
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

  if (G.currentPhase !== 'finalTurnsPhase' || !G.playerWhoCalledCheck) {
    console.error(`[GameManager] continueOrEndFinalTurns: Not in final turns phase or no checker defined for game ${gameId}. Current phase: ${G.currentPhase}`);
    return setupNextPlayTurn(gameId); 
  }
  
  G.finalTurnsTaken += 1;
  console.log(`[GameManager] continueOrEndFinalTurns: Player ${G.currentPlayerId} completed final turn ${G.finalTurnsTaken} for game ${gameId}.`);
  
  const numPlayers = G.turnOrder.length;
  if (G.finalTurnsTaken >= numPlayers) {
    console.log(`[GameManager] continueOrEndFinalTurns: All players (${numPlayers}) have taken their final turn in game ${gameId}. Proceeding to scoring.`);
    return setupScoringPhase(gameId);
  } else {
    let currentPlayerIndex = G.turnOrder.indexOf(G.currentPlayerId);
    if (currentPlayerIndex === -1) {
        console.error(`[GameManager] continueOrEndFinalTurns: Current player ${G.currentPlayerId} not found in turn order for game ${gameId}. This is unexpected.`);
        currentPlayerIndex = -1;
    }

    let nextPlayerId = "";
    let foundNextPlayer = false;

    let nextTurnIdx = currentPlayerIndex;
    do {
      nextTurnIdx = (nextTurnIdx + 1) % G.turnOrder.length;
      const potentialNextPlayerId = G.turnOrder[nextTurnIdx];
      nextPlayerId = potentialNextPlayerId;
      foundNextPlayer = true;
      break; 
    } while (false);

    if (!foundNextPlayer) {
      console.error(`[GameManager] continueOrEndFinalTurns: Logic error - could not find next player for final turn in game ${gameId}, but not all turns taken.`);
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

  for (const playerId in G.players) {
    const player = G.players[playerId];
    let playerScore = 0;
    player.hand.forEach(card => {
      playerScore += cardValues[card.rank];
    });
    player.score = playerScore;
    scores[playerId] = playerScore;

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
  };
  G.currentPhase = 'gameOver';

  console.log(`[GameManager] Game ${gameId} scoring complete. Round Winner: ${G.roundWinner}. Scores:`, scores);
  activeGames[gameId] = gameRoom;
  return G;
};


export interface AbilityArgs {
  peekTargets?: Array<{ playerID: string; cardIndex: number }>; 
  swapTarget?: { playerID: string; cardIndex: number }; 
}

export const handleResolveSpecialAbility = (
  gameId: string,
  playerId: string,
  abilityResolutionArgs?: AbilityArgs 
): { success: boolean; message?: string; updatedGameState?: ServerCheckGameState } => {
  const gameRoom = getGameRoom(gameId);
  if (!gameRoom) return { success: false, message: "Game not found." };
  const G = gameRoom.gameState;
  const player = G.players[playerId];

  if (!player) return { success: false, message: "Player not found." };
  if (G.currentPhase !== 'abilityResolutionPhase' || G.currentPlayerId !== playerId) {
    return { success: false, message: "Not your turn or not in ability resolution phase." };
  }
  if (!G.pendingAbilities || G.pendingAbilities.length === 0 || G.pendingAbilities[0].playerId !== playerId) {
    return { success: false, message: "No pending ability for this player to resolve or out of sync." };
  }

  const abilityToResolve = G.pendingAbilities.shift();
  if (!abilityToResolve) return { success: false, message: "Internal error: Ability shifted but was undefined."};

  G.lastPlayerToResolveAbility = playerId;
  G.lastResolvedAbilitySource = abilityToResolve.source;
  G.lastResolvedAbilityCardForCleanup = abilityToResolve.card;

  const { card, source, pairTargetId } = abilityToResolve;
  let message = `Player ${playerId} resolved ${card.rank} ability from ${source}.`;

  switch (card.rank) {
    case Rank.King:
      if (abilityResolutionArgs?.peekTargets) {
        console.log(`[GameManager] Player ${playerId} (King ability) peeked at cards:`, abilityResolutionArgs.peekTargets);
        message += ` Peeked at cards: ${JSON.stringify(abilityResolutionArgs.peekTargets)}.`;
      } else {
         console.log(`[GameManager] Player ${playerId} (King ability) resolved peek (no specific targets logged server-side, client handles visual).`);
         message += ` Peeked at cards.`;
      }
      player.hasUsedInitialPeek = true;
      break;

    case Rank.Queen:
    case Rank.Jack:
      if (abilityResolutionArgs?.swapTarget) {
        const targetPlayerId = abilityResolutionArgs.swapTarget.playerID;
        const targetCardIndex = abilityResolutionArgs.swapTarget.cardIndex;
        const targetPlayer = G.players[targetPlayerId];

        if (targetPlayer && targetCardIndex >= 0 && targetCardIndex < targetPlayer.hand.length) {
          const actingPlayerCardIndex = player.hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
          if (actingPlayerCardIndex !== -1) {
            const cardFromActingPlayer = player.hand[actingPlayerCardIndex];
            const cardFromTargetPlayer = targetPlayer.hand[targetCardIndex];

            player.hand[actingPlayerCardIndex] = cardFromTargetPlayer;
            targetPlayer.hand[targetCardIndex] = cardFromActingPlayer;
            
            message += ` Swapped their ${card.rank} with ${targetPlayerId}'s card at index ${targetCardIndex}.`;
            console.log(`[GameManager] Player ${playerId} (${card.rank} ability) swapped with ${targetPlayerId} (Card: ${cardFromTargetPlayer.rank}${cardFromTargetPlayer.suit} for ${cardFromActingPlayer.rank}${cardFromActingPlayer.suit})`);
          } else {
            message += ` Could not find their ${card.rank} to swap. Ability fizzled.`;
            console.warn(`[GameManager] Player ${playerId} (${card.rank} ability): their ${card.rank} card not found for swap.`);
          }
        } else {
          message += ` Invalid target for swap. Ability fizzled.`;
          console.warn(`[GameManager] Player ${playerId} (${card.rank} ability): Invalid swap target ${targetPlayerId} index ${targetCardIndex}.`);
        }
      } else {
        message += ` No swap target provided. Ability fizzled.`;
        console.warn(`[GameManager] Player ${playerId} (${card.rank} ability): No swap target provided.`);
      }
      break;
    default:
      message += ` No specific action for ${card.rank}.`;
      console.log(`[GameManager] Player ${playerId} resolved unhandled special ability card: ${card.rank}`);
  }
  
  player.pendingSpecialAbility = null;

  if (G.pendingAbilities && G.pendingAbilities.length > 0) {
    console.log(`[GameManager] Abilities still pending. Setting up next ability resolution.`);
    setupAbilityResolutionPhase(gameId);
  } else {
    G.lastPlayerToResolveAbility = null;
    G.lastResolvedAbilitySource = null;
    G.lastResolvedAbilityCardForCleanup = null;
    if (G.playerWhoCalledCheck) {
      console.log(`[GameManager] All abilities resolved, check was called. Proceeding to final turns.`);
      setupFinalTurnsPhase(gameId, G.playerWhoCalledCheck);
    } else {
      console.log(`[GameManager] All abilities resolved, no check. Proceeding to next play turn.`);
      setupNextPlayTurn(gameId);
    }
  }
  
  activeGames[gameId] = gameRoom;
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
  if (player.isReadyForInitialPeek) return { success: true, message: "Player already ready." };

  player.isReadyForInitialPeek = true;
  if (G.activePlayers[playerId]) G.activePlayers[playerId] = 'readyForPeek';
  
  console.log(`[GameManager] Player ${playerId} declared ready for initial peek in game ${gameId}.`);

  const allPlayersReady = G.turnOrder.every(pId => G.players[pId]?.isReadyForInitialPeek);

  if (allPlayersReady) {
    console.log(`[GameManager] All players ready for peek in game ${gameId}. Setting timestamp and revealing cards.`);
    G.initialPeekAllReadyTimestamp = Date.now();
    G.turnOrder.forEach(pId => {
      if (G.activePlayers[pId]) G.activePlayers[pId] = 'revealingCardsStage';
      const pState = G.players[pId];
      if (pState && pState.hand.length >= 2) {
          const cardsToPeek = [pState.hand[2], pState.hand[3]].filter(Boolean);
          if (cardsToPeek.length > 0) {
            pState.cardsToPeek = cardsToPeek;
            pState.peekAcknowledgeDeadline = Date.now() + (PEEK_COUNTDOWN_SECONDS + PEEK_REVEAL_SECONDS + 2) * 1000;
             console.log(`[GameManager] Player ${pId} cardsToPeek set for initial peek.`);
          }
      }
    });
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

  player.hasCompletedInitialPeek = true;
  player.cardsToPeek = null; 
  player.peekAcknowledgeDeadline = null;

  if (G.activePlayers[playerId]) G.activePlayers[playerId] = 'peekAcknowledged';
  
  console.log(`[GameManager] Player ${playerId} acknowledged initial peek in game ${gameId}.`);

  const allPlayersAcknowledged = G.turnOrder.every(pId => G.players[pId]?.hasCompletedInitialPeek);

  if (allPlayersAcknowledged) {
    console.log(`[GameManager] All players acknowledged peek in game ${gameId}. Transitioning to playPhase.`);
    G.initialPeekAllReadyTimestamp = null; 
    G.currentPlayerId = G.turnOrder[0]; 
    G.currentPhase = 'playPhase';
    G.turnOrder.forEach(pId => { 
        if (pId === G.currentPlayerId) {
            G.activePlayers[pId] = 'playPhaseActive';
        } else {
            delete G.activePlayers[pId]; 
        }
    });
    activeGames[gameId] = gameRoom;
    const nextState = setupNextPlayTurn(gameId);
    if (nextState) {
        return { success: true, message: "Peek acknowledged, next turn started.", updatedGameState: nextState };
    } else {
        return { success: false, message: "Peek acknowledged, but failed to set up next turn." };
    }
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
    };
  }

  const clientGameState: ClientCheckGameState = {
    ...fullGameState,
    deckSize: fullGameState.deck.length, 
    players: clientPlayers, 

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
    gameover: fullGameState.gameover,
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