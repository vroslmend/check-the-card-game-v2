import React from 'react';
import type { Card, ClientCard } from 'shared-types';

interface CardComponentProps {
  card: ClientCard | null;
  isFaceUp?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
  style?: React.CSSProperties;
  // No explicit size prop for now, will scale with parent container
}

const suitSymbols: { [key: string]: string } = {
  H: '♥',
  D: '♦',
  C: '♣',
  S: '♠',
};

const CardComponent: React.FC<CardComponentProps> = ({
  card,
  isFaceUp = false,
  onClick,
  isSelected = false,
  style,
}) => {
  const shouldShowBack = !card || !isFaceUp || ('isHidden' in card && card.isHidden);

  // Color for suit
  const getSuitColor = (suit: string) => {
    return suit === 'H' || suit === 'D' ? 'text-red-500' : 'text-neutral-800';
  };

  // Base classes adjusted for better scaling. Parent will control size.
  const baseClasses = [
    'w-full', 'h-full', // Fill parent container
    'aspect-[2.5/3.5]', // Standard card aspect ratio, parent controls one dimension
    'p-1', // Minimal padding for content
    'rounded-md md:rounded-lg', // Slightly smaller rounding for smaller sizes
    'shadow-md', 'bg-white',
    'flex', 'flex-col', 'justify-center', 'items-center',
    'font-sans', 'select-none',
    'transition-all', 'duration-150',
    onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-px' : 'cursor-default',
    isSelected ? 'ring-2 ring-accent shadow-accent/50' : 'ring-1 ring-gray-200',
  ].join(' ');

  if (shouldShowBack) {
    return (
      <div
        className={baseClasses + ' bg-gray-100/80 flex items-center justify-center'}
        style={style}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        aria-label="Hidden card"
      >
        {/* Responsive text size for the question mark */}
        <span className="text-3xl sm:text-4xl text-gray-400">?</span> 
      </div>
    );
  }

  const actualCard = card as Card;
  const suitClass = getSuitColor(actualCard.suit);

  return (
    <div
      className={baseClasses}
      style={style}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      aria-label={`${actualCard.rank} of ${actualCard.suit}`}
    >
      {/* Adjusted font sizes to be more responsive within smaller cards */}
      <div className={`flex flex-col items-center justify-center leading-tight`}>
        <span className={`text-base sm:text-lg md:text-xl font-bold ${suitClass}`}>{actualCard.rank}</span>
        <span className={`text-sm sm:text-base md:text-lg ${suitClass}`}>{suitSymbols[actualCard.suit]}</span>
      </div>
    </div>
  );
};

export default CardComponent; 