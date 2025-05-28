import React from 'react';
import CardComponent from './CardComponent';

interface DrawPileComponentProps {
  onClick?: () => void;
  canDraw: boolean;
  numberOfCards: number;
}

const DrawPileComponent: React.FC<DrawPileComponentProps> = ({
  onClick,
  canDraw,
  numberOfCards
}) => {
  const pileStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px',
    border: '1px dashed #ccc',
    borderRadius: '8px',
    minHeight: '150px', // Ensure space even if empty
    justifyContent: 'center',
  };

  const countStyle: React.CSSProperties = {
    marginTop: '5px',
    fontSize: '12px',
    color: '#555',
  };

  return (
    <div style={pileStyle}>
      <h4>Draw Pile</h4>
      {numberOfCards > 0 ? (
        <CardComponent
          card={null} // Always show as face-down pile
          isFaceUp={false}
          onClick={canDraw ? onClick : undefined}
          style={{ cursor: canDraw ? 'pointer' : 'not-allowed' }}
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

export default DrawPileComponent; 