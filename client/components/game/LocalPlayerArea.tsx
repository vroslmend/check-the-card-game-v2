"use client"

import { useContext } from 'react';
import { useSelector } from '@xstate/react';
import { UIContext, type UIMachineSnapshot } from '@/components/providers/UIMachineProvider';
import { TurnPhase } from 'shared-types';
import logger from '@/lib/logger';
import { PlayerPod } from './PlayerPod';

const selectLocalPlayerProps = (state: UIMachineSnapshot) => {
  const { currentGameState, localPlayerId, currentAbilityContext } = state.context;
  const isChoosingSwapTarget = state.matches({ inGame: { playing: 'selectingSwapTarget' } });

  return {
    localPlayer: localPlayerId ? currentGameState?.players[localPlayerId] : null,
    isCurrentTurn: currentGameState?.currentPlayerId === localPlayerId,
    turnPhase: currentGameState?.turnPhase,
    abilityContext: currentAbilityContext,
    localPlayerId,
    isChoosingSwapTarget,
  };
};

export const LocalPlayerArea = () => {
  const { actorRef } = useContext(UIContext)!;
  const {
    localPlayer,
    isCurrentTurn,
    turnPhase,
    abilityContext,
    localPlayerId,
    isChoosingSwapTarget,
  } = useSelector(actorRef, selectLocalPlayerProps);

  if (!localPlayer || !localPlayerId) {
    return <div className="h-[250px]" />; // Placeholder for layout stability
  }

  const handleCardClick = (cardIndex: number) => {
    if (abilityContext) {
      logger.debug({ cardIndex, abilityContext }, 'Card clicked for ability');
      actorRef.send({ type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY', playerId: localPlayerId, cardIndex });
      return;
    }

    if (isChoosingSwapTarget) {
      logger.debug({ cardIndex }, 'Card clicked for swap and discard');
      actorRef.send({ type: 'SWAP_AND_DISCARD', cardIndex });
      return;
    }

    if (turnPhase === TurnPhase.MATCHING) {
      logger.debug({ cardIndex }, 'Card clicked for match attempt');
      actorRef.send({ type: 'ATTEMPT_MATCH', handCardIndex: cardIndex });
      return;
    }

    logger.warn({ cardIndex, turnPhase, isMyTurn: isCurrentTurn }, 'Card click had no effect');
  };
  
  return (
    <PlayerPod 
      player={localPlayer}
      isLocalPlayer={true}
      isCurrentTurn={isCurrentTurn}
      onCardClick={handleCardClick}
      isChoosingSwapTarget={isChoosingSwapTarget}
    />
  );
};