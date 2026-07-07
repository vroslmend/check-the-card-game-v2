"use client";

import { useEffect, useState } from "react";
import {
  useUISelector,
  useUIActorRef,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { TableArea } from "./TableArea";
import PlayerHandStrip from "./PlayerHandStrip";
import { GameStage, PlayerActionType, type PublicCard } from "shared-types";
import { cn } from "@/lib/utils";
import { ActionController } from "./ActionController";
import { ActionControllerView } from "./ActionControllerView";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RoundSummary } from "./RoundSummary";
import { GameHeader } from "./GameHeader";
import SidePanel from "@/components/layout/SidePanel";
import { useCheckMoment, CheckStamp } from "./CheckMoment";
import { usePenaltyMoment, PenaltyStamp } from "./PenaltyMoment";
import { useAbilityMoment, AbilityStamp } from "./AbilityMoment";
import { useMatchMoment, MatchStamp } from "./MatchMoment";
import { GameEventCaption } from "./GameEventCaption";

const selectIsDisconnected = (state: UIMachineSnapshot) =>
  state.matches({ inGame: "disconnected" });
const selectIsReconnecting = (state: UIMachineSnapshot) =>
  state.matches({ inGame: "reconnecting" });

const selectGameBoardProps = (state: UIMachineSnapshot) => {
  const { currentGameState: gameState, localPlayerId } = state.context;
  const playerWithPendingCard = Object.values(gameState?.players ?? {}).find(
    (p) => p.pendingDrawnCard,
  );

  return {
    gameState: gameState,
    localPlayerId: localPlayerId,
    playerWithPendingCard: playerWithPendingCard,
    isMyTurn: gameState?.currentPlayerId === localPlayerId,
    localPlayerForfeited:
      !!localPlayerId && !!gameState?.players[localPlayerId]?.forfeited,
  };
};

const selectGameEndProps = (state: UIMachineSnapshot) => {
  const gameState = state.context.currentGameState;
  const fallbackWinner = gameState?.winnerId ? [gameState.winnerId] : [];
  return {
    gameStage: gameState?.gameStage,
    players: Object.values(gameState?.players ?? {}),
    winnerIds: gameState?.gameover?.winnerIds ?? fallbackWinner,
  };
};

const ConnectionStatusBanner = () => {
  const isDisconnected = useUISelector(selectIsDisconnected);
  const isReconnecting = useUISelector(selectIsReconnecting);
  if (!isDisconnected && !isReconnecting) return null;
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-accent text-accent-ink px-4 py-2 rounded-pill z-50">
      {isReconnecting ? "Reconnecting..." : "Connection Lost"}
    </div>
  );
};

const GameStateError = ({
  hasPlayers,
  hasGameState,
}: {
  hasPlayers: boolean | undefined;
  hasGameState: boolean;
}) => {
  if (hasPlayers || !hasGameState) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-ink/50 z-50">
      <div className="bg-surface text-ink p-4 rounded-card border border-hairline shadow-lg">
        <h3 className="font-bold">Game State Error</h3>
        <p className="text-ink-muted">
          Could not load player data. Please refresh the page.
        </p>
      </div>
    </div>
  );
};

const LoadingIndicator = () => (
  <div className="flex items-center justify-center h-screen w-full bg-ground">
    <p className="font-game text-ink-muted">Loading Game...</p>
  </div>
);

// Shown to a player whose seat was forfeited after a failed reconnect: the
// board underneath is real but locked for them, which otherwise reads as a
// silent hardstuck. Dismissible so they can spectate instead.
const ForfeitNotice = ({ onLeave }: { onLeave: () => void }) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ground/80 p-4">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-hairline bg-surface p-8 text-center">
        <h3 className="text-2xl font-extrabold text-ink">
          You forfeited this round
        </h3>
        <p className="text-sm text-ink-muted">
          You were disconnected for too long, so your seat was forfeited. You
          can keep watching, or head home.
        </p>
        <button
          onClick={onLeave}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-accent-ink hover:bg-accent/90"
        >
          Back to Home
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs font-semibold text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          Keep watching
        </button>
      </div>
    </div>
  );
};

export function GameBoard() {
  const { send } = useUIActorRef();
  const {
    gameState,
    localPlayerId,
    playerWithPendingCard,
    isMyTurn,
    localPlayerForfeited,
  } = useUISelector(selectGameBoardProps);
  const { gameStage, players, winnerIds } = useUISelector(selectGameEndProps);
  const checkMoment = useCheckMoment();
  const penaltyMoment = usePenaltyMoment();
  const abilityMoment = useAbilityMoment();
  const matchMoment = useMatchMoment();
  const reducedMotion = useReducedMotion();

  // The round-ending broadcast both moves the last card and flips the stage:
  // mounting the end sheet immediately buries a flight ~0.3s into its 0.65s
  // travel (the owner's "abrupt end"). Hold the sheet until the table has
  // visibly settled. GAMEOVER can also arrive directly (forfeit path).
  const isEndStage =
    gameStage === GameStage.SCORING || gameStage === GameStage.GAMEOVER;
  const [tableSettled, setTableSettled] = useState(false);
  useEffect(() => {
    if (!isEndStage) {
      setTableSettled(false);
      return;
    }
    if (reducedMotion) {
      setTableSettled(true);
      return;
    }
    const t = setTimeout(() => setTableSettled(true), 1100);
    return () => clearTimeout(t);
  }, [isEndStage, reducedMotion]);
  const endScene = isEndStage && tableSettled;

  if (!localPlayerId || !gameState) {
    return <LoadingIndicator />;
  }

  const isDealing = gameState.gameStage === GameStage.DEALING;

  const dealingDeck: PublicCard[] = isDealing
    ? Object.values(gameState.players).flatMap((p) =>
        p.hand
          .filter((c): c is PublicCard => c !== null)
          .map((card) => ({ id: card.id, facedown: true as const })),
      )
    : [];

  const drawnCardData = playerWithPendingCard?.pendingDrawnCard?.card;

  // Seat opponents in turn order starting just after the local player, so the
  // band reads the way the table plays (your left, going clockwise). Falls
  // back to object order before turnOrder is populated.
  const seatOrder =
    gameState.turnOrder && gameState.turnOrder.length > 0
      ? gameState.turnOrder
      : Object.keys(gameState.players);
  const localSeatPos = seatOrder.indexOf(localPlayerId);
  const rotatedIds =
    localSeatPos >= 0
      ? [
          ...seatOrder.slice(localSeatPos + 1),
          ...seatOrder.slice(0, localSeatPos),
        ]
      : seatOrder;
  const opponentPlayers = rotatedIds
    .map((id) => gameState.players[id])
    .filter((p): p is NonNullable<typeof p> => !!p && p.id !== localPlayerId);

  // Dense the opponent band once the table is tightly set: 3+ opponents in
  // play, or 4+ seats total at the reveal (where the local hand joins the
  // band). Below that, seats render at their regular full size, so the 2-4
  // player experience is unchanged.
  const totalPlayers = Object.keys(gameState.players).length;
  const denseBand = endScene
    ? totalPlayers >= 4
    : opponentPlayers.length >= 3;
  const localPlayerData = gameState.players[localPlayerId];

  const handlePlayAgain = () => {
    send({ type: PlayerActionType.PLAY_AGAIN });
  };

  return (
    <div className="relative h-screen w-full bg-ground flex flex-col overflow-hidden @container font-game">
      <GameHeader />
      {/* CHECK's recede is momentary and returns to identity. A HELD scale
          here (the R12 end-of-round recede) made every layout-projected card
          under it fight the projection system on Gecko — the board bounced
          up and down indefinitely. The end scene now makes room with real
          layout (row order + hidden rows) instead of a transform. */}
      <motion.div
        className="relative flex-1 grid grid-rows-[auto_auto_1fr_auto_auto]"
        animate={{ scale: checkMoment && !reducedMotion ? 0.92 : 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ transformOrigin: "center" }}
      >
        <ConnectionStatusBanner />
        {localPlayerForfeited && !isEndStage && (
          <ForfeitNotice onLeave={() => send({ type: "LEAVE_GAME" })} />
        )}
        <GameStateError
          hasPlayers={opponentPlayers.length > 0}
          hasGameState={!!gameState}
        />

        <ActionController>
          <div className="contents">
            {/* End scene: the caption and action rows retire, and the grid
                reorders — opponents, then YOUR revealed hand, then the piles
                sinking into the leftover row under the results panel. Pure
                CSS order: the layoutId cards glide once and settle. */}
            {!endScene && <GameEventCaption />}
            {/* Opponents area */}
            <div
              className={cn(
                "flex justify-center items-center py-2",
                endScene && "order-1",
              )}
            >
              {opponentPlayers.length > 0 || endScene ? (
                <div
                  className={cn(
                    "w-full flex flex-wrap justify-evenly",
                    // The wider x-gap is what deterministically wraps the dense
                    // seats (3 per row at 393px) instead of cramming a fourth.
                    denseBand ? "gap-x-3 gap-y-2" : "gap-2",
                  )}
                >
                  {opponentPlayers.map((op, i) => (
                    <PlayerHandStrip
                      key={op.id}
                      player={{
                        ...op,
                        hand: isDealing ? [] : op.hand,
                      }}
                      isLocalPlayer={false}
                      isCurrentTurn={gameState.currentPlayerId === op.id}
                      tableIndex={i}
                      compact={denseBand}
                      denseCards={denseBand}
                    />
                  ))}
                  {/* At the reveal the local hand joins the band as a final
                      dense seat, so every hand lands on the table together
                      above the results sheet. During play it lives in its own
                      row below (full size). */}
                  {endScene && localPlayerData && (
                    <PlayerHandStrip
                      key={localPlayerData.id}
                      player={localPlayerData}
                      isLocalPlayer
                      isCurrentTurn={false}
                      tableIndex={opponentPlayers.length}
                      compact={denseBand}
                      denseCards={denseBand}
                    />
                  )}
                </div>
              ) : (
                <p className="font-game text-ink-muted">
                  Waiting for opponents...
                </p>
              )}
            </div>

            {/* Table Area - takes up remaining space */}
            <div
              className={cn(
                "flex items-center justify-center @container",
                endScene && "order-3",
              )}
            >
              <TableArea
                drawnCard={drawnCardData}
                dealingDeck={dealingDeck}
              />
            </div>

            {/* Local player area. At the reveal the local hand moves up into
                the opponents band, so this row is left empty (the grid track
                collapses) rather than duplicating the hand. */}
            <div
              className={cn(
                "flex flex-col items-center justify-center py-2",
                endScene && "order-2",
              )}
            >
              {!endScene && localPlayerData ? (
                <PlayerHandStrip
                  player={{
                    ...localPlayerData,
                    hand: isDealing ? [] : localPlayerData.hand,
                  }}
                  isLocalPlayer={true}
                  isCurrentTurn={isMyTurn}
                  tableIndex={opponentPlayers.length}
                  compact={denseBand}
                  denseCards={false}
                />
              ) : null}
            </div>
            {/* Action bar: fixed-height row so its changing content (button
                sets, prompt, countdown) never resizes the 1fr table row
                above — that reflow was the board visibly shifting up/down on
                every phase change. Retired for the end scene (it would be an
                empty pill floating under the results panel). */}
            {!endScene && (
              <div className="h-28 @md:h-32 flex items-start justify-center pb-2">
                <ActionControllerView />
              </div>
            )}
          </div>
        </ActionController>
      </motion.div>

      <CheckStamp moment={checkMoment} />
      <PenaltyStamp moment={penaltyMoment} />
      <AbilityStamp moment={abilityMoment} />
      <MatchStamp moment={matchMoment} />

      <AnimatePresence>
        {endScene && (
          <RoundSummary
            players={players}
            winnerIds={winnerIds}
            localPlayerId={localPlayerId}
            onPlayAgain={handlePlayAgain}
            onLeave={() => send({ type: "LEAVE_GAME" })}
            onToggleChat={() => send({ type: "TOGGLE_SIDE_PANEL" })}
          />
        )}
      </AnimatePresence>

      {/* Root level, painted last: never inside the (transformable) board
          container — a scaled ancestor shrank it off the right edge — and
          always above the results panel, so post-game chat stays usable. */}
      <SidePanel />
    </div>
  );
}
