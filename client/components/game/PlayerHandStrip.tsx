import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUISelector, useUIActorRef, type UIMachineSnapshot } from '@/context/GameUIContext';
import { type Player, TurnPhase, type ClientAbilityContext, PlayerActionType, type PlayerId } from 'shared-types';
import { User, Eye, CheckCircle, ShieldCheck, WifiOff, Clock, UserCheck, ArrowDown } from 'lucide-react';
import PlayerHand from './PlayerHand';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';
import { useActionController } from './ActionController';
import { isDrawnCard } from '@/lib/types';

interface PlayerHandStripProps {
  player: Player;
  isLocalPlayer: boolean;
  isCurrentTurn: boolean;
  isTargetable: boolean;
  abilityContext?: ClientAbilityContext;
}

const selectStripContext = (state: UIMachineSnapshot) => {
  const { currentGameState, currentAbilityContext, localPlayerId } = state.context;
  const turnPhase = currentGameState?.turnPhase;
  const isMyTurn = currentGameState?.currentPlayerId === localPlayerId;
  const isChoosingSwapTarget = isMyTurn && turnPhase === TurnPhase.DISCARD;
  return {
    currentAbilityContext,
    localPlayerId,
    isChoosingSwapTarget,
    turnPhase,
    currentGameState,
  };
};

const StatusIndicator = ({ icon: Icon, text, colorClass }: { icon: React.ElementType; text: string; colorClass: string }) => (
  <div className={cn('flex items-center gap-1.5 text-xs font-light', colorClass)}>
    <Icon className="h-3 w-3" />
    <p>{text}</p>
  </div>
);

export const PlayerHandStrip: React.FC<PlayerHandStripProps> = ({
  player,
  isLocalPlayer,
  isCurrentTurn,
  isTargetable,
  abilityContext,
}) => {
  const {
    currentAbilityContext,
    localPlayerId,
    isChoosingSwapTarget,
    turnPhase,
    currentGameState,
  } = useUISelector(selectStripContext);

  const { send } = useUIActorRef();
  const { selectedCardIndex, setSelectedCardIndex } = useActionController();

  const activeAbility = abilityContext ?? currentAbilityContext;

  const handleCardClick = (cardIndex: number) => {
    if (activeAbility) {
      logger.debug({ playerId: player.id, cardIndex, activeAbility }, 'Card clicked for ability');
      send({ type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY', playerId: player.id, cardIndex });
      return;
    }

    if (isLocalPlayer && isChoosingSwapTarget) {
      logger.debug({ cardIndex }, 'Local card click for swap and discard');
      send({ type: PlayerActionType.SWAP_AND_DISCARD, payload: { handCardIndex: cardIndex } });
      return;
    }

    if (isLocalPlayer && turnPhase === TurnPhase.MATCHING) {
      logger.debug({ cardIndex }, 'Local card click for match attempt');
      setSelectedCardIndex(cardIndex);
      return;
    }

    // Otherwise no-op
  };

  const getStatus = () => {
    if (player.hasCalledCheck) return (
      <StatusIndicator icon={ShieldCheck} text="Check Called" colorClass="text-blue-500" />
    );
    if (!player.isConnected)
      return <StatusIndicator icon={WifiOff} text="Disconnected" colorClass="text-red-500" />;
    if (player.isReady)
      return <StatusIndicator icon={CheckCircle} text="Ready" colorClass="text-emerald-500" />;
    return <StatusIndicator icon={Clock} text="Waiting" colorClass="text-stone-500 dark:text-stone-400" />;
  };

  const promptText = isLocalPlayer && isChoosingSwapTarget ? 'Select a hand card to swap' : undefined;

  const extraSpace = isCurrentTurn || isTargetable ? 'my-2' : '';

  return (
    <motion.div
      layout
      className={cn(
        'relative flex flex-col items-center gap-2 p-3 rounded-xl bg-white dark:bg-zinc-900 border shadow-inner overflow-visible',
        isCurrentTurn ? 'border-emerald-500' : 'border-stone-200 dark:border-zinc-800',
        isTargetable && 'ring-2 ring-offset-2 ring-offset-stone-100 dark:ring-offset-zinc-900 ring-purple-500',
        extraSpace
      )}
    >
      {/* Target pulsing border */}
      <AnimatePresence>
        {isTargetable && (
          <motion.div
            className="absolute inset-0 rounded-xl border border-purple-500 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      {/* Header (name + status) */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'relative flex h-7 w-7 items-center justify-center rounded-full',
              isCurrentTurn ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-stone-100 dark:bg-zinc-800'
            )}
          >
            <User
              className={cn(
                'h-4 w-4',
                isCurrentTurn ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-500 dark:text-stone-400'
              )}
            />
          </div>
          <span className="font-serif text-base text-stone-800 dark:text-stone-200">{player.name}</span>
        </div>
        <div className="mt-1 h-4">{getStatus()}</div>
      </div>

      {/* Hand */}
      <div className="mt-1 w-full flex flex-col items-center">
        <PlayerHand
          player={player}
          isLocalPlayer={isLocalPlayer}
          onCardClick={handleCardClick}
          abilityContext={activeAbility}
          isTargetable={isTargetable}
          selectedCardIndex={isLocalPlayer ? selectedCardIndex : undefined}
        />
        {promptText && (
          <AnimatePresence>
            <motion.div
              className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
            >
              <ArrowDown className="w-3 h-3" />
              {promptText}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};

export default PlayerHandStrip; 