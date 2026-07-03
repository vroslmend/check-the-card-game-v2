import { Card, PublicCard } from "shared-types";

export function isCard(card: unknown): card is Card {
  return typeof card === "object" && card !== null && "rank" in card;
}

export function isDrawnCard(
  card: unknown,
): card is { card: PublicCard; source: "deck" | "discard" } {
  return (
    typeof card === "object" &&
    card !== null &&
    "card" in card &&
    "source" in card &&
    isCard((card as { card: unknown }).card)
  );
}
