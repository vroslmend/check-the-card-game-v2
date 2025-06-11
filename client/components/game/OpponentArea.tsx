"use client"

import React, { useContext } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelector } from '@xstate/react';
import {
  UIContext,
  type UIMachineSnapshot,
} from '@/components/providers/UIMachineProvider';
import { type PlayerId } from 'shared-types';
import { PlayerPod } from './PlayerPod';
import logger from '@/lib/logger';

const selectOpponentProps = (state: UIMachineSnapshot) => {
  const { localPlayerId, currentGameState } = state.context;
  if (!currentGameState || !localPlayerId) {
    return { opponentPlayers: [], currentPlayerId: null };
  }

  const opponentPlayers = Object.values(currentGameState.players).filter(
    (p) => p.id !== localPlayerId
  );

  return {
    opponentPlayers,
    currentPlayerId: currentGameState.currentPlayerId,
    abilityContext: state.context.currentAbilityContext,
  };
};

export const OpponentArea = () => {
  const { actorRef } = useContext(UIContext)!;
  const { opponentPlayers, currentPlayerId, abilityContext } = useSelector(actorRef, selectOpponentProps);

  if (!opponentPlayers.length) {
    return <div className="h-[220px]" />; // Placeholder for layout stability
  }

  const handleCardClick = (playerId: PlayerId, cardIndex: number) => {
    if (abilityContext) {
      logger.debug({ playerId, cardIndex, abilityContext }, 'Opponent card clicked for ability');
      actorRef.send({ type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY', playerId, cardIndex });
    }
  };

  return (
    <div className="w-full flex items-start justify-center gap-4 md:gap-8">
      <AnimatePresence>
        {opponentPlayers.map((player) => (
          <motion.div key={player.id}>
            <PlayerPod
              player={player}
              isLocalPlayer={false}
              isCurrentTurn={player.id === currentPlayerId}
              onCardClick={(cardIndex) => handleCardClick(player.id, cardIndex)}
              isChoosingSwapTarget={false}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};