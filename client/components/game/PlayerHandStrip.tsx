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
  /** Position around the table; staggers the end-of-round reveal and the
   *  deal ripple. */
  tableIndex: number;
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

  // The bottom-two faces only reveal once the peek window opens (all players
  // ready, or the ready-stall timeout forced it). Locally detectable: our own
  // initial-peek cards are in visibleCards exactly for that window.
  const initialPeekWindowActive =
    currentGameState?.gameStage === GameStage.INITIAL_PEEK &&
    state.context.visibleCards.some((vc) => vc.source === "initial-peek");

  return {
    canSwap,
    canMatch,
    isTargetableForAbility,
    initialPeekWindowActive,
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
  isInitialPeekWindow,
}: {
  player: Player;
  isCurrentTurn: boolean;
  isLocalPlayer: boolean;
  gameStage: GameStage | null;
  isInMatchingWindow: boolean;
  isPeekingCards: boolean;
  isInitialPeekWindow: boolean;
}) => {
  // Status is text + icon only — no hue coding. `muted` dims passive states
  // (waiting/disconnected/disqualified) to ink-muted; active states read ink.
  const getStatus = (): { Icon: typeof User; text: string; muted: boolean } => {
    if (!player.isConnected)
      return { Icon: WifiOff, text: "Disconnected", muted: true };
    if (player.status === PlayerStatus.DISQUALIFIED)
      return { Icon: Ban, text: "Disqualified", muted: true };
    if (isPeekingCards) return { Icon: Eye, text: "Peeking", muted: false };
    if (isInMatchingWindow)
      return { Icon: Zap, text: "Matching…", muted: false };
    if (isCurrentTurn)
      return {
        Icon: isLocalPlayer ? PlayCircle : ArrowRightCircle,
        text: isLocalPlayer ? "Your Turn" : "Playing",
        muted: false,
      };
    if (player.hasCalledCheck)
      return { Icon: CheckCircle, text: "Check Called", muted: false };
    if (gameStage === GameStage.INITIAL_PEEK) {
      // Before the window opens nobody can see anything — the label is about
      // readiness. Once it opens, everyone is actually peeking. (The old
      // mapping was inverted on both ends.)
      if (isInitialPeekWindow)
        return { Icon: Eye, text: "Peeking", muted: false };
      return player.isReady
        ? { Icon: CheckCircle, text: "Ready", muted: false }
        : { Icon: Clock, text: "Not ready", muted: true };
    }
    return { Icon: Clock, text: "Waiting", muted: true };
  };

  const { Icon, text, muted } = getStatus();
  const isDisqualified = player.status === PlayerStatus.DISQUALIFIED;

  return (
    <div className="flex flex-col items-center gap-2 font-game">
      <h3 className="flex items-center gap-2 text-[clamp(1rem,2.5vw,1.125rem)] font-bold text-ink">
        {/* The one "whose turn" color on screen: an accent dot before the name. */}
        {isCurrentTurn && (
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        )}
        <User size={16} className="text-ink-muted" />
        <motion.span
          className={cn(
            "inline-block",
            isDisqualified && "text-ink-muted line-through",
          )}
          animate={isCurrentTurn ? { scale: 1.05 } : { scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        >
          {player.name}
        </motion.span>
      </h3>

      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[clamp(0.7rem,2vw,0.75rem)] font-semibold",
          muted ? "text-ink-muted" : "text-ink",
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
  tableIndex,
}) => {
  const {
    canSwap,
    canMatch,
    isTargetableForAbility,
    initialPeekWindowActive,
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
        isInitialPeekWindow={initialPeekWindowActive}
      />
      <PlayerHand
        player={player}
        isLocalPlayer={isLocalPlayer}
        onCardClick={handleCardClick}
        canInteract={canInteract}
        isLocked={player.isLocked}
        tableIndex={tableIndex}
        selectedCardIndex={
          isLocalPlayer && canMatch ? matchAttempt?.cardIndex : undefined
        }
        className="w-full max-w-md"
      />
    </motion.div>
  );
};

export default PlayerHandStrip;
