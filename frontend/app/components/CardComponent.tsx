import React from 'react';
import type { Card } from 'shared-types';

interface CardComponentProps {
  card: Card | null; // Card can be null if it's a face-down card or an empty slot
  isFaceUp?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
  style?: React.CSSProperties; // For dynamic styling (e.g., position in a grid)
}

const CardComponent: React.FC<CardComponentProps> = ({
  card,
  isFaceUp = false,
  onClick,
  isSelected = false,
  style,
}) => {
  const cardBaseStyle: React.CSSProperties = {
    width: '70px',
    height: '100px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px',
    cursor: onClick ? 'pointer' : 'default',
    backgroundColor: isSelected ? '#a0d2eb' : '#fff', // Highlight if selected
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    position: 'relative', // For potential absolute positioning of elements within or for grid layout
    ...style, // Spread any additional styles passed via props
  };

  const cardTextStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 'bold',
  };

  const suitSymbols: { [key: string]: string } = {
    H: '♥', // Hearts
    D: '♦', // Diamonds
    C: '♣', // Clubs
    S: '♠', // Spades
  };

  if (!card || !isFaceUp) {
    return (
      <div style={{ ...cardBaseStyle, backgroundColor: '#b0b0b0' }} onClick={onClick}>
        {/* Basic representation of a face-down card */}
        <span style={{ fontSize: '24px', color: '#fff' }}>?</span>
      </div>
    );
  }

  const getSuitColor = (suit: string) => {
    return suit === 'H' || suit === 'D' ? 'red' : 'black';
  };

  return (
    <div style={cardBaseStyle} onClick={onClick}>
      <div style={{ alignSelf: 'flex-start', color: getSuitColor(card.suit) }}>
        <span style={cardTextStyle}>{card.rank}</span>
        <span style={{ fontSize: '12px' }}>{suitSymbols[card.suit]}</span>
      </div>
      <div style={{ fontSize: '24px', color: getSuitColor(card.suit) }}>
        {suitSymbols[card.suit]}
      </div>
      <div style={{ alignSelf: 'flex-end', transform: 'rotate(180deg)', color: getSuitColor(card.suit) }}>
        <span style={cardTextStyle}>{card.rank}</span>
        <span style={{ fontSize: '12px' }}>{suitSymbols[card.suit]}</span>
      </div>
    </div>
  );
};

export default CardComponent; 