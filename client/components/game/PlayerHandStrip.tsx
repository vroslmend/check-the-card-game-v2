import React from "react";
import {
  useUISelector,
  useUIActorRef,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import {
  type Player,
  TurnPhase,
  PlayerActionType,
  PlayerStatus,
  GameStage,
} from "shared-types";
import PlayerHand from "./PlayerHand";
import { cn } from "@/lib/utils";
import { useActionController } from "./ActionController";
import {
  User,
  CheckCircle,
  WifiOff,
  Clock,
  PlayCircle,
  ArrowRightCircle,
  Ban,
  Eye,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";

interface PlayerHandStripProps {
  player: Player;
  isLocalPlayer: boolean;
  isCurrentTurn: boolean;
}

const selectStripContext = (state: UIMachineSnapshot) => {
  const {
    currentGameState,
    currentAbilityContext,
    localPlayerId,
    hasPassedMatch,
  } = state.context;
  const turnPhase = currentGameState?.turnPhase;
  const isMyTurn = currentGameState?.currentPlayerId === localPlayerId;

  const canSwap = isMyTurn && turnPhase === TurnPhase.DISCARD;

  const canParticipateInMatch =
    !!currentGameState?.matchingOpportunity?.remainingPlayerIDs.includes(
      localPlayerId!,
    );
  const canMatch = canParticipateInMatch && !hasPassedMatch;

  const isTargetableForAbility = !!currentAbilityContext;

  return {
    canSwap,
    canMatch,
    isTargetableForAbility,
    gameStage: currentGameState?.gameStage ?? null,
    matchingPlayerIds:
      currentGameState?.matchingOpportunity?.remainingPlayerIDs ?? null,
    publicPeekerId: currentGameState?.publicPeek?.peekerId ?? null,
  };
};

const PlayerInfoBadge = ({
  player,
  isCurrentTurn,
  isLocalPlayer,
  gameStage,
  isInMatchingWindow,
  isPeekingCards,
}: {
  player: Player;
  isCurrentTurn: boolean;
  isLocalPlayer: boolean;
  gameStage: GameStage | null;
  isInMatchingWindow: boolean;
  isPeekingCards: boolean;
}) => {
  const getStatus = () => {
    if (!player.isConnected)
      return {
        Icon: WifiOff,
        text: "Disconnected",
        color: "text-rose-700 dark:text-rose-400",
      };
    if (player.status === PlayerStatus.DISQUALIFIED)
      return {
        Icon: Ban,
        text: "Disqualified",
        color: "text-rose-700 dark:text-rose-400",
      };
    if (isPeekingCards)
      return {
        Icon: Eye,
        text: "Peeking",
        color: "text-amber-600 dark:text-amber-400",
      };
    if (isInMatchingWindow)
      return {
        Icon: Zap,
        text: "Matching…",
        color: "text-amber-600 dark:text-amber-400",
      };
    if (isCurrentTurn)
      return {
        Icon: isLocalPlayer ? PlayCircle : ArrowRightCircle,
        text: isLocalPlayer ? "Your Turn" : "Playing",
        color: "text-teal-500 dark:text-teal-400/80",
      };
    if (player.hasCalledCheck)
      return {
        Icon: CheckCircle,
        text: "Check Called",
        color: "text-sky-600 dark:text-sky-400",
      };
    if (gameStage === GameStage.INITIAL_PEEK)
      return player.isReady
        ? {
            Icon: CheckCircle,
            text: "Ready",
            color: "text-teal-600 dark:text-teal-400",
          }
        : {
            Icon: Eye,
            text: "Peeking",
            color: "text-stone-600 dark:text-stone-400",
          };
    return {
      Icon: Clock,
      text: "Waiting",
      color: "text-stone-600 dark:text-stone-400",
    };
  };

  const { Icon, text, color } = getStatus();

  return (
    <div className="flex flex-col items-center gap-2 font-game">
      <h3
        className={cn(
          "flex items-center gap-2 text-[clamp(1rem,2.5vw,1.125rem)] transition-colors",
          isCurrentTurn
            ? "text-teal-500 dark:text-teal-400/80"
            : "text-stone-900 dark:text-stone-100",
        )}
      >
        <User
          size={16}
          className={cn(
            "transition-colors",
            isCurrentTurn
              ? "text-teal-500 dark:text-teal-400/80"
              : "text-stone-600 dark:text-stone-400",
          )}
        />
        <motion.span
          className="inline-block"
          animate={isCurrentTurn ? { scale: 1.05 } : { scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        >
          {player.name}
        </motion.span>
      </h3>

      <div
        className={cn(
          "flex items-center gap-1.5 text-[clamp(0.7rem,2vw,0.75rem)] font-medium",
          color,
        )}
      >
        <Icon className="h-3 w-3" />
        <span>{text}</span>
      </div>
    </div>
  );
};

export const PlayerHandStrip: React.FC<PlayerHandStripProps> = ({
  player,
  isLocalPlayer,
  isCurrentTurn,
}) => {
  const {
    canSwap,
    canMatch,
    isTargetableForAbility,
    gameStage,
    matchingPlayerIds,
    publicPeekerId,
  } = useUISelector(selectStripContext);

  const { send } = useUIActorRef();
  const { setMatchAttempt, matchAttempt } = useActionController();

  const handleCardClick = (cardIndex: number) => {
    if (isLocalPlayer && canMatch) {
      setMatchAttempt({ cardIndex });
      return;
    }

    if (isTargetableForAbility) {
      send({
        type: "PLAYER_SLOT_CLICKED_FOR_ABILITY",
        playerId: player.id,
        cardIndex,
      });
      return;
    }

    if (isLocalPlayer) {
      if (canSwap) {
        send({
          type: PlayerActionType.SWAP_AND_DISCARD,
          payload: { handCardIndex: cardIndex },
        });
        return;
      }
    }
  };

  const canInteract =
    !player.isLocked &&
    (isTargetableForAbility || (isLocalPlayer && (canSwap || canMatch)));

  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className="flex flex-col items-center gap-2"
    >
      <PlayerInfoBadge
        player={player}
        isCurrentTurn={isCurrentTurn}
        isLocalPlayer={isLocalPlayer}
        gameStage={gameStage}
        isInMatchingWindow={!!matchingPlayerIds?.includes(player.id)}
        isPeekingCards={publicPeekerId === player.id}
      />
      <PlayerHand
        player={player}
        isLocalPlayer={isLocalPlayer}
        onCardClick={handleCardClick}
        canInteract={canInteract}
        isLocked={player.isLocked}
        selectedCardIndex={
          isLocalPlayer && canMatch ? matchAttempt?.cardIndex : undefined
        }
        className="w-full max-w-md"
      />
    </motion.div>
  );
};

export default PlayerHandStrip;
