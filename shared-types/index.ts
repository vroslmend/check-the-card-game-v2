export enum Suit {
  Hearts = 'H',
  Diamonds = 'D',
  Clubs = 'C',
  Spades = 'S',
}

export enum Rank {
  Ace = 'A',
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Ten = '10',
  Jack = 'J',
  Queen = 'Q',
  King = 'K',
}

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface HiddenCard {
  isHidden: true;
  id: string; // For React key prop, e.g., `player1-hidden-0`
}

export type ClientCard = Card | HiddenCard;

export interface InitialPlayerSetupData {
  id: string;
  name?: string;
}

export interface PlayerState {
  hand: Card[];
  hasUsedInitialPeek: boolean;
  isReadyForInitialPeek: boolean;
  hasCompletedInitialPeek: boolean;
  cardsToPeek: Card[] | null;
  peekAcknowledgeDeadline: number | null;
  pendingDrawnCard: Card | null;
  pendingDrawnCardSource: 'deck' | 'discard' | null;
  // pendingSpecialAbility removed from individual player, now on CheckGameState
  hasCalledCheck: boolean;
  isLocked: boolean;
  score: number;
  name?: string; // Optional: Player's display name
}

export interface PendingSpecialAbility {
  playerId: string;
  card: Card;
  source: 'stack' | 'stackSecondOfPair' | 'discard' | 'deck'; // Where the ability originated
  pairTargetId?: string; // For 'stackSecondOfPair', the ID of the player who played the first card of the pair
}

export interface AbilityArgs {
  peekTargets?: Array<{ playerID: string; cardIndex: number }>; 
  swapTarget?: { playerID: string; cardIndex: number }; 
}

export interface CheckGameState {
  deck: Card[];
  players: { [playerID: string]: PlayerState };
  discardPile: Card[];
  discardPileIsSealed: boolean;
  matchingOpportunityInfo: {
    cardToMatch: Card;
    originalPlayerID: string;
    potentialMatchers: string[];
  } | null;
  playerWhoCalledCheck: string | null;
  roundWinner: string | null;
  finalTurnsTaken: number;
  initialPeekAllReadyTimestamp: number | null;
  lastPlayerToResolveAbility: string | null; 
  lastResolvedAbilitySource: 'stack' | 'stackSecondOfPair' | 'discard' | 'deck' | null;
  lastResolvedAbilityCardForCleanup: Card | null;


  // Core game context fields previously from boardgame.io ctx
  currentPhase: string; // e.g., 'initialPeekPhase', 'playPhase', 'matchingStage', 'abilityResolutionPhase', 'finalTurnsPhase', 'scoringPhase', 'gameOver'
  currentPlayerId: string;
  turnOrder: string[];
  gameMasterId: string; // Player who created the game, or first player
  activePlayers: { [playerID: string]: string }; // Stage specific, e.g., { 'player1': 'awaitingReadiness', 'player2': 'playPhaseActive' }
  
  pendingAbilities: PendingSpecialAbility[];
  gameover: { winner?: string; scores: { [playerID: string]: number } } | null;
  matchResolvedDetails: { byPlayerId: string, isAutoCheck: boolean, abilityResolutionRequired: boolean } | null;
}

// For the client, we'll have a redacted view
export interface ClientPlayerState extends Omit<PlayerState, 'hand' | 'pendingDrawnCard' | 'cardsToPeek'> {
  hand: ClientCard[]; // Player sees their own hand as Card[], others as HiddenCard[]
  cardsToPeek: Card[] | null; // Only populated for the viewing player during their peek
  pendingDrawnCard: ClientCard | null; // Viewing player sees their Card, others see HiddenCard or null
  // name is already optional in PlayerState
}

export interface ClientCheckGameState extends Omit<CheckGameState, 'deck' | 'players' | 'lastPlayerToResolveAbility' | 'lastResolvedAbilityCardForCleanup' | 'lastResolvedAbilitySource'> {
  players: { [playerID: string]: ClientPlayerState };
  
  // Client-specific additions
  viewingPlayerId: string; // The ID of the player for whom this view is generated
  deckSize: number; // To show number of cards in deck without revealing them
  topDiscardIsSpecialOrUnusable?: boolean; // True if discard pile top card is K,Q,J OR if discardPileIsSealed
}

// Helper for card values, can also be in shared-types if client needs it for display
export const cardValues: Record<Rank, number> = {
  [Rank.Ace]: -1,
  [Rank.Two]: 2,
  [Rank.Three]: 3,
  [Rank.Four]: 4,
  [Rank.Five]: 5,
  [Rank.Six]: 6,
  [Rank.Seven]: 7,
  [Rank.Eight]: 8,
  [Rank.Nine]: 9,
  [Rank.Ten]: 10,
  [Rank.Jack]: 11,
  [Rank.Queen]: 12,
  [Rank.King]: 13,
};

export type PlayerActionPayload = any; // Generic for now

export interface PlayerAction {
    gameId: string;
    playerId: string;
    type: string; // e.g., 'drawFromDeck', 'attemptMatch', 'resolveSpecialAbility'
    payload?: PlayerActionPayload;
}

// export interface PlayerSetupInfo { // This seems to be a duplicate of InitialPlayerSetupData
//   id: string; 
//   name?: string;
// } 