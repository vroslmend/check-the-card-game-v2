// Client-side specific type definitions.
// You can re-export types from shared-types if they are used directly by the client
// or define client-specific augmentations or new types here.

// Example of re-exporting (if you have a shared-types package or file later):
// export type { Player as SharedPlayer, Card as SharedCard } from '../../shared-types';

// Client-specific view models or UI-related types
export interface UICard {
  id: string;        // Unique ID for React key, could be card.id
  value: string;     // e.g., 'A', 'K', '7', 'Joker'
  suit: string;      // e.g., 'H', 'D', 'C', 'S', 'Red', 'Black'
  spriteName: string; // e.g., 'H_A.png' or some identifier for its visual
  isPlayable?: boolean;
  isSelected?: boolean;
  isHidden?: boolean; // For face-down cards or other players' hands
  effects?: string[]; // e.g. ['PEEK', 'SWAP'] from card.abilities
}

export interface UIPlayer {
  id: string;
  name: string;
  avatarUrl?: string;
  isCurrentPlayer: boolean;
  cardCount: number;
  isLocked: boolean;
  isDeclaringCheck: boolean;
  // Add other UI-specific player properties
}

// Could be used for mapping server GamePhase to client-friendly strings or states
export type UIGamePhase = 
  | 'WaitingForPlayers' 
  | 'CharacterSelection' 
  | 'Playing' 
  | 'FinalTurns' 
  | 'GameEnd'; 

import { Card } from 'shared-types';

export function isDrawnCard(card: unknown): card is { card: Card; source: 'deck' | 'discard' } {
  return card !== null && typeof card === 'object' && 'card' in card && 'source' in card;
} 