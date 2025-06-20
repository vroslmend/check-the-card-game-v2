"use client"

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUISelector, useUIActorRef, type UIMachineSnapshot } from '@/context/GameUIContext';
import { type PlayerId, type Player, type ClientAbilityContext } from 'shared-types';
import { PlayerPod } from './PlayerPod';
import logger from '@/lib/logger';

const selectOpponentProps = (state: UIMachineSnapshot) => {
  const { localPlayerId, currentGameState, currentAbilityContext } = state.context;
  if (!currentGameState || !localPlayerId) {
    return { opponentPlayers: [], currentPlayerId: null, abilityContext: undefined };
  }

  const opponentPlayers = Object.values(currentGameState.players).filter(
    (p) => p.id !== localPlayerId
  );

  return {
    opponentPlayers,
    currentPlayerId: currentGameState.currentPlayerId,
    abilityContext: currentAbilityContext,
  };
};

const OpponentPod = ({ player, onCardClick, isCurrentTurn, isTargetable, abilityContext }: { 
  player: Player; 
  onCardClick: (playerId: PlayerId, cardIndex: number) => void; 
  isCurrentTurn: boolean; 
  isTargetable: boolean;
  abilityContext: ClientAbilityContext | undefined; 
}) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="relative"
    >
      <PlayerPod
        player={player}
        isLocalPlayer={false}
        isCurrentTurn={isCurrentTurn}
        onCardClick={(cardIndex) => onCardClick(player.id, cardIndex)}
        isTargetable={isTargetable}
        abilityContext={abilityContext}
      />
    </motion.div>
  );
}

export const OpponentArea = () => {
  const { opponentPlayers, currentPlayerId, abilityContext } = useUISelector(selectOpponentProps);
  const { send } = useUIActorRef();

  const handleCardClick = (playerId: PlayerId, cardIndex: number) => {
    if (abilityContext) {
      logger.debug({ playerId, cardIndex, abilityContext }, 'Opponent card clicked for ability');
      send({ type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY', playerId, cardIndex });
    }
  };

  if (!opponentPlayers.length) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-stone-50 dark:bg-zinc-800/50 shadow-inner">
        <p className="font-serif text-stone-500">Waiting for opponents...</p>
      </div>
    );
  }

  const isAbilityTargetingPhase = !!abilityContext;

  return (
    <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-4 rounded-lg bg-stone-50 dark:bg-zinc-800/50 shadow-inner">
      <motion.div layout className="flex flex-row items-center justify-center gap-4 h-full w-full">
        <AnimatePresence>
          {opponentPlayers.map((player) => (
            <OpponentPod 
              key={player.id}
              player={player}
              onCardClick={handleCardClick}
              isCurrentTurn={player.id === currentPlayerId}
              isTargetable={isAbilityTargetingPhase && !player.isLocked}
              abilityContext={abilityContext}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};