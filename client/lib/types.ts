export interface UICard {
  id: string;
  value: string;
  suit: string;
  spriteName: string;
  isPlayable?: boolean;
  isSelected?: boolean;
  isHidden?: boolean;
  effects?: string[];
}

export interface UIPlayer {
  id: string;
  name: string;
  avatarUrl?: string;
  isCurrentPlayer: boolean;
  cardCount: number;
  isLocked: boolean;
  isDeclaringCheck: boolean;
}

export type UIGamePhase =
  | "WaitingForPlayers"
  | "CharacterSelection"
  | "Playing"
  | "FinalTurns"
  | "GameEnd";

import { Card } from "shared-types";

export function isCard(card: unknown): card is Card {
  return typeof card === "object" && card !== null && "rank" in card;
}

export function isDrawnCard(card: unknown): card is { card: Card } {
  return (
    typeof card === "object" &&
    card !== null &&
    "card" in card &&
    isCard((card as { card: unknown }).card)
  );
}
