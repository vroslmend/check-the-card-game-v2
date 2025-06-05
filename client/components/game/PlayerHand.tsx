import React from 'react';
import { ClientCard, PlayerId, Card } from 'shared-types'; // Changed to alias
import CardDisplay from '../ui/CardDisplay';
import { AbilityContextContent } from '../../machines/uiMachine'; // Changed import

interface PlayerHandProps {
  cards: ClientCard[];
  playerId: PlayerId; // Owner of this hand
  localPlayerId: PlayerId; // The player viewing the screen
  onCardClick?: (targetPlayerId: PlayerId, clickedCard: ClientCard, cardIndex: number) => void;
  selectedHandCardIndex?: number | null; // Index of the selected card in this hand
  initialPeekCardsForDisplay?: Card[] | null; // Cards to show as peeked during initial peek phase for THIS player's hand
  abilityPeekContext?: AbilityContextContent | null; // Updated type
  className?: string;
}

const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  playerId,
  localPlayerId,
  onCardClick,
  selectedHandCardIndex,
  initialPeekCardsForDisplay,
  abilityPeekContext,
  className,
}) => {
  const isOwner = playerId === localPlayerId;

  return (
    <div className={`grid grid-cols-2 gap-x-2 gap-y-3 p-2 bg-gray-700 rounded-lg shadow ${className || ''} max-w-xs mx-auto`}>
      {cards.map((cardFromProps, index) => {
        let isTemporarilyRevealed = false;
        let cardToRender: ClientCard = cardFromProps;
        let isMarkedForAbility = false;

        if (isOwner) {
          const actualCard = cardFromProps as Card;
          if (initialPeekCardsForDisplay && initialPeekCardsForDisplay.some(peekCard => peekCard.id === actualCard.id)) {
            isTemporarilyRevealed = true;
          }
          if (abilityPeekContext && !isTemporarilyRevealed) {
            if (abilityPeekContext.type === 'king' && abilityPeekContext.peekedCardsInfo?.some(info => info.playerId === playerId && info.cardIndex === index)) {
              isTemporarilyRevealed = true;
            } else if (abilityPeekContext.type === 'queen' && abilityPeekContext.peekedCardInfo?.playerId === playerId && abilityPeekContext.peekedCardInfo?.cardIndex === index) {
              isTemporarilyRevealed = true;
            }
          }
        } else {
          if (abilityPeekContext) {
            if (abilityPeekContext.type === 'king' && abilityPeekContext.peekedCardsInfo) {
              const peekInfo = abilityPeekContext.peekedCardsInfo.find(info => info.playerId === playerId && info.cardIndex === index);
              if (peekInfo) {
                isTemporarilyRevealed = true;
                cardToRender = peekInfo.card;
              }
            } else if (abilityPeekContext.type === 'queen' && abilityPeekContext.peekedCardInfo) {
              if (abilityPeekContext.peekedCardInfo.playerId === playerId && abilityPeekContext.peekedCardInfo.cardIndex === index) {
                isTemporarilyRevealed = true;
                cardToRender = abilityPeekContext.peekedCardInfo.card;
              }
            }
          }
        }

        if (abilityPeekContext) {
          if (abilityPeekContext.type === 'king' && abilityPeekContext.peekedCardsInfo?.some(info => info.playerId === playerId && info.cardIndex === index)) {
            isMarkedForAbility = true;
          }
          if (abilityPeekContext.type === 'queen' && abilityPeekContext.peekedCardInfo?.playerId === playerId && abilityPeekContext.peekedCardInfo?.cardIndex === index) {
            isMarkedForAbility = true;
          }
          if ((abilityPeekContext.type === 'king' || abilityPeekContext.type === 'queen' || abilityPeekContext.type === 'jack') && abilityPeekContext.swapSlots) {
            if (abilityPeekContext.swapSlots.slot1?.playerId === playerId && abilityPeekContext.swapSlots.slot1?.cardIndex === index) {
              isMarkedForAbility = true;
            }
            if (abilityPeekContext.swapSlots.slot2?.playerId === playerId && abilityPeekContext.swapSlots.slot2?.cardIndex === index) {
              isMarkedForAbility = true;
            }
          }
        }
        
        return (
          <CardDisplay
            key={cardFromProps.id || `player-card-${playerId}-${index}`}
            card={cardToRender}
            onClick={onCardClick ? () => onCardClick(playerId, cardToRender, index) : undefined}
            isSelected={isOwner && selectedHandCardIndex === index}
            isTemporarilyRevealed={isTemporarilyRevealed}
            isAbilitySelected={isMarkedForAbility}
          />
        );
      })}
      {cards.length === 0 && (
        <div className="text-gray-500 italic col-span-2 text-center">Hand is empty</div>
      )}
    </div>
  );
};

export default PlayerHand; 