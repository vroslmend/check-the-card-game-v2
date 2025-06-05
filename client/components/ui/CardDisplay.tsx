import React from 'react';
import { Card, Suit, Rank, ClientCard, HiddenCard } from '../../../shared-types/src/index'; // Corrected path

interface CardDisplayProps {
  card: ClientCard;
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
}

const suitSymbols: Record<Suit, string> = {
  [Suit.Hearts]: '♥',
  [Suit.Diamonds]: '♦',
  [Suit.Clubs]: '♣',
  [Suit.Spades]: '♠',
};

const rankSymbols: Record<Rank, string> = {
  [Rank.Ace]: 'A',
  [Rank.Two]: '2',
  [Rank.Three]: '3',
  [Rank.Four]: '4',
  [Rank.Five]: '5',
  [Rank.Six]: '6',
  [Rank.Seven]: '7',
  [Rank.Eight]: '8',
  [Rank.Nine]: '9',
  [Rank.Ten]: '10',
  [Rank.Jack]: 'J',
  [Rank.Queen]: 'Q',
  [Rank.King]: 'K',
};

const CardDisplay: React.FC<CardDisplayProps> = ({ card, onClick, isSelected, className }) => {
  const isHiddenCard = (c: ClientCard): c is HiddenCard => (c as HiddenCard).isHidden === true;
  // A card is considered face down for display if it's a HiddenCard or if it's a regular Card with isFaceDownToOwner true.
  // For now, we'll simplify: if it's HiddenCard, it's a back. If it's a Card, we check isFaceDownToOwner.
  // This might need refinement based on exactly how `isFaceDownToOwner` is used by the client for the *actual* owner.
  // For this component, we assume if `isFaceDownToOwner` is present and true, it's a back.
  const showBack = isHiddenCard(card) || (card as Card).isFaceDownToOwner === true;

  const baseStyle = "w-20 h-28 border-2 rounded-lg flex flex-col items-center justify-center shadow-md transition-all select-none";
  const selectedStyle = isSelected ? "ring-4 ring-blue-500 shadow-lg scale-105" : "hover:shadow-lg";
  const clickableStyle = onClick ? "cursor-pointer hover:border-blue-400" : "";

  if (showBack) {
    return (
      <div
        className={`${baseStyle} bg-gray-500 ${clickableStyle} ${selectedStyle} ${className || ''}`}
        onClick={onClick}
        aria-label="Card back"
      >
        <span className="text-4xl text-gray-300">?</span>
      </div>
    );
  }

  // Type guard to ensure card is Card after showBack check
  const displayableCard = card as Card;

  const suitColor = (displayableCard.suit === Suit.Hearts || displayableCard.suit === Suit.Diamonds) ? 'text-red-600' : 'text-black';

  return (
    <div
      className={`${baseStyle} bg-white ${suitColor} ${clickableStyle} ${selectedStyle} ${className || ''}`}
      onClick={onClick}
      role="button"
      aria-pressed={isSelected}
      aria-label={`Card ${rankSymbols[displayableCard.rank]} of ${suitSymbols[displayableCard.suit]}`}
    >
      <div className="absolute top-1 left-1 text-lg font-semibold">{rankSymbols[displayableCard.rank]}</div>
      <div className="text-3xl">{suitSymbols[displayableCard.suit]}</div>
      <div className="absolute bottom-1 right-1 text-lg font-semibold transform rotate-180">{rankSymbols[displayableCard.rank]}</div>
    </div>
  );
};

export default CardDisplay; 