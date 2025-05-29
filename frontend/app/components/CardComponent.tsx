import React from 'react';
import type { Card, ClientCard } from 'shared-types';

interface CardComponentProps {
  card: ClientCard | null;
  isFaceUp?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
  style?: React.CSSProperties;
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
    backgroundColor: isSelected ? '#a0d2eb' : '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    position: 'relative',
    ...style,
  };

  const cardTextStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 'bold',
  };

  const suitSymbols: { [key: string]: string } = {
    H: '♥',
    D: '♦',
    C: '♣',
    S: '♠',
  };

  const shouldShowBack = !card || !isFaceUp || ('isHidden' in card && card.isHidden);

  if (shouldShowBack) {
    return (
      <div style={{ ...cardBaseStyle, backgroundColor: isSelected ? '#a0d2eb' : '#b0b0b0' }} onClick={onClick}>
        <span style={{ fontSize: '24px', color: '#fff' }}>?</span>
      </div>
    );
  }

  const actualCard = card as Card;

  const getSuitColor = (suit: string) => {
    return suit === 'H' || suit === 'D' ? 'red' : 'black';
  };

  return (
    <div style={cardBaseStyle} onClick={onClick}>
      <div style={{ alignSelf: 'flex-start', color: getSuitColor(actualCard.suit) }}>
        <span style={cardTextStyle}>{actualCard.rank}</span>
        <span style={{ fontSize: '12px' }}>{suitSymbols[actualCard.suit]}</span>
      </div>
      <div style={{ fontSize: '24px', color: getSuitColor(actualCard.suit) }}>
        {suitSymbols[actualCard.suit]}
      </div>
      <div style={{ alignSelf: 'flex-end', transform: 'rotate(180deg)', color: getSuitColor(actualCard.suit) }}>
        <span style={cardTextStyle}>{actualCard.rank}</span>
        <span style={{ fontSize: '12px' }}>{suitSymbols[actualCard.suit]}</span>
      </div>
    </div>
  );
};

export default CardComponent; 