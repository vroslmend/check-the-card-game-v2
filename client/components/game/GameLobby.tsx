"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  useUISelector,
  useUIActorRef,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import {
  CheckCircle,
  Users,
  WifiOff,
  Clock,
  PartyPopper,
  UserMinus,
  RefreshCw,
  LogOut,
} from "lucide-react";
import { type Player, PlayerActionType } from "shared-types";
import { cn } from "@/lib/utils";
import { CopyToClipboardButton } from "../ui/CopyToClipboardButton";

const spinnerStyle = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .loading-spinner {
    animation: spin 1.5s linear infinite;
  }
`;

// Status is text + icon only — no hue coding. `muted` dims passive states
// (waiting/disconnected) to ink-muted; active states (ready) read ink.
const StatusIndicator = ({
  icon: Icon,
  text,
  colorClass,
}: {
  icon: React.ElementType;
  text: string;
  colorClass: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn("flex items-center gap-2 text-sm font-medium", colorClass)}
  >
    <Icon className="h-4 w-4" />
    <p>{text}</p>
  </motion.div>
);

const playerCardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  }),
  exit: { opacity: 0, x: -20, transition: { duration: 0.3 } },
};

const PlayerRow = ({
  player,
  isLocalPlayer,
  index,
}: {
  player: Player;
  isLocalPlayer: boolean;
  index: number;
}) => {
  const { send } = useUIActorRef();
  const isGameMaster = useUISelector(
    (state) =>
      state.context.currentGameState?.gameMasterId ===
      state.context.localPlayerId,
  );

  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimeRequired = 1.5;
  const canRemove = isGameMaster && !isLocalPlayer && !player.isConnected;

  useEffect(() => {
    if (isHolding) {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(
          100,
          (elapsedTime / (holdTimeRequired * 1000)) * 100,
        );
        setHoldProgress(progress);

        if (progress >= 100) {
          clearInterval(interval);
          send({
            type: PlayerActionType.REMOVE_PLAYER,
            payload: { playerIdToRemove: player.id },
          });
          setIsHolding(false);
          setHoldProgress(0);
        }
      }, 50);

      return () => {
        clearInterval(interval);
      };
    }
  }, [isHolding, player.id, send]);

  // Text + icon only, no hue: ready reads ink, passive states read ink-muted.
  const getStatus = (): {
    Icon: React.ElementType;
    text: string;
    muted: boolean;
  } => {
    if (!player.isConnected)
      return { Icon: WifiOff, text: "Disconnected", muted: true };
    if (player.isReady) return { Icon: CheckCircle, text: "Ready", muted: false };
    return { Icon: Clock, text: "Waiting", muted: true };
  };

  const { Icon: StatusIcon, text: statusText, muted } = getStatus();

  return (
    <motion.div
      layout
      custom={index}
      variants={playerCardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      key={player.id}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface px-5 py-4",
        !player.isConnected && "opacity-70",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "truncate font-game text-lg font-bold text-ink",
            !player.isConnected && "text-ink-muted",
          )}
        >
          {player.name}{" "}
          {isLocalPlayer && (
            <span className="text-xs font-normal text-ink-muted">(You)</span>
          )}
          {!player.isConnected && (
            <span className="ml-2 text-xs font-normal italic text-ink-muted">
              (disconnected)
            </span>
          )}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold",
            muted ? "text-ink-muted" : "text-ink",
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          <span>{statusText}</span>
        </div>

        {canRemove && (
          <motion.div
            initial={{ opacity: 0.7 }}
            whileHover={{ opacity: 1 }}
            className="relative"
          >
            {/* Hairline pill that fills accent while held (destructive hold,
                mirrors the "Hold to Check" pattern) — no separate danger red. */}
            <motion.div
              className={cn(
                "relative flex cursor-pointer items-center gap-1 overflow-hidden rounded-full border px-3 py-1.5 transition-colors",
                isHolding ? "border-accent" : "border-hairline",
              )}
              whileTap={{ scale: 0.98 }}
              onTapStart={() => setIsHolding(true)}
              onTap={() => setIsHolding(false)}
              onHoverEnd={() => setIsHolding(false)}
              onTapCancel={() => setIsHolding(false)}
            >
              {isHolding && (
                <motion.div
                  className="absolute left-0 top-0 bottom-0 h-full bg-accent/25"
                  style={{ width: `${holdProgress}%`, originX: 0 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1 text-xs font-semibold text-ink-muted">
                <UserMinus className="h-4 w-4" />
                {isHolding ? `${Math.round(holdProgress)}%` : "Remove"}
              </span>
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

const selectLobbyProps = (state: UIMachineSnapshot) => {
  const { currentGameState, localPlayerId, gameId } = state.context;

  if (!currentGameState || !currentGameState.players) {
    return {
      isLoading: true,
      players: [],
      localPlayer: null,
      isGameMaster: false,
      playerCount: 0,
      readyPlayersCount: 0,
      allPlayersReady: false,
      hasEnoughPlayers: false,
      hasDisconnectedPlayers: false,
      gameId,
    };
  }

  const players = (
    currentGameState.turnOrder?.length
      ? currentGameState.turnOrder.map(
          (id: string) => currentGameState.players[id],
        )
      : Object.values(currentGameState.players)
  ).filter((p): p is Player => !!p);
  const localPlayer = localPlayerId
    ? currentGameState.players[localPlayerId]
    : null;
  const isGameMaster = localPlayerId === currentGameState.gameMasterId;

  const playerCount = players.length;
  const readyAndConnectedCount = players.filter(
    (p: Player) => p.isReady && p.isConnected,
  ).length;
  const hasDisconnectedPlayers = players.some((p: Player) => !p.isConnected);
  const allPlayersReady =
    readyAndConnectedCount === playerCount &&
    playerCount > 1 &&
    !hasDisconnectedPlayers;

  return {
    isLoading: false,
    players,
    localPlayer,
    isGameMaster,
    playerCount,
    readyPlayersCount: readyAndConnectedCount,
    allPlayersReady,
    hasEnoughPlayers: playerCount >= 2,
    hasDisconnectedPlayers,
    gameId,
  };
};

export const GameLobby = () => {
  const { send } = useUIActorRef();
  const {
    isLoading,
    players,
    localPlayer,
    isGameMaster,
    allPlayersReady,
    hasEnoughPlayers,
    hasDisconnectedPlayers,
    gameId,
  } = useUISelector(selectLobbyProps);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reconnectionTimeout, setReconnectionTimeout] = useState(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => setReconnectionTimeout(true), 8000);
      return () => clearTimeout(timer);
    } else {
      setReconnectionTimeout(false);
    }
  }, [isLoading]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <style>{spinnerStyle}</style>
        <motion.div
          className="w-full font-game"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-2 border-hairline border-t-ink loading-spinner" />
            <p className="text-ink-muted">
              {reconnectionTimeout
                ? "Reconnection is taking longer than expected..."
                : "Opening lobby..."}
            </p>
            {reconnectionTimeout && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 px-4 py-2 rounded-full bg-accent text-accent-ink text-sm font-semibold"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </motion.button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/game/${gameId}`
      : "";

  const handlePlayerReady = () =>
    send({ type: PlayerActionType.DECLARE_LOBBY_READY });
  const handlePlayerUnready = () =>
    send({ type: PlayerActionType.DECLARE_LOBBY_UNREADY });
  const handleStartGame = () => send({ type: PlayerActionType.START_GAME });
  const handleLeaveGame = () => send({ type: "LEAVE_GAME" });

  const handleRefreshGameState = () => {
    if (isRefreshing) return;

    setIsRefreshing(true);

    // Re-runs the rejoin handshake, which re-syncs the lobby state.
    send({ type: "RETRY_REJOIN" });

    refreshTimeoutRef.current = setTimeout(() => {
      setIsRefreshing(false);
    }, 3000);
  };

  const getLobbyStatus = () => {
    if (!hasEnoughPlayers) {
      return (
        <StatusIndicator
          icon={Users}
          text="Waiting for more players..."
          colorClass="text-ink-muted"
        />
      );
    }
    if (!allPlayersReady) {
      return (
        <StatusIndicator
          icon={Clock}
          text="Waiting for players to ready up..."
          colorClass="text-ink-muted"
        />
      );
    }
    if (hasDisconnectedPlayers) {
      return (
        <StatusIndicator
          icon={WifiOff}
          text="Some players are disconnected but you can still start."
          colorClass="text-ink-muted"
        />
      );
    }
    if (allPlayersReady && isGameMaster) {
      return (
        <StatusIndicator
          icon={PartyPopper}
          text="All players ready! You can start the game."
          colorClass="text-ink"
        />
      );
    }
    return (
      <StatusIndicator
        icon={CheckCircle}
        text="Ready! Waiting for the host to start."
        colorClass="text-ink-muted"
      />
    );
  };

  const canStartGame = isGameMaster && allPlayersReady && hasEnoughPlayers;
  const isPlayerReady = localPlayer?.isReady;

  // One accent-filled pill at a time: the primary action fills accent when it
  // is actionable, and drops to a quiet surface pill when there is nothing to do.
  const ACCENT_PILL = "bg-accent text-accent-ink hover:bg-accent/90";
  const QUIET_PILL = "bg-surface-2 text-ink-muted border border-hairline";

  const getButtonConfig = () => {
    if (isGameMaster) {
      if (!isPlayerReady) {
        return {
          text: "Ready Up",
          action: handlePlayerReady,
          disabled: false,
          icon: <CheckCircle className="h-4 w-4 pointer-events-none" />,
          colors: ACCENT_PILL,
        };
      }

      if (hasEnoughPlayers && allPlayersReady) {
        return {
          text: "Start Game",
          action: handleStartGame,
          disabled: false,
          icon: <PartyPopper className="h-4 w-4 pointer-events-none" />,
          colors: ACCENT_PILL,
        };
      }

      // Ready but can't start yet: the quiet pill doubles as the way back.
      return {
        text: "Unready",
        action: handlePlayerUnready,
        disabled: false,
        icon: <Clock className="h-4 w-4 pointer-events-none" />,
        colors: QUIET_PILL,
      };
    } else {
      if (isPlayerReady) {
        return {
          text: "Unready",
          action: handlePlayerUnready,
          disabled: false,
          icon: <Clock className="h-4 w-4 pointer-events-none" />,
          colors: QUIET_PILL,
        };
      }
      return {
        text: "Ready Up",
        action: handlePlayerReady,
        disabled: false,
        icon: <CheckCircle className="h-4 w-4 pointer-events-none" />,
        colors: ACCENT_PILL,
      };
    }
  };

  const buttonConfig = getButtonConfig();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen flex items-center justify-center font-game p-4 bg-ground"
    >
      <div
        className="w-full max-w-xl sm:max-w-2xl lg:max-w-3xl mx-auto relative bg-surface rounded-3xl sm:rounded-[2.5rem] border border-hairline
                   max-h-[90dvh] flex flex-col overflow-hidden"
      >
        <div
          className="relative p-8 md:p-10 flex flex-col min-h-0
                     [@media(max-height:750px)]:p-6 [@media(max-height:600px)]:p-4"
        >
          <motion.div
            className="absolute top-5 right-5 z-10"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            <motion.button
              onClick={handleLeaveGame}
              className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
              data-cursor-link
              whileTap={{ scale: 0.95 }}
            >
              <LogOut className="h-4 w-4 md:hidden" />
              <span className="hidden md:inline">Exit Lobby</span>
            </motion.button>
          </motion.div>

          <motion.div
            className="absolute top-5 left-5 z-10"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            <motion.button
              onClick={handleRefreshGameState}
              disabled={isRefreshing}
              className="rounded-full border border-hairline bg-surface p-2 text-ink-muted transition-colors hover:border-ink-muted hover:text-ink disabled:opacity-60"
              data-cursor-link
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                animate={isRefreshing ? { rotate: 360 } : {}}
                transition={{
                  duration: 1,
                  ease: "linear",
                  repeat: isRefreshing ? Infinity : 0,
                  repeatType: "loop",
                }}
                className="refresh-icon"
              >
                <RefreshCw className="h-4 w-4" />
              </motion.div>
            </motion.button>
          </motion.div>

          <div
            className="flex flex-col items-center text-center mb-10
                       [@media(max-height:750px)]:mb-6 [@media(max-height:600px)]:mb-4"
          >
            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-4xl sm:text-5xl font-extrabold tracking-tight text-ink
                         [@media(max-height:750px)]:text-3xl [@media(max-height:600px)]:text-2xl"
            >
              Game Lobby
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="text-ink-muted mt-2 text-base sm:text-lg"
            >
              Assemble your party
            </motion.p>
          </div>

          {gameId && (
            <motion.div
              className="mb-10 [@media(max-height:750px)]:mb-6 [@media(max-height:600px)]:mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
            >
              <div className="text-center">
                <h2 className="text-lg font-semibold text-ink">
                  Invite Friends
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Share the Game ID or send the link below.
                </p>
                <div className="mt-4 flex justify-center">
                  <CopyToClipboardButton
                    textToCopy={inviteLink}
                    buttonText={gameId}
                    className="text-lg tracking-widest"
                  />
                </div>
              </div>
            </motion.div>
          )}

          <motion.div
            className="flex-1 min-h-0 space-y-3 mb-8 max-h-[50vh] md:max-h-[60vh] overflow-y-auto pr-1
                       [@media(max-height:750px)]:mb-6 [@media(max-height:600px)]:mb-4 [@media(max-height:600px)]:space-y-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1, delayChildren: 0.5 }}
          >
            <AnimatePresence>
              {players.map((p, i) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  isLocalPlayer={p.id === localPlayer?.id}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </motion.div>

          <motion.div
            className="flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
          >
            <div
              className="h-10 mb-6 flex items-center justify-center
                         [@media(max-height:750px)]:mb-4 [@media(max-height:600px)]:h-8 [@media(max-height:600px)]:mb-3"
            >
              {getLobbyStatus()}
            </div>

            <motion.button
              key="lobby-main-action"
              onTap={() => buttonConfig.action()}
              disabled={buttonConfig.disabled}
              className={cn(
                "flex h-14 min-w-[12rem] items-center justify-center gap-2 rounded-full px-8 text-base font-bold sm:min-w-[16rem]",
                buttonConfig.colors,
                buttonConfig.disabled && "cursor-not-allowed",
              )}
              data-cursor-link
              whileTap={buttonConfig.disabled ? undefined : { scale: 0.97 }}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                duration: 0.4,
              }}
            >
              <span className="flex items-center gap-2">
                <motion.span
                  key={buttonConfig.text}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {buttonConfig.text}
                </motion.span>
                <motion.div
                  key={buttonConfig.disabled ? "disabled-icon" : "enabled-icon"}
                  animate={{ x: [0, 4, 0] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    repeatDelay: 1,
                    ease: "easeInOut",
                  }}
                >
                  {buttonConfig.icon}
                </motion.div>
              </span>
            </motion.button>
            {isGameMaster && isPlayerReady && canStartGame && (
              <button
                onClick={handlePlayerUnready}
                className="mt-3 text-xs font-semibold text-ink-muted underline underline-offset-4 hover:text-ink"
              >
                Unready
              </button>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
