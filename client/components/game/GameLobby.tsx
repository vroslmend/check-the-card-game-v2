"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Clock,
  Crown,
  LogOut,
  RefreshCw,
  UserMinus,
  WifiOff,
} from "lucide-react";
import { type Player, PlayerActionType } from "shared-types";
import {
  useUIActorRef,
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { CardBack } from "@/components/cards/CardBack";
import { BrandMark } from "@/components/ui/BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LearnCheckSheet } from "./LearnCheckSheet";
import { cn } from "@/lib/utils";
import { play } from "@/lib/sounds";

const HOLD_TO_REMOVE_SECONDS = 1.5;

const selectLobbyProps = (state: UIMachineSnapshot) => {
  const { currentGameState, localPlayerId, gameId } = state.context;

  if (!currentGameState || !currentGameState.players) {
    return {
      isLoading: true,
      players: [] as Player[],
      localPlayer: null as Player | null,
      isGameMaster: false,
      gameMasterId: null as string | null,
      allPlayersReady: false,
      hasEnoughPlayers: false,
      maxPlayers: 4,
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
    ? (currentGameState.players[localPlayerId] ?? null)
    : null;

  const readyAndConnectedCount = players.filter(
    (p) => p.isReady && p.isConnected,
  ).length;
  const hasDisconnectedPlayers = players.some((p) => !p.isConnected);

  return {
    isLoading: false,
    players,
    localPlayer,
    isGameMaster: localPlayerId === currentGameState.gameMasterId,
    gameMasterId: currentGameState.gameMasterId,
    allPlayersReady:
      readyAndConnectedCount === players.length &&
      players.length > 1 &&
      !hasDisconnectedPlayers,
    hasEnoughPlayers: players.length >= 2,
    maxPlayers: currentGameState.maxPlayers ?? 4,
    gameId,
  };
};

/** A player as a card: facedown accent back until they declare ready, then
 *  the seat flips to its face — initial as the rank, name where the suit
 *  sits. The same 2D scaleX flip and midpoint crossfade as PlayingCard. */
const SeatCard = ({
  player,
  isYou,
  isHost,
  reduced,
}: {
  player: Player;
  isYou: boolean;
  isHost: boolean;
  reduced: boolean;
}) => {
  const showFace = player.isReady;
  const initial = (player.name?.trim()[0] ?? "?").toUpperCase();

  return (
    <div
      className={cn(
        "relative h-full w-full rounded-card",
        isYou && "ring-[1.5px] ring-accent ring-offset-2 ring-offset-ground",
        !player.isConnected && "opacity-60",
      )}
    >
      <motion.div
        className="relative h-full w-full"
        initial={false}
        animate={{ scaleX: showFace ? 1 : -1 }}
        transition={
          reduced ? { duration: 0 } : { duration: 0.5, ease: "easeInOut" }
        }
      >
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-card border border-hairline bg-surface px-1"
          animate={{ opacity: showFace ? 1 : 0 }}
          transition={
            reduced ? { duration: 0 } : { duration: 0.1, delay: 0.2 }
          }
        >
          <span className="text-3xl font-extrabold leading-none text-ink sm:text-4xl">
            {initial}
          </span>
          <span className="max-w-full truncate px-1 text-xs font-semibold text-ink-muted">
            {player.name}
          </span>
        </motion.div>
        <motion.div
          className="absolute inset-0"
          style={{ scaleX: -1 }}
          animate={{ opacity: showFace ? 0 : 1 }}
          transition={
            reduced ? { duration: 0 } : { duration: 0.1, delay: 0.2 }
          }
        >
          <CardBack />
        </motion.div>
      </motion.div>

      {isHost && (
        <span
          aria-label="Host"
          className="absolute -right-2 -top-2 z-10 rounded-full border border-hairline bg-surface p-1 text-ink shadow-sm"
        >
          <Crown className="h-3 w-3" />
        </span>
      )}
    </div>
  );
};

const SeatStatusChip = ({ player }: { player: Player }) => {
  const status = !player.isConnected
    ? { Icon: WifiOff, text: "Away", muted: true }
    : player.isReady
      ? { Icon: Check, text: "Ready", muted: false }
      : { Icon: Clock, text: "Waiting", muted: true };
  const { Icon, text, muted } = status;
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[11px] font-semibold",
        muted ? "text-ink-muted" : "text-ink",
      )}
    >
      <Icon className="h-3 w-3" />
      {text}
    </span>
  );
};

/** Hairline pill that fills accent while held — the destructive-hold idiom. */
const HoldToRemove = ({ playerId }: { playerId: string }) => {
  const { send } = useUIActorRef();
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!holding) {
      setProgress(0);
      return;
    }
    const startTime = Date.now();
    const interval = setInterval(() => {
      const pct = Math.min(
        100,
        ((Date.now() - startTime) / (HOLD_TO_REMOVE_SECONDS * 1000)) * 100,
      );
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
        send({
          type: PlayerActionType.REMOVE_PLAYER,
          payload: { playerIdToRemove: playerId },
        });
        setHolding(false);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [holding, playerId, send]);

  return (
    <button
      onPointerDown={() => setHolding(true)}
      onPointerUp={() => setHolding(false)}
      onPointerLeave={() => setHolding(false)}
      className={cn(
        "relative flex items-center gap-1 overflow-hidden rounded-full border px-2.5 py-1 text-[11px] font-semibold text-ink-muted transition-colors",
        holding ? "border-accent" : "border-hairline",
      )}
    >
      {holding && (
        <span
          className="absolute inset-y-0 left-0 bg-accent/25"
          style={{ width: `${progress}%` }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1">
        <UserMinus className="h-3 w-3" />
        {holding ? `${Math.round(progress)}%` : "Remove"}
      </span>
    </button>
  );
};

export const GameLobby = () => {
  const { send } = useUIActorRef();
  const {
    isLoading,
    players,
    localPlayer,
    isGameMaster,
    gameMasterId,
    allPlayersReady,
    hasEnoughPlayers,
    maxPlayers,
    gameId,
  } = useUISelector(selectLobbyProps);
  const reduced = !!useReducedMotion();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reconnectionTimeout, setReconnectionTimeout] = useState(false);
  const [copied, setCopied] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoading) {
      setReconnectionTimeout(false);
      return;
    }
    const timer = setTimeout(() => setReconnectionTimeout(true), 8000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  useEffect(
    () => () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    },
    [],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-ground font-game">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-hairline border-t-ink" />
        <p className="text-ink-muted">
          {reconnectionTimeout
            ? "Reconnection is taking longer than expected..."
            : "Opening lobby..."}
        </p>
        {reconnectionTimeout && (
          <button
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
            onClick={() => window.location.reload()}
          >
            Refresh page
          </button>
        )}
      </div>
    );
  }

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/game/${gameId}`
      : "";

  const copyInvite = () => {
    navigator.clipboard?.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    send({ type: "RETRY_REJOIN" });
    refreshTimeoutRef.current = setTimeout(() => setIsRefreshing(false), 3000);
  };

  const isReady = !!localPlayer?.isReady;
  const canStart = isGameMaster && allPlayersReady && hasEnoughPlayers;
  const toggleReady = () => {
    play("click");
    send({
      type: isReady
        ? PlayerActionType.DECLARE_LOBBY_UNREADY
        : PlayerActionType.DECLARE_LOBBY_READY,
    });
  };

  const statusLine = !hasEnoughPlayers
    ? "Waiting for players"
    : !allPlayersReady
      ? "Waiting for everyone to ready up"
      : isGameMaster
        ? "Everyone is ready"
        : "Everyone is ready. Waiting for the host to start";

  // One accent action at a time: Start when startable, otherwise Ready up;
  // once ready with nothing to start, the quiet pill is the way back.
  const action = canStart
    ? {
        label: "Start game",
        onClick: () => {
          play("click");
          send({ type: PlayerActionType.START_GAME });
        },
        accent: true,
      }
    : !isReady
      ? { label: "Ready up", onClick: toggleReady, accent: true }
      : { label: "Unready", onClick: toggleReady, accent: false };

  const emptySeats = Math.max(0, maxPlayers - players.length);

  return (
    <div className="flex min-h-dvh w-full flex-col bg-ground font-game">
      <div className="flex h-14 shrink-0 items-center justify-between px-4 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink"
        >
          <BrandMark className="h-6 rounded-[4px]" />
          Check
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-ink-muted transition-colors hover:text-ink disabled:opacity-60"
            aria-label="Refresh lobby"
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
            />
          </button>
          <ThemeToggle />
          <button
            onClick={() => send({ type: "LEAVE_GAME" })}
            className="flex h-9 items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pb-14 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Private table
        </p>

        <button
          onClick={copyInvite}
          className="mt-3 rounded-card px-4 py-1 text-6xl font-extrabold tracking-[0.25em] text-ink tabular-nums transition-colors hover:text-ink/80 sm:text-7xl"
          aria-label="Copy invite link"
        >
          {gameId}
        </button>
        <p className="mt-2 h-5 text-sm text-ink-muted" aria-live="polite">
          {copied
            ? "Invite link copied"
            : "Tap the code to copy an invite link"}
        </p>

        <div className="mt-10 flex flex-wrap items-start justify-center gap-4 sm:gap-6">
          {players.map((p) => (
            <div
              key={p.id}
              className="flex w-24 flex-col items-center gap-2 sm:w-28"
            >
              <button
                onClick={p.id === localPlayer?.id ? toggleReady : undefined}
                disabled={p.id !== localPlayer?.id}
                className="aspect-[5/7] w-full disabled:cursor-default"
                aria-label={
                  p.id === localPlayer?.id
                    ? p.isReady
                      ? "You are ready. Tap to unready"
                      : "Tap to ready up"
                    : `${p.name}: ${p.isReady ? "ready" : "waiting"}`
                }
              >
                <SeatCard
                  player={p}
                  isYou={p.id === localPlayer?.id}
                  isHost={p.id === gameMasterId}
                  reduced={reduced}
                />
              </button>
              <SeatStatusChip player={p} />
              {isGameMaster && p.id !== localPlayer?.id && !p.isConnected && (
                <HoldToRemove playerId={p.id} />
              )}
            </div>
          ))}
          {Array.from({ length: emptySeats }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex w-24 flex-col items-center gap-2 sm:w-28"
            >
              <div className="flex aspect-[5/7] w-full items-center justify-center rounded-card border border-hairline">
                <span className="text-xs font-semibold text-ink-muted">
                  Open
                </span>
              </div>
              <span className="h-[22px]" aria-hidden />
            </div>
          ))}
        </div>

        <p className="mt-8 text-sm font-semibold text-ink-muted">
          {players.length} of {maxPlayers} seats filled
        </p>
        <p className="mt-1 h-5 text-sm text-ink-muted">{statusLine}</p>

        <button
          onClick={action.onClick}
          className={cn(
            "mt-6 flex h-14 min-w-[12rem] items-center justify-center rounded-full px-8 text-base font-bold transition-colors sm:min-w-[16rem]",
            action.accent
              ? "bg-accent text-accent-ink hover:bg-accent/90"
              : "border border-hairline bg-surface-2 text-ink-muted hover:text-ink",
          )}
        >
          {action.label}
        </button>

        <p className="mt-10 text-sm text-ink-muted">
          New here?{" "}
          <button
            onClick={() => setLearnOpen(true)}
            className="font-semibold text-ink underline underline-offset-4"
          >
            How to play
          </button>{" "}
          ·{" "}
          <Link
            href="/rules"
            target="_blank"
            className="font-semibold text-ink underline underline-offset-4"
          >
            Full rules
          </Link>
        </p>
      </main>

      <LearnCheckSheet open={learnOpen} onClose={() => setLearnOpen(false)} />
    </div>
  );
};
