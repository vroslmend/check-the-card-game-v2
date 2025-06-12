"use client"

import React, { useContext } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelector } from '@xstate/react';
import {
  UIContext,
  type UIMachineSnapshot,
} from '@/components/providers/UIMachineProvider';
import { type PlayerId, type Player, type ClientAbilityContext } from 'shared-types';
import { PlayerPod, type PlayerPodProps } from './PlayerPod';
import logger from '@/lib/logger';

const selectOpponentProps = (state: UIMachineSnapshot) => {
  const { localPlayerId, currentGameState } = state.context;
  if (!currentGameState || !localPlayerId) {
    return { opponentPlayers: [], currentPlayerId: null, abilityContext: undefined };
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

interface OpponentPodProps {
  player: Player;
  onCardClick: (playerId: PlayerId, cardIndex: number) => void;
  isCurrentTurn: boolean;
  abilityContext: ClientAbilityContext | undefined;
}

const OpponentPod = ({ player, onCardClick, isCurrentTurn, abilityContext }: OpponentPodProps) => {
  // Determine if this opponent is a valid target for the current ability
  const isTargetable =
    abilityContext?.validPeekTargets?.some((p) => p.playerId === player.id) ||
    abilityContext?.validSwapTargets?.some((p) => p.playerId === player.id) ||
    false; // Explicitly default to false if context is undefined

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
  const { actorRef } = useContext(UIContext)!;
  const { opponentPlayers, currentPlayerId, abilityContext } = useSelector(actorRef, selectOpponentProps);

  const handleCardClick = (playerId: PlayerId, cardIndex: number) => {
    if (abilityContext) {
      logger.debug({ playerId, cardIndex, abilityContext }, 'Opponent card clicked for ability');
      actorRef.send({ type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY', playerId, cardIndex });
    }
  };

  if (!opponentPlayers.length) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-stone-50 dark:bg-zinc-800/50 shadow-inner">
        <p className="font-serif text-stone-500">Waiting for opponents...</p>
      </div>
    );
  }

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
              abilityContext={abilityContext}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};