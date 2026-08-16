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
  /** Tightly set table (3+ opponents): one-line seat header. */
  compact?: boolean;
  /** Small cards. Opponents on a dense table, and every seat at the end-scene
   *  reveal; the local hand stays regular-size during play. */
  denseCards?: boolean;
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
  compact = false,
}: {
  player: Player;
  isCurrentTurn: boolean;
  isLocalPlayer: boolean;
  gameStage: GameStage | null;
  isInMatchingWindow: boolean;
  isPeekingCards: boolean;
  isInitialPeekWindow: boolean;
  compact?: boolean;
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
  // End scene: the results panel carries every status; the chips would be
  // stale noise and their height crowds the revealed hands.
  const hideChip =
    gameStage === GameStage.SCORING || gameStage === GameStage.GAMEOVER;

  // Dense table: one-line header (dot + name + status icon), no full chip —
  // the two-line header is what made every seat cost ~54px of chrome. The
  // full status text still lives on the results sheet and in the log.
  if (compact) {
    return (
      // Every seat reads the same: turn dot, name, status icon, pinned to the
      // width of its own hand so the name sits over its cards rather than
      // beside them.
      //
      // Nothing in here changes width during a turn. The dot keeps its space
      // whether or not it is showing and the status is an icon, so the header
      // cannot resize mid turn and slide the cards sideways to recentre. That
      // is the drift fix, reached by making the header constant rather than by
      // constraining what it may do.
      //
      // Your own status was the words "Your Turn" here, which is why this seat
      // used to need its own rule: the words never fit over a hand's width, so
      // the header either overhung its cards or truncated the name to nothing.
      // The dot already says whose turn it is, and the action bar says it
      // again.
      <div className="grid w-0 min-w-full grid-cols-[1fr_auto_1fr] items-center gap-1.5 font-game">
        {/* The name is what the eye reads as centred, so the name is what is
            centred: it sits in the middle column with two equal 1fr columns
            either side. The dot and the icon hug it from the inside edge of
            those columns rather than being pushed out to the hand's edges.
            Centring the whole group instead leaves the name off centre,
            because the dot's ink is 6px against the icon's 14px. */}
        <span className="flex justify-end">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full bg-accent",
              !isCurrentTurn && "invisible",
            )}
            aria-hidden
          />
        </span>
        <span
          className={cn(
            "min-w-0 truncate text-sm font-bold text-ink",
            isDisqualified && "text-ink-muted line-through",
          )}
        >
          {player.name}
        </span>
        <span className="flex justify-start">
          <Icon
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              hideChip && "invisible",
              muted ? "text-ink-muted" : "text-ink",
            )}
            aria-label={text}
          />
        </span>
      </div>
    );
  }

  return (
    // Same rule as the compact header above: the hand sets the seat's width.
    <div className="flex w-0 min-w-full flex-col items-center gap-2 font-game">
      <h3 className="flex max-w-full items-center gap-2 text-[clamp(1rem,2.5vw,1.125rem)] font-bold text-ink">
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

      {!hideChip && (
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[clamp(0.7rem,2vw,0.75rem)] font-semibold",
            muted ? "text-ink-muted" : "text-ink",
          )}
        >
          <Icon className="h-3 w-3" />
          <span>{text}</span>
        </div>
      )}
    </div>
  );
};

/** One quiet settle when a player is disqualified: the strip dips 3px and
 *  returns while the locked dim lands. One register below PENALTY. */
const useDisqualifiedBeat = (status: PlayerStatus): boolean => {
  const [beat, setBeat] = React.useState(false);
  const prevRef = React.useRef<PlayerStatus | null>(null);
  const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevRef.current = status;
      return;
    }
    const wasDq = prevRef.current === PlayerStatus.DISQUALIFIED;
    prevRef.current = status;
    if (status === PlayerStatus.DISQUALIFIED && !wasDq) {
      setBeat(true);
      const t = setTimeout(() => setBeat(false), 350);
      return () => clearTimeout(t);
    }
  }, [status]);
  return beat;
};

export const PlayerHandStrip: React.FC<PlayerHandStripProps> = ({
  player,
  isLocalPlayer,
  isCurrentTurn,
  tableIndex,
  compact = false,
  denseCards = false,
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
  const dqBeat = useDisqualifiedBeat(player.status);

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
      // The dq dip is three keyframes and motion springs only take two: on
      // the shared spring the beat threw motion's invariant mid-frame-batch
      // and could leave every later animation dead (reveal flips, results
      // sheet). y gets its own tween; layout keeps the spring.
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 40,
        y: { type: "tween", duration: 0.35, ease: "easeInOut" },
      }}
      animate={dqBeat ? { y: [0, 3, 0] } : { y: 0 }}
      className={cn("flex flex-col items-center", compact ? "gap-1" : "gap-2")}
    >
      <PlayerInfoBadge
        player={player}
        isCurrentTurn={isCurrentTurn}
        isLocalPlayer={isLocalPlayer}
        gameStage={gameStage}
        isInMatchingWindow={!!matchingPlayerIds?.includes(player.id)}
        isPeekingCards={publicPeekerId === player.id}
        isInitialPeekWindow={initialPeekWindowActive}
        compact={compact}
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
        // w-fit, not w-full. The grid's tracks are 1fr and the cards inside
        // them are a fixed width, so a hand told to fill a seat wider than
        // itself widens its tracks and leaves the cards sitting apart. Your own
        // seat is wider than its hand now, and the gap between your cards
        // should not depend on how long your name is.
        className="w-fit max-w-md"
        dense={denseCards}
      />
    </motion.div>
  );
};

export default PlayerHandStrip;
