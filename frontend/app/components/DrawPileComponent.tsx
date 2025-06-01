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
  const cardWrapperClasses = "w-12 md:w-14"; // Consistent small card width

  return (
    <div className="flex flex-col items-center justify-center p-1"> {/* Reduced padding */}
      <span className="mb-0.5 text-[0.65rem] text-gray-500 font-medium">Draw Pile</span> {/* Smaller text */}
      <div className={`${cardWrapperClasses}`}> {/* Wrapper to control card size */} 
        {numberOfCards > 0 ? (
          <CardComponent
            card={null} // Always show as face-down pile
            isFaceUp={false}
            onClick={canDraw ? onClick : undefined}
            // Style cursor via CardComponent's own hover/disabled states if possible, or keep simple
            // style={{ cursor: canDraw ? 'pointer' : 'not-allowed' }} // CardComponent handles cursor based on onClick
          />
        ) : (
          <div
            className="w-full aspect-[2.5/3.5] rounded-md md:rounded-lg bg-gray-100/80 flex items-center justify-center text-gray-400 text-xs font-sans shadow-inner border border-gray-200/80"
            aria-label="Empty draw pile"
          >
            Empty
          </div>
        )}
      </div>
      <span className="mt-0.5 text-[0.6rem] text-gray-400">Cards: {numberOfCards}</span> {/* Smaller text */}
    </div>
  );
};

export default DrawPileComponent; 