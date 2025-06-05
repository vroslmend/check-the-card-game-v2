import React from 'react';
import { Card, Suit, Rank, ClientCard, HiddenCard } from '../../../shared-types/src/index'; // Corrected path

interface CardDisplayProps {
  card: ClientCard;
  onClick?: () => void;
  isSelected?: boolean;
  isAbilitySelected?: boolean;
  className?: string;
  isTemporarilyRevealed?: boolean;
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

const CardDisplay: React.FC<CardDisplayProps> = ({ card, onClick, isSelected, isAbilitySelected, className, isTemporarilyRevealed }) => {
  const isHiddenCard = (c: ClientCard): c is HiddenCard => (c as HiddenCard).isHidden === true;

  // Determine if the card back should be shown
  let showBackInitially = isHiddenCard(card) || (card as Card).isFaceDownToOwner === true;

  // If isTemporarilyRevealed is true, always show the face (i.e., don't show back)
  // unless the card itself is fundamentally a HiddenCard (e.g. an opponent's non-peeked card)
  // and we don't actually have its face details.
  // However, for the local player's hand, `card` will be a full Card object.
  const showBack = isTemporarilyRevealed ? false : showBackInitially;

  const baseStyle = "w-20 h-28 border-2 rounded-lg flex flex-col items-center justify-center shadow-md transition-all select-none relative";
  
  let ringStyle = "";
  if (isAbilitySelected) {
    ringStyle = "ring-4 ring-purple-500 shadow-lg scale-105";
  } else if (isSelected) {
    ringStyle = "ring-4 ring-blue-500 shadow-lg scale-105";
  }
  
  const clickableStyle = onClick ? "cursor-pointer hover:border-blue-400" : "";

  if (showBack) {
    return (
      <div
        className={`${baseStyle} bg-gray-500 ${clickableStyle} ${ringStyle} ${className || ''}`}
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
      className={`${baseStyle} bg-white ${suitColor} ${clickableStyle} ${ringStyle} ${className || ''}`}
      onClick={onClick}
      role="button"
      aria-pressed={isSelected || isAbilitySelected}
      aria-label={`Card ${rankSymbols[displayableCard.rank]} of ${suitSymbols[displayableCard.suit]}`}
    >
      <div className="absolute top-1 left-1 text-lg font-semibold">{rankSymbols[displayableCard.rank]}</div>
      <div className="text-3xl">{suitSymbols[displayableCard.suit]}</div>
      <div className="absolute bottom-1 right-1 text-lg font-semibold transform rotate-180">{rankSymbols[displayableCard.rank]}</div>
    </div>
  );
};

export default CardDisplay; 