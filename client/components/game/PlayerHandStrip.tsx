import React from 'react';
import { useUISelector, useUIActorRef, type UIMachineSnapshot } from '@/context/GameUIContext';
import { type Player, TurnPhase, PlayerActionType } from 'shared-types';
import PlayerHand from './PlayerHand';
import { cn } from '@/lib/utils';
import { useActionController } from './ActionController';
import { User, CheckCircle, WifiOff, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PlayerHandStripProps {
  player: Player;
  isLocalPlayer: boolean;
  isCurrentTurn: boolean;
}

const selectStripContext = (state: UIMachineSnapshot) => {
  const { currentGameState, currentAbilityContext, localPlayerId } = state.context;
  const turnPhase = currentGameState?.turnPhase;
  const isMyTurn = currentGameState?.currentPlayerId === localPlayerId;
  
  const canSwap = isMyTurn && turnPhase === TurnPhase.DISCARD;
  const canMatch = isMyTurn && turnPhase === TurnPhase.MATCHING;
  const isTargetableForAbility = !!currentAbilityContext;

  return { canSwap, canMatch, isTargetableForAbility };
};

const PlayerInfoBadge = ({ player, isCurrentTurn }: { player: Player, isCurrentTurn: boolean }) => {
  const getStatus = () => {
    if (!player.isConnected) return { Icon: WifiOff, text: "Disconnected", color: "text-rose-700 dark:text-rose-400" };
    if (player.hasCalledCheck) return { Icon: CheckCircle, text: "Check Called", color: "text-sky-600 dark:text-sky-400" };
    // 'isReady' is more of a lobby state, so we check connection/check status first in-game.
    return { Icon: Clock, text: "Waiting", color: "text-stone-600 dark:text-stone-400" };
  };

  const { Icon, text, color } = getStatus();

  return (
    <div className="flex flex-col items-center gap-2 font-serif">
      <h3 className="flex items-center gap-2 text-lg text-stone-900 dark:text-stone-100">
        <User size={16} className={cn("transition-colors", isCurrentTurn && 'text-teal-500 dark:text-teal-400')} />
        <span className="relative">
          {player.name}
          <AnimatePresence>
          {isCurrentTurn && (
            <motion.div
              className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-teal-500 dark:bg-teal-400"
              layoutId={`turn-indicator-${player.id}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1, originX: '50%' }}
              exit={{ scaleX: 0, originX: '50%' }}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />
          )}
          </AnimatePresence>
        </span>
      </h3>

      <div className={cn("flex items-center gap-1.5 text-xs font-medium", color)}>
        <Icon className="h-3 w-3" />
        <span>{text}</span>
      </div>
    </div>
  )
}

export const PlayerHandStrip: React.FC<PlayerHandStripProps> = ({
  player,
  isLocalPlayer,
  isCurrentTurn,
}) => {
  const { canSwap, canMatch, isTargetableForAbility } = useUISelector(selectStripContext);

  const { send } = useUIActorRef();
  const { selectedCardIndex, setSelectedCardIndex } = useActionController();

  const handleCardClick = (cardIndex: number) => {
    // An ability is active, and this player's cards can be targeted.
    if (isTargetableForAbility) {
      send({ type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY', playerId: player.id, cardIndex });
      return;
    }

    // No ability, check for turn-based actions for the local player.
    if (isLocalPlayer) {
      if (canSwap) {
        send({ type: PlayerActionType.SWAP_AND_DISCARD, payload: { handCardIndex: cardIndex } });
        return;
      }
  
      if (canMatch) {
        setSelectedCardIndex(cardIndex);
        return;
      }
    }
  };
  
  // A player's hand is interactive if an ability is targeting them,
  // or if it's the local player's turn for swapping or matching.
  const canInteract = isTargetableForAbility || (isLocalPlayer && (canSwap || canMatch));

  // Use a larger card size for the local player; smaller for opponents.
  const cardSize: 'xs' = 'xs';

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center p-2 gap-2'
      )}
    >
      <PlayerInfoBadge player={player} isCurrentTurn={isCurrentTurn} />
      <PlayerHand
        player={player}
        isLocalPlayer={isLocalPlayer}
        onCardClick={handleCardClick}
        canInteract={canInteract}
        selectedCardIndex={isLocalPlayer ? selectedCardIndex : undefined}
        cardSize={cardSize}
      />
    </div>
  );
};

export default PlayerHandStrip; 