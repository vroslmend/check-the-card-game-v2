import React from 'react';
import { motion } from 'framer-motion';
import { Card, Suit, Rank, ClientCard, HiddenCard } from '../../../shared-types/src/index';

interface CardDisplayProps {
  card: ClientCard;
  onClick?: () => void;
  isSelected?: boolean;
  isAbilitySelected?: boolean;
  className?: string;
  isTemporarilyRevealed?: boolean;
  isFaceUp?: boolean;
}

const rankSymbols: Record<Rank, string> = {
  [Rank.Ace]: 'A', [Rank.Two]: '2', [Rank.Three]: '3', [Rank.Four]: '4', [Rank.Five]: '5',
  [Rank.Six]: '6', [Rank.Seven]: '7', [Rank.Eight]: '8', [Rank.Nine]: '9', [Rank.Ten]: '10',
  [Rank.Jack]: 'J', [Rank.Queen]: 'Q', [Rank.King]: 'K',
};

const suitSymbols: Record<Suit, string> = {
  [Suit.Hearts]: '♥', [Suit.Diamonds]: '♦', [Suit.Clubs]: '♣', [Suit.Spades]: '♠',
};

const CardDisplay = ({ card, onClick, isSelected, isAbilitySelected, className, isTemporarilyRevealed, isFaceUp = true }: CardDisplayProps) => {
  const isHiddenCard = (c: ClientCard): c is HiddenCard => (c as HiddenCard).isHidden === true;

  const showStaticBack = isHiddenCard(card) && !isTemporarilyRevealed;

  const baseStyle = "absolute w-full h-full rounded-lg border-2 flex items-center justify-center text-5xl font-bold";
  const ringStyle = isSelected ? 'ring-4 ring-offset-2 ring-blue-500' : isAbilitySelected ? 'ring-4 ring-offset-2 ring-yellow-400' : '';
  const clickableStyle = onClick ? "cursor-pointer" : "";

  if (showStaticBack) {
    return (
      <div className={`relative w-24 h-36 ${clickableStyle} ${className || ''}`} onClick={onClick}>
        <div className={`${baseStyle} bg-gray-500 ${ringStyle}`}>
          <span className="text-4xl text-gray-300">?</span>
        </div>
      </div>
    );
  }

  // Card is not a hidden opponent card, so it can be flipped
  const displayableCard = card as Card;
  const suitColor = (displayableCard.suit === Suit.Hearts || displayableCard.suit === Suit.Diamonds) ? 'text-red-600' : 'text-black';

  return (
    <div className={`relative w-24 h-36 ${clickableStyle} ${className || ''}`} onClick={onClick} style={{ perspective: '1000px' }}>
      <motion.div
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: isFaceUp ? 0 : 180 }}
        transition={{ duration: 0.5 }}
        className={`relative w-full h-full ${ringStyle}`}
      >
        {/* Front of the Card */}
        <div className={`${baseStyle} bg-white ${suitColor}`} style={{ backfaceVisibility: 'hidden' }}>
          <div className="absolute top-1 left-1 text-lg font-semibold">{rankSymbols[displayableCard.rank]}</div>
          <div className="text-3xl">{suitSymbols[displayableCard.suit]}</div>
          <div className="absolute bottom-1 right-1 text-lg font-semibold transform rotate-180">{rankSymbols[displayableCard.rank]}</div>
        </div>
        {/* Back of the Card */}
        <div className={`${baseStyle} bg-red-500 border-red-700`} style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          <span className="text-4xl text-white">?</span>
        </div>
      </motion.div>
    </div>
  );
};

export default CardDisplay; 