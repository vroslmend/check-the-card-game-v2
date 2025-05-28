import React from 'react';
import type { Card } from 'shared-types';
import CardComponent from './CardComponent';

interface DiscardPileComponentProps {
  topCard: Card | null;
  onClick?: () => void;
  canDraw: boolean;
  isSealed: boolean;
  numberOfCards: number;
}

const DiscardPileComponent: React.FC<DiscardPileComponentProps> = ({
  topCard,
  onClick,
  canDraw,
  isSealed,
  numberOfCards
}) => {
  const pileStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px',
    border: `2px solid ${isSealed ? '#ff6b6b' : '#86dc86'}`,
    borderRadius: '8px',
    minHeight: '150px',
    justifyContent: 'center',
    backgroundColor: isSealed ? '#ffe0e0' : '#e6ffe6',
  };

  const countStyle: React.CSSProperties = {
    marginTop: '5px',
    fontSize: '12px',
    color: '#555',
  };

  const sealedTextStyle: React.CSSProperties = {
    color: '#c0392b',
    fontSize: '12px',
    fontWeight: 'bold',
    marginBottom: '5px',
  }

  return (
    <div style={pileStyle}>
      <h4>Discard Pile</h4>
      {isSealed && <div style={sealedTextStyle}>Sealed</div>}
      {topCard ? (
        <CardComponent
          card={topCard}
          isFaceUp={true} // Top card of discard is always face up
          onClick={canDraw && !isSealed ? onClick : undefined}
          style={{ 
            cursor: canDraw && !isSealed ? 'pointer' : 'not-allowed',
            opacity: isSealed ? 0.7 : 1,
          }}
        />
      ) : (
        <div style={{ 
            width: '70px', 
            height: '100px', 
            border: '1px solid #ccc', 
            borderRadius: '8px', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            backgroundColor: '#f0f0f0' 
        }}>
            Empty
        </div>
      )}
      <div style={countStyle}>Cards: {numberOfCards}</div>
    </div>
  );
};

export default DiscardPileComponent; 