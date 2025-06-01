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
  const cardWrapperClasses = "w-12 md:w-14 relative";
  const effectiveCanDraw = canDraw && !isSealed;

  return (
    <div className="flex flex-col items-center justify-center p-1">
      <span className="mb-0.5 text-[0.65rem] text-gray-500 font-medium">Discard Pile</span>
      <div className={`${cardWrapperClasses}`}>
        {topCard ? (
          <>
            <CardComponent
              card={topCard}
              isFaceUp={true}
              onClick={effectiveCanDraw ? onClick : undefined}
            />
            {isSealed && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md md:rounded-lg p-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
            )}
          </>
        ) : (
          <div
            className="w-full aspect-[2.5/3.5] rounded-md md:rounded-lg bg-gray-100/80 flex items-center justify-center text-gray-400 text-xs font-sans shadow-inner border border-gray-200/80"
            aria-label="Empty discard pile"
          >
            Empty
          </div>
        )}
      </div>
      <span className="mt-0.5 text-[0.6rem] text-gray-400">Cards: {numberOfCards}</span>
    </div>
  );
};

export default DiscardPileComponent; 