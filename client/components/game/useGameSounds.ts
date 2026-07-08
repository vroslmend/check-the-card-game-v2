"use client";

import { useEffect, useRef } from "react";
import { GameStage } from "shared-types";
import {
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { initSounds, play } from "@/lib/sounds";

// The match pulse fires when the card lands (cardTravelTransition = 0.65s);
// the match sound lands with it.
const MATCH_FLIGHT_MS = 650;

/** Primitive signals only, so the selector stays shallow-comparable. */
const selectSoundSignals = (state: UIMachineSnapshot) => {
  const gs = state.context.currentGameState;
  const players = gs?.players ?? {};
  let latestMatchId: string | null = null;
  let latestPenaltyId: string | null = null;
  let latestShuffleId: string | null = null;
  const log = gs?.log;
  if (log) {
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]!;
      if (e.type !== "public") continue;
      if (!latestPenaltyId && e.tags.includes("penalty"))
        latestPenaltyId = e.id;
      if (e.tags.includes("game-event")) {
        if (!latestMatchId && e.message.includes(" matched a"))
          latestMatchId = e.id;
        if (!latestShuffleId && e.message.toLowerCase().includes("shuffl"))
          latestShuffleId = e.id;
      }
      if (latestMatchId && latestPenaltyId && latestShuffleId) break;
    }
  }
  const playerList = Object.values(players);
  return {
    gameStage: gs?.gameStage ?? null,
    hasPendingDraw: playerList.some((p) => p.pendingDrawnCard),
    discardPileSize: gs?.discardPileSize ?? 0,
    visibleCount: state.context.visibleCards.length,
    latestMatchId,
    latestPenaltyId,
    latestShuffleId,
    checkerId: playerList.find((p) => p.hasCalledCheck)?.id ?? null,
    isMyTurn:
      !!gs?.currentPlayerId &&
      gs.currentPlayerId === state.context.localPlayerId,
    chatCount: gs?.chat?.length ?? 0,
    isSidePanelOpen: state.context.isSidePanelOpen,
    playerCount: playerList.length,
    readyCount: playerList.filter((p) => p.isReady).length,
    abilityStackLen: gs?.abilityStack?.length ?? 0,
    publicSwapAt: gs?.publicSwap?.occurredAt ?? null,
    publicPeekAt: gs?.publicPeek?.startedAt ?? null,
  };
};

/** Fire `onChange` on every change AFTER the first observed value — the
 *  stamp components' "first sight is history" rule, as a hook. */
function useDelta<T>(value: T, onChange: (prev: T, next: T) => void) {
  const prevRef = useRef<T | null>(null);
  const initRef = useRef(false);
  const cbRef = useRef(onChange);
  cbRef.current = onChange;
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      prevRef.current = value;
      return;
    }
    const prev = prevRef.current as T;
    if (!Object.is(prev, value)) {
      prevRef.current = value;
      cbRef.current(prev, value);
    }
  }, [value]);
}

/** Mounted once in GameBoard. Every trigger maps a broadcast delta the
 *  visual system already reacts to onto one sprite (findings §3.1 table). */
export function useGameSounds() {
  const s = useUISelector(selectSoundSignals);

  useEffect(() => {
    initSounds();
  }, []);

  useDelta(s.gameStage, (prev, next) => {
    // Start = leaving the lobby; the deal riffle plays when the cards
    // actually fly (DEALING -> INITIAL_PEEK is the commit that animates).
    if (prev === GameStage.WAITING_FOR_PLAYERS && next === GameStage.DEALING)
      play("start");
    if (prev === GameStage.DEALING && next === GameStage.INITIAL_PEEK)
      play("deal");
    const wasEnd =
      prev === GameStage.SCORING || prev === GameStage.GAMEOVER;
    const isEnd =
      next === GameStage.SCORING || next === GameStage.GAMEOVER;
    if (isEnd && !wasEnd) play("roundOver");
  });

  useDelta(s.playerCount, (prev, next) => {
    if (s.gameStage !== GameStage.WAITING_FOR_PLAYERS) return;
    if (next > prev) play("join");
    if (next < prev) play("leave");
  });

  useDelta(s.readyCount, (prev, next) => {
    if (s.gameStage !== GameStage.WAITING_FOR_PLAYERS) return;
    if (next > prev) play("ready");
    if (next < prev) play("unready");
  });

  useDelta(s.abilityStackLen, (prev, next) => {
    if (next > prev) play("ability");
  });

  useDelta(s.publicSwapAt, (_prev, next) => {
    if (next) play("swap");
  });

  // Ability peek (Queen / King) is announced room-wide: publicPeek is broadcast
  // to every client, so all players hear the cue when anyone peeks — not just
  // the peeker. Mirrors the swap trigger above. Initial-peek does NOT set
  // publicPeek; that sound is handled locally by visibleCount below.
  useDelta(s.publicPeekAt, (_prev, next) => {
    if (next) play("peek");
  });

  useDelta(s.hasPendingDraw, (prev, next) => {
    if (!prev && next) play("draw");
  });

  useDelta(s.discardPileSize, (prev, next) => {
    if (next > prev) play("place");
  });

  useDelta(s.visibleCount, (prev, next) => {
    // Initial-peek only: this is the LOCAL player viewing their own bottom two
    // at round start. Ability peeks are announced room-wide via publicPeekAt
    // above; gating here stops the peeker hearing "peek" twice during one.
    if (next > prev && s.gameStage === GameStage.INITIAL_PEEK) play("peek");
  });

  useDelta(s.latestMatchId, (_prev, next) => {
    // Fire-and-forget: the sound lands with the card (0.65s flight). A
    // stray play after unmount is harmless (module-level audio).
    if (next) setTimeout(() => play("match"), MATCH_FLIGHT_MS);
  });

  useDelta(s.latestPenaltyId, (_prev, next) => {
    if (next) play("penalty");
  });

  useDelta(s.latestShuffleId, (_prev, next) => {
    if (next) play("shuffle");
  });

  useDelta(s.checkerId, (prev, next) => {
    if (next && next !== prev) play("check");
  });

  useDelta(s.isMyTurn, (prev, next) => {
    if (!prev && next) play("yourTurn");
  });

  useDelta(s.chatCount, (prev, next) => {
    if (next > prev && !s.isSidePanelOpen) play("chat");
  });
}
