import {
  setup,
  assign,
  fromPromise,
  assertEvent,
  emit,
  and,
  not,
  or,
  enqueueActions,
  raise,
} from "xstate";
import {
  Card,
  CardRank,
  PlayerActionType,
  InitialPlayerSetupData,
  RichGameLogMessage,
  GameStage,
  TurnPhase,
  PlayerId,
  AbilityActionPayload,
  AbilityType,
  ChatMessage,
  SocketEventName,
  PlayerStatus,
} from "shared-types";
import { createDeck, shuffleDeck } from "./lib/deck-utils.js";
import logger from "./lib/logger.js";
// Side-effect import required so TS can name the machine's inferred guard
// types when emitting declarations (avoids TS2742).
import "xstate/guards";
import type {
  ServerActiveAbility,
  ServerPlayer,
  GameContext,
  GameInput,
} from "./types.js";
import { produce } from "immer";

const PEEK_TOTAL_DURATION_MS = parseInt(
  process.env.PEEK_DURATION_MS || "10000",
  10,
);
const PEEK_VIEW_DURATION_MS = 2000;
const MATCHING_STAGE_DURATION_MS = parseInt(
  process.env.MATCHING_STAGE_DURATION_MS || "5000",
  10,
);
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || "4", 10);
const CARDS_PER_PLAYER = parseInt(process.env.CARDS_PER_PLAYER || "4", 10);
// 120s: phone screen-locks routinely exceed 30s, and the socket layer's
// connection-state recovery window is 2 minutes — forfeit only after that.
const RECONNECT_TIMEOUT_MS = parseInt(
  process.env.RECONNECT_TIMEOUT_MS || "120000",
  10,
);
// Match the in-game reconnect grace (and the socket recovery window): a lobby
// should survive a brief blip — a phone screen-lock or network hiccup routinely
// exceeds a few seconds — and only evict a waiting player after the same 2min
// forfeit window. The old 5s made an idle lobby *look* like it dropped you.
// (Note: this only governs eviction of a DISCONNECTED player; a still-connected
// idle lobby never tears down. Platform-level spindown is a separate, infra
// concern — see the /health endpoint and hosting tier.)
const LOBBY_DISCONNECT_TIMEOUT_MS = parseInt(
  process.env.LOBBY_DISCONNECT_TIMEOUT_MS || "120000",
  10,
);
const ABILITY_PEEK_VIEW_DURATION_MS = 5000;
// Rules 7: a player whose hand reaches this size via failed-match penalties is
// disqualified from the round (locked, revealed at scoring, cannot win).
const MAX_HAND_SIZE = parseInt(process.env.MAX_HAND_SIZE || "8", 10);
// Per-decision-window time limit (draw, discard, ability). On expiry the turn
// auto-resolves so one idle player can't stall the whole game.
const TURN_TIMER_MS = parseInt(process.env.TURN_TIMER_MS || "45000", 10);

const getPlayerNameForLog = (
  playerId: PlayerId,
  players: Record<PlayerId, ServerPlayer>,
): string => players[playerId]?.name || `P-${playerId.slice(-4)}`;

let logEntrySeq = 0;
const createLogEntry = (
  gameId: string,
  data: Omit<RichGameLogMessage, "id" | "timestamp">,
): RichGameLogMessage => ({
  id: `log_${gameId}_${Date.now()}_${logEntrySeq++}`,
  timestamp: new Date().toISOString(),
  ...data,
});

const cardScoreValues: Record<CardRank, number> = {
  [CardRank.Ace]: -1,
  [CardRank.Two]: 2,
  [CardRank.Three]: 3,
  [CardRank.Four]: 4,
  [CardRank.Five]: 5,
  [CardRank.Six]: 6,
  [CardRank.Seven]: 7,
  [CardRank.Eight]: 8,
  [CardRank.Nine]: 9,
  [CardRank.Ten]: 10,
  [CardRank.Jack]: 11,
  [CardRank.Queen]: 12,
  [CardRank.King]: 13,
};
const specialRanks = new Set([CardRank.King, CardRank.Queen, CardRank.Jack]);
const abilityRanks = new Set([CardRank.King, CardRank.Queen, CardRank.Jack]);

// A hand is a fixed-slot array with holes (null = an empty gap where a matched
// card was). Two rows, row-major, C = ceil(slots/2) columns; a "column" is the
// vertical pair {j, C+j}. Drop any column whose top and bottom are both empty,
// preserving order and re-centering. This is the only automatic reshuffle: a
// full line clearing, per the spatial-memory identity of the game.
const compactFullColumns = (hand: (Card | null)[]): (Card | null)[] => {
  const S = hand.length;
  if (S === 0) return hand;
  const C = Math.ceil(S / 2);
  const kept: [Card | null, Card | null][] = [];
  for (let j = 0; j < C; j++) {
    const top = j < S ? (hand[j] ?? null) : null;
    const bottom = C + j < S ? (hand[C + j] ?? null) : null;
    if (top !== null || bottom !== null) kept.push([top, bottom]);
  }
  if (kept.length === C) return hand;
  const tops = kept.map((c) => c[0]);
  const bottoms = kept.map((c) => c[1]);
  // Trim at most one trailing empty bottom slot (the structural hole of an
  // odd-sized hand). The result must stay at exactly kept.length columns so
  // no surviving card changes rows; popping more than one shrinks the slot
  // count past a column boundary and re-wraps the grid, which reads as a
  // shuffle.
  if (bottoms.length && bottoms[bottoms.length - 1] === null) bottoms.pop();
  return [...tops, ...bottoms];
};

// -----------------------------------------------------------------------------
// Action & Event Type Unions
// -----------------------------------------------------------------------------

type PlayerActionEvents =
  | { type: PlayerActionType.START_GAME; playerId: PlayerId }
  | { type: PlayerActionType.DECLARE_LOBBY_READY; playerId: PlayerId }
  | { type: PlayerActionType.DECLARE_LOBBY_UNREADY; playerId: PlayerId }
  | { type: PlayerActionType.DRAW_FROM_DECK; playerId: PlayerId }
  | { type: PlayerActionType.DRAW_FROM_DISCARD; playerId: PlayerId }
  | {
      type: PlayerActionType.SWAP_AND_DISCARD;
      playerId: PlayerId;
      payload: { handCardIndex: number };
    }
  | { type: PlayerActionType.DISCARD_DRAWN_CARD; playerId: PlayerId }
  | {
      type: PlayerActionType.ATTEMPT_MATCH;
      playerId: PlayerId;
      payload: { handCardIndex: number };
    }
  | { type: PlayerActionType.PASS_ON_MATCH_ATTEMPT; playerId: PlayerId }
  | { type: PlayerActionType.CALL_CHECK; playerId: PlayerId }
  | { type: PlayerActionType.DECLARE_READY_FOR_PEEK; playerId: PlayerId }
  | { type: PlayerActionType.PLAY_AGAIN; playerId: PlayerId }
  | { type: PlayerActionType.REQUEST_PLAY_AGAIN; playerId: PlayerId }
  | {
      type: PlayerActionType.USE_ABILITY;
      playerId: PlayerId;
      payload: AbilityActionPayload;
    }
  | {
      type: PlayerActionType.SEND_CHAT_MESSAGE;
      payload: Omit<ChatMessage, "id" | "timestamp">;
    }
  | { type: PlayerActionType.LEAVE_GAME; playerId: PlayerId }
  | {
      type: PlayerActionType.REMOVE_PLAYER;
      playerId: PlayerId;
      payload: { playerIdToRemove: string };
    };

type GameEvent =
  | {
      type: "PLAYER_JOIN_REQUEST";
      playerSetupData: InitialPlayerSetupData;
      playerId: PlayerId;
    }
  | { type: "PLAYER_RECONNECTED"; playerId: PlayerId; newSocketId: string }
  | { type: "PLAYER_DISCONNECTED"; playerId: PlayerId }
  | PlayerActionEvents
  | { type: "TIMER.PEEK_TO_SWAP"; sourceCardId: string }
  | { type: "LOBBY_DISCONNECT_TIMEOUT"; playerId: PlayerId };

type EmittedEvent =
  | { type: "BROADCAST_GAME_STATE" }
  | { type: "BROADCAST_CHAT_MESSAGE"; chatMessage: ChatMessage }
  | {
      type: "SEND_EVENT_TO_PLAYER";
      payload: {
        playerId: PlayerId;
        eventName: SocketEventName;
        eventData: unknown;
      };
    };

// Log copy formatter: CardRank's wire values are single characters ("T",
// "K"), which read as debug output in player-facing sentences.
const RANK_LOG_NAMES: Partial<Record<CardRank, string>> = {
  [CardRank.Ace]: "Ace",
  [CardRank.Ten]: "10",
  [CardRank.Jack]: "Jack",
  [CardRank.Queen]: "Queen",
  [CardRank.King]: "King",
};
const formatRankForLog = (rank: CardRank): string =>
  RANK_LOG_NAMES[rank] ?? rank;

interface DiscardLogicParams {
  discardPile: Card[];
  abilityStack: ServerActiveAbility[];
  log: RichGameLogMessage[];
  gameId: string;
  players: Record<PlayerId, ServerPlayer>;
  cardToDiscard: Card;
  playerId: PlayerId;
}
const applyDiscardLogic = ({
  discardPile,
  abilityStack,
  log,
  gameId,
  players,
  cardToDiscard,
  playerId,
}: DiscardLogicParams) => {
  const newAbilityStack = [...abilityStack];
  const rankName = formatRankForLog(cardToDiscard.rank);
  const article = /^(A|8)/.test(rankName) ? "an" : "a";
  const isSealed = abilityRanks.has(cardToDiscard.rank);
  if (isSealed) {
    const type: AbilityType =
      cardToDiscard.rank === CardRank.King
        ? "king"
        : cardToDiscard.rank === CardRank.Queen
          ? "peek"
          : "swap";
    const abilityObj: ServerActiveAbility = {
      type,
      stage: type === "king" || type === "peek" ? "peeking" : "swapping",
      playerId,
      sourceCard: cardToDiscard,
      source: "discard",
    };
    if (type === "king") abilityObj.remainingPeeks = 2;
    if (type === "peek") abilityObj.remainingPeeks = 1;
    newAbilityStack.push(abilityObj);
  }
  return {
    discardPile: [...discardPile, cardToDiscard] as Card[],
    discardPileIsSealed: isSealed,
    log: [
      ...log,
      createLogEntry(gameId, {
        message: `${getPlayerNameForLog(playerId, players)} discarded ${article} ${rankName}.`,
        type: "public",
        tags: ["player-action"],
      }),
    ] as RichGameLogMessage[],
    abilityStack: newAbilityStack,
  } as const;
};

const baseTurnStateNode = {
  initial: TurnPhase.DRAW,
  states: {
    [TurnPhase.DRAW]: {
      entry: [
        "log_ENTER_TURN_DRAW",
        assign(() => ({
          currentTurnSegment: TurnPhase.DRAW,
          turnDeadline: Date.now() + TURN_TIMER_MS,
        })),
        "unsealDiscardPile",
        "broadcastGameState",
      ],
      // Turn timer: an idle player auto-draws from the deck so the game
      // can't stall on one connected-but-absent player.
      after: {
        turnTimer: {
          actions: raise(({ context }: { context: GameContext }) => ({
            type: PlayerActionType.DRAW_FROM_DECK as const,
            playerId: context.currentPlayerId!,
          })) as any,
        },
      },
      on: {
        [PlayerActionType.DRAW_FROM_DECK]: {
          target: TurnPhase.DISCARD,
          guard: and(["isPlayerTurn", not("isDeckEmpty")]),
          actions: "drawFromDeck",
        },
        [PlayerActionType.DRAW_FROM_DISCARD]: {
          target: TurnPhase.DISCARD,
          guard: and(["isPlayerTurn", "canDrawFromDiscard"]),
          actions: "drawFromDiscard",
        },
      },
      always: [
        {
          // The player whose turn just started is disconnected (they dropped
          // earlier, while it was not yet their turn). Pause for recovery.
          target: "#game.error",
          guard: "isCurrentPlayerDisconnected",
          actions: [
            {
              type: "enterErrorState",
              params: ({ context }: { context: GameContext }) => ({
                errorType: "NETWORK_ERROR" as const,
                playerId: context.currentPlayerId!,
              }),
            },
            "broadcastGameState",
          ],
        },
        {
          // Rules 11.A: the draw pile is exhausted — rebuild it from the
          // discard pile (minus its top card) inline and play on. This is a
          // normal game event, not an error: the old detour through
          // #game.error tried to come back via #game.history, and a
          // root-level history node never records anything (its parent, the
          // machine root, never exits), so the "resume" silently landed in
          // WAITING_FOR_PLAYERS and hard-locked the game. Targetless: the
          // reshuffle refills the deck, the guard turns false, and DRAW
          // continues with the deadline its entry already armed.
          guard: ({ context }: { context: GameContext }) =>
            context.deck.length === 0 && context.discardPile.length > 1,
          actions: ["reshuffleDiscardIntoDeck", "broadcastGameState"],
        },
        {
          // Rules 11.B: no cards anywhere to rebuild a deck — the round ends
          // and everyone scores their current hand.
          target: `#game.${GameStage.SCORING}`,
          guard: "isDeckEmpty",
        },
      ],
    },

    [TurnPhase.DISCARD]: {
      entry: [
        "log_ENTER_TURN_DISCARD",
        // Fresh deadline: drawing was an action, so the decide window gets
        // its own full budget (inactivity model — acting resets the clock).
        // The turnTimer delay is scheduled after entry actions run, so the
        // auto-resolve re-arms from this new deadline.
        assign(() => ({
          currentTurnSegment: TurnPhase.DISCARD,
          turnDeadline: Date.now() + TURN_TIMER_MS,
        })),
        "broadcastGameState",
      ],
      // Turn timer: deck draws are auto-discarded; discard-pile draws must be
      // swapped (rules 6.A), so the first hand slot is used.
      after: {
        turnTimer: {
          actions: enqueueActions(
            ({ context, enqueue }: { context: GameContext; enqueue: any }) => {
              const playerId = context.currentPlayerId;
              const pending = playerId
                ? context.players[playerId]?.pendingDrawnCard
                : null;
              if (!playerId || !pending) return;
              if (pending.source === "deck") {
                enqueue.raise({
                  type: PlayerActionType.DISCARD_DRAWN_CARD,
                  playerId,
                });
              } else {
                enqueue.raise({
                  type: PlayerActionType.SWAP_AND_DISCARD,
                  playerId,
                  payload: { handCardIndex: 0 },
                });
              }
            },
          ) as any,
        },
      },
      on: {
        [PlayerActionType.SWAP_AND_DISCARD]: {
          guard: and(["isPlayerTurn", "hasDrawnCard", "isValidHandIndex"]),
          actions: "swapAndDiscard",
          target: "postDiscard",
        },
        [PlayerActionType.DISCARD_DRAWN_CARD]: {
          guard: and(["isPlayerTurn", "hasDrawnCard", "wasDrawnFromDeck"]),
          actions: "discardDrawnCard",
          target: "postDiscard",
        },
      },
    },

    postDiscard: {
      entry: "broadcastGameState",
      always: { target: "matching" },
    },

    ability: {
      entry: [
        "log_ENTER_TURN_ABILITY",
        assign(() => ({
          currentTurnSegment: TurnPhase.ABILITY,
          turnDeadline: Date.now() + TURN_TIMER_MS,
        })),
        "broadcastGameState",
      ],
      // Turn timer: an unresolved ability fizzles. Re-entering arms a fresh
      // timer for the next ability on the stack (if any).
      after: {
        turnTimer: {
          target: "ability",
          reenter: true,
          actions: ["fizzleTopAbility", "broadcastGameState"],
        },
      },
      always: [
        {
          guard: or(["isAbilityOwnerLocked", "isAbilityOwnerDisconnected"]),
          actions: ["fizzleTopAbility", "broadcastGameState"],
        },
        {
          target: "endOfTurn",
          guard: not("isAbilityCardOnTopOfAbilityStack"),
        },
      ],
      on: {
        [PlayerActionType.USE_ABILITY]: [
          {
            // Peek confirm / skip-peek: the ability STAYS on the stack and a
            // new decision window begins (the peek view, then the swap
            // selection). Re-enter so entry assigns a fresh turnDeadline and
            // re-arms after(turnTimer) — acting resets the clock, the same
            // model R7.3 gave DISCARD. The old targetless transition left
            // the entry-armed timer running, so confirming a peek near the
            // deadline got the ability fizzled mid-peek-view, or the swap
            // stage squeezed into the window's leftovers (proven in
            // .remember/repro-peek-swap.mjs). The pending delayed
            // TIMER.PEEK_TO_SWAP raise is actor-scoped and survives the
            // re-entry. Entry broadcasts, so no broadcast action here —
            // emitPeekResults still runs first, preserving today's
            // results-then-broadcast order.
            guard: and([
              "isValidAbilityAction",
              ({ context, event }: { context: GameContext; event: any }) =>
                event.payload?.action === "peek" ||
                (event.payload?.action === "skip" &&
                  context.abilityStack.at(-1)?.stage === "peeking"),
            ]),
            target: "ability",
            reenter: true,
            actions: [
              "performAbilityAction",
              "emitPeekResults",
              "schedulePeekToSwap",
            ],
          },
          {
            // Pooled combo, NON-final swap: another swap still follows on the
            // same ability (remainingSwaps > 1). Re-enter like the peek branch
            // so the next swap gets a fresh decision window and re-armed timer,
            // instead of inheriting the finishing swap's stale deadline. The
            // ability stays on the stack (performAbilityAction only decrements).
            guard: and([
              "isValidAbilityAction",
              ({ context, event }: { context: GameContext; event: any }) =>
                event.payload?.action === "swap" &&
                (context.abilityStack.at(-1)?.remainingSwaps ?? 1) > 1,
            ]),
            target: "ability",
            reenter: true,
            actions: ["performAbilityAction"],
          },
          {
            // Swap / skip-swap: pops the ability; stay targetless and let
            // the always-transition advance the turn exactly as before.
            guard: "isValidAbilityAction",
            actions: [
              "performAbilityAction",
              "emitPeekResults",
              "schedulePeekToSwap",
              "broadcastGameState",
            ],
          },
        ],
        // The peek display is over — the swap selection is a NEW decision
        // window: re-enter for a fresh deadline and a re-armed auto-resolve.
        // This replaces the machine-root handler, which flipped the stage as
        // a bare context assign and left the stale deadline (and the
        // entry-armed fizzle timer) running. Guarded so a stale timer whose
        // ability already resolved or fizzled no-ops, exactly as before.
        "TIMER.PEEK_TO_SWAP": {
          guard: ({ context, event }: { context: GameContext; event: any }) => {
            const top = context.abilityStack.at(-1);
            return (
              !!top &&
              top.stage === "peeking" &&
              top.sourceCard.id === event.sourceCardId
            );
          },
          target: "ability",
          reenter: true,
          actions: "transitionToSwapStage",
        },
      },
    },

    matching: {
      entry: [
        "log_ENTER_TURN_MATCHING",
        // The matching window has its own countdown (matchingOpportunity's
        // startTimestamp); clear the turn deadline so clients don't show two.
        assign({ currentTurnSegment: TurnPhase.MATCHING, turnDeadline: null }),
        "setupMatchingOpportunity",
        "broadcastGameState",
      ],
      invoke: {
        src: "matchingTimerActor",
        onDone: {
          actions: ["clearMatchingOpportunity", "broadcastGameState"],
          target: "ability",
        },
      },
      on: {
        [PlayerActionType.ATTEMPT_MATCH]: [
          {
            guard: "canAttemptMatch",
            actions: "handleSuccessfulMatch",
            target: "postMatch",
          },
          {
            guard: "isInvalidMatchAttempt",
            actions: ["applyMatchPenalty", "broadcastGameState"],
          },
        ],
        [PlayerActionType.PASS_ON_MATCH_ATTEMPT]: {
          actions: ["handlePlayerPassedOnMatch", "broadcastGameState"],
        },
      },
      always: [
        {
          guard: ({ context }: { context: GameContext }) =>
            (!context.matchingOpportunity ||
              context.matchingOpportunity.remainingPlayerIDs.length === 0) &&
            context.abilityStack.length > 0,
          target: "ability",
          actions: ["clearMatchingOpportunity", "broadcastGameState"],
        },
        {
          guard: ({ context }: { context: GameContext }) =>
            (!context.matchingOpportunity ||
              context.matchingOpportunity.remainingPlayerIDs.length === 0) &&
            context.abilityStack.length === 0,
          target: "endOfTurn",
          actions: ["clearMatchingOpportunity", "broadcastGameState"],
        },
      ],
    },

    postMatch: {
      always: [
        {
          target: "ability",
          guard: "isAbilityCardOnTopOfAbilityStack",
        },
        { target: "endOfTurn" },
      ],
    },

    endOfTurn: { type: "final" },
  },
} as const;

const createTurnStateNode = (onDone: unknown) => ({
  ...baseTurnStateNode,
  onDone,
});

type UseAbilityEvent = Extract<
  GameEvent,
  { type: PlayerActionType.USE_ABILITY }
>;

const emitPeekResults = enqueueActions(({ context, event, enqueue }) => {
  if (event.type !== PlayerActionType.USE_ABILITY) {
    return;
  }

  const useAbilityEvent = event as UseAbilityEvent;
  if (useAbilityEvent.payload.action !== "peek") {
    return;
  }

  const actingPlayerId = useAbilityEvent.playerId;

  const targets = useAbilityEvent.payload.targets;

  if (!Array.isArray(targets)) return;

  const results: Array<{
    card: Card;
    playerId: PlayerId;
    cardIndex: number;
  }> = [];
  for (const target of targets) {
    const targetPlayer = context.players[target.playerId];

    if (
      !targetPlayer ||
      !Number.isInteger(target.cardIndex) ||
      target.cardIndex < 0 ||
      target.cardIndex >= targetPlayer.hand.length ||
      targetPlayer.hand[target.cardIndex] == null
    ) {
      logger.warn(
        { target, gameId: context.gameId },
        "Invalid peek target received, skipping.",
      );
      continue;
    }

    results.push({
      card: targetPlayer.hand[target.cardIndex]!,
      playerId: target.playerId,
      cardIndex: target.cardIndex,
    });
  }

  // One message per peek batch: per-card messages arrive as separate client
  // commits, which started the two flips of a King peek out of sync.
  if (results.length > 0) {
    enqueue(
      emit({
        type: "SEND_EVENT_TO_PLAYER",
        payload: {
          playerId: actingPlayerId,
          eventName: SocketEventName.ABILITY_PEEK_RESULT,
          eventData: { results },
        },
      }) as any,
    );
  }
}) as any;

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
    emitted: {} as EmittedEvent,
    input: {} as GameInput,
  },
  guards: {
    canJoinGame: ({ context }) =>
      Object.keys(context.players).length < context.maxPlayers,
    isGameMaster: ({ context, event }) => {
      assertEvent(event, [
        PlayerActionType.START_GAME,
        PlayerActionType.REMOVE_PLAYER,
        PlayerActionType.PLAY_AGAIN,
      ]);
      return event.playerId === context.gameMasterId;
    },
    areAllPlayersReady: ({ context }) => {
      const connectedPlayers = Object.values(context.players).filter(
        (p) => p.isConnected,
      );
      return (
        connectedPlayers.length >= 2 && connectedPlayers.every((p) => p.isReady)
      );
    },
    // Disconnected players count as ready so one dropout can't stall the peek phase forever.
    allPlayersReadyForPeek: ({ context }) =>
      context.turnOrder.every((id) => {
        const p = context.players[id];
        return !p || p.isReady || !p.isConnected;
      }),
    isPlayerTurn: ({ context, event }) => {
      assertEvent(event, [
        PlayerActionType.DRAW_FROM_DECK,
        PlayerActionType.DRAW_FROM_DISCARD,
        PlayerActionType.SWAP_AND_DISCARD,
        PlayerActionType.DISCARD_DRAWN_CARD,
        PlayerActionType.CALL_CHECK,
      ]);
      return event.playerId === context.currentPlayerId;
    },
    hasDrawnCard: ({ context, event }) => {
      assertEvent(event, [
        PlayerActionType.SWAP_AND_DISCARD,
        PlayerActionType.DISCARD_DRAWN_CARD,
      ]);
      return !!context.players[event.playerId]?.pendingDrawnCard;
    },
    wasDrawnFromDeck: ({ context, event }) => {
      assertEvent(event, PlayerActionType.DISCARD_DRAWN_CARD);
      return (
        context.players[event.playerId]?.pendingDrawnCard?.source === "deck"
      );
    },
    canDrawFromDiscard: ({ context }) => {
      if (context.discardPileIsSealed) return false;
      const topOfDiscard = context.discardPile.at(-1);
      if (!topOfDiscard) return false;
      if (specialRanks.has(topOfDiscard.rank)) return false;
      // A matched card is locked for the round, even once the seal lifts.
      if (context.lockedCardIds.includes(topOfDiscard.id)) return false;
      return true;
    },
    isValidHandIndex: ({ context, event }) => {
      assertEvent(event, PlayerActionType.SWAP_AND_DISCARD);
      const hand = context.players[event.playerId]?.hand;
      const index = event.payload?.handCardIndex;
      return (
        !!hand &&
        Number.isInteger(index) &&
        index >= 0 &&
        index < hand.length &&
        hand[index] != null
      );
    },
    canCallCheck: ({ context, event }) => {
      assertEvent(event, PlayerActionType.CALL_CHECK);
      const player = context.players[event.playerId];
      return (
        context.currentTurnSegment === TurnPhase.DRAW &&
        !player?.pendingDrawnCard &&
        !player?.isLocked
      );
    },
    isAbilityCardOnTopOfAbilityStack: ({ context }) =>
      context.abilityStack.length > 0,
    canAttemptMatch: ({ context, event }) => {
      assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
      const {
        playerId,
        payload: { handCardIndex },
      } = event;
      const { matchingOpportunity, players } = context;
      if (!matchingOpportunity) return false;
      const player = players[playerId];
      if (!player || !matchingOpportunity.remainingPlayerIDs.includes(playerId))
        return false;
      const cardInHand = player.hand[handCardIndex];
      return (
        !!cardInHand && cardInHand.rank === matchingOpportunity.cardToMatch.rank
      );
    },
    abilityOwnerActive: ({ context, event }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      const currentAbility = context.abilityStack.at(-1);
      return !!currentAbility && currentAbility.playerId === event.playerId;
    },
    ownerUnlocked: ({ context, event }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      return !context.players[event.playerId]!.isLocked;
    },
    peekStageAction: ({ context, event }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      const currentAbility = context.abilityStack.at(-1);
      if (
        !currentAbility ||
        currentAbility.stage !== "peeking" ||
        !["peek", "king"].includes(currentAbility.type)
      )
        return false;

      if (event.payload.action !== "peek") return false;

      const remaining = currentAbility.remainingPeeks ?? 0;
      const requested = Array.isArray(event.payload.targets)
        ? event.payload.targets.length
        : 1;

      return remaining >= requested && remaining > 0;
    },
    validPeekTargets: ({ context, event }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      if (!("targets" in event.payload)) return false;
      if (!Array.isArray(event.payload.targets)) return false;
      for (const target of event.payload.targets) {
        const targetPlayer = context.players[target?.playerId];
        if (
          !targetPlayer ||
          !Number.isInteger(target.cardIndex) ||
          target.cardIndex < 0 ||
          target.cardIndex >= targetPlayer.hand.length ||
          targetPlayer.hand[target.cardIndex] == null
        ) {
          return false;
        }
        if (target.playerId !== event.playerId && targetPlayer.isLocked) {
          return false;
        }
      }
      return true;
    },
    swapStageAction: ({ context, event }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      const currentAbility = context.abilityStack.at(-1);
      return (
        event.payload.action === "swap" && currentAbility?.stage === "swapping"
      );
    },
    validSwapTargets: ({ context, event }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      if (!("source" in event.payload) || !("target" in event.payload))
        return false;
      const { source, target } = event.payload;
      for (const slot of [source, target]) {
        const owner = context.players[slot?.playerId];
        if (
          !owner ||
          !Number.isInteger(slot.cardIndex) ||
          slot.cardIndex < 0 ||
          slot.cardIndex >= owner.hand.length ||
          owner.hand[slot.cardIndex] == null
        ) {
          return false;
        }
        if (slot.playerId !== event.playerId && owner.isLocked) return false;
      }
      return true;
    },
    isValidAbilityAction: and([
      "abilityOwnerActive",
      "ownerUnlocked",
      or([
        ({ event }) => {
          assertEvent(event, PlayerActionType.USE_ABILITY);
          return event.payload.action === "skip";
        },
        and(["peekStageAction", "validPeekTargets"]),
        and(["swapStageAction", "validSwapTargets"]),
      ]),
    ]),
    isCheckRoundOver: ({ context }) => {
      if (!context.checkDetails) return false;
      return (
        context.checkDetails.finalTurnIndex >=
        context.checkDetails.finalTurnOrder.length
      );
    },
    isDeckEmpty: ({ context }) => context.deck.length === 0,
    isCurrentPlayer: ({ context, event }) => {
      assertEvent(event, ["PLAYER_DISCONNECTED", PlayerActionType.LEAVE_GAME]);
      return context.currentPlayerId === event.playerId;
    },
    isInvalidMatchAttempt: ({ context, event }) => {
      assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
      const {
        playerId,
        payload: { handCardIndex },
      } = event;
      const { matchingOpportunity, players } = context;

      if (!matchingOpportunity) return false;
      const player = players[playerId];
      if (!player || !matchingOpportunity.remainingPlayerIDs.includes(playerId))
        return false;

      const cardInHand = player.hand[handCardIndex];
      return (
        !!cardInHand && cardInHand.rank !== matchingOpportunity.cardToMatch.rank
      );
    },
    isAbilityOwnerLocked: ({ context }) => {
      const currentAbility = context.abilityStack.at(-1);
      if (!currentAbility) return false;
      const owner = context.players[currentAbility.playerId];
      return !owner || owner.isLocked;
    },
    isAbilityOwnerDisconnected: ({ context }) => {
      const currentAbility = context.abilityStack.at(-1);
      if (!currentAbility) return false;
      return !context.players[currentAbility.playerId]?.isConnected;
    },
    isCurrentPlayerDisconnected: ({ context }) =>
      !!context.currentPlayerId &&
      !context.players[context.currentPlayerId]?.isConnected,
  },
  actions: {
    removePlayerAndHandleGM: assign(({ context, event }) => {
      assertEvent(event, [
        PlayerActionType.LEAVE_GAME,
        "PLAYER_DISCONNECTED",
        "LOBBY_DISCONNECT_TIMEOUT",
      ]);
      const { playerId } = event;
      if (!context.players[playerId]) {
        return {};
      }

      const playerName = getPlayerNameForLog(playerId, context.players);
      const { [playerId]: _, ...remainingPlayers } = context.players;
      const newTurnOrder = context.turnOrder.filter((id) => id !== playerId);

      let newGameMasterId = context.gameMasterId;
      if (playerId === context.gameMasterId && newTurnOrder.length > 0) {
        newGameMasterId = newTurnOrder[0]!;
      } else if (newTurnOrder.length === 0) {
        newGameMasterId = null;
      }

      return {
        players: remainingPlayers,
        turnOrder: newTurnOrder,
        gameMasterId: newGameMasterId,
        log: [
          ...context.log,
          createLogEntry(context.gameId, {
            message: `${playerName} has left the lobby.`,
            type: "public",
            tags: ["system-message"],
          }),
        ],
      };
    }),
    addPlayer: assign(({ context, event }) => {
      assertEvent(event, "PLAYER_JOIN_REQUEST");
      const { playerSetupData, playerId } = event;
      const isGameMaster = Object.keys(context.players).length === 0;
      const newPlayer: ServerPlayer = {
        id: playerId,
        name: playerSetupData.name,
        socketId: playerSetupData.socketId || "",
        hand: [],
        isReady: false,
        isDealer: isGameMaster,
        hasCalledCheck: false,
        isLocked: false,
        score: 0,
        isConnected: true,
        pendingDrawnCard: null,
        forfeited: false,
        status: PlayerStatus.WAITING,
      };
      return {
        players: { ...context.players, [playerId]: newPlayer },
        turnOrder: [...context.turnOrder, playerId],
        gameMasterId: isGameMaster ? playerId : context.gameMasterId,
        log: [
          ...context.log,
          createLogEntry(context.gameId, {
            message: `${newPlayer.name} has joined the game.`,
            type: "public",
            tags: ["system-message"],
          }),
        ],
      };
    }),
    removePlayer: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.REMOVE_PLAYER);
      const { playerIdToRemove } = event.payload;
      if (!context.players[playerIdToRemove]) return {};
      const { [playerIdToRemove]: _, ...remainingPlayers } = context.players;
      return {
        players: remainingPlayers,
        turnOrder: context.turnOrder.filter((id) => id !== playerIdToRemove),
        log: [
          ...context.log,
          createLogEntry(context.gameId, {
            message: `${getPlayerNameForLog(playerIdToRemove, context.players)} was removed from the game.`,
            type: "public",
            tags: ["system-message"],
          }),
        ],
      };
    }),
    performAbilityAction: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      const { playerId, payload } = event;
      const currentAbility = context.abilityStack.at(-1);
      if (!currentAbility || currentAbility.playerId !== playerId) return {};

      const playerName = getPlayerNameForLog(playerId, context.players);
      const newLog = [...context.log];
      const logAction = (message: string) =>
        newLog.push(
          createLogEntry(context.gameId, {
            message,
            type: "public",
            tags: ["player-action", "ability"],
          }),
        );

      let updatedPlayers = context.players;
      const newAbilityStack = produce(context.abilityStack, (draft) => {
        const ability = draft.at(-1)!;

        if (payload.action === "skip") {
          if (ability.stage === "peeking") {
            ability.stage = "swapping";
            delete ability.remainingPeeks;
            logAction(`${playerName} skipped their peeks.`);
          } else {
            draft.pop();
            logAction(`${playerName} skipped their swap.`);
          }
        } else if (
          payload.action === "peek" &&
          ability.stage === "peeking" &&
          (ability.type === "peek" || ability.type === "king")
        ) {
          const peeksUsed = Array.isArray(payload.targets)
            ? payload.targets.length
            : 1;
          if (ability.remainingPeeks && ability.remainingPeeks > peeksUsed) {
            ability.remainingPeeks -= peeksUsed;
          } else {
            delete ability.remainingPeeks;
          }
          logAction(`${playerName} used Peek.`);
        } else if (payload.action === "swap" && ability.stage === "swapping") {
          // Pooled combo: consume one swap and stay in the swapping stage for
          // the next one; only pop the ability when the last swap is done.
          if (ability.remainingSwaps && ability.remainingSwaps > 1) {
            ability.remainingSwaps -= 1;
          } else {
            draft.pop();
          }
          logAction(`${playerName} used Swap.`);
        }
      });

      if (payload.action === "swap" && currentAbility.stage === "swapping") {
        const { source, target } = payload;
        updatedPlayers = produce(context.players, (draft) => {
          const sourceHand = draft[source.playerId]!.hand;
          const targetHand = draft[target.playerId]!.hand;
          const temp = sourceHand[source.cardIndex]!;
          sourceHand[source.cardIndex] = targetHand[target.cardIndex]!;
          targetHand[target.cardIndex] = temp;
        });
      }

      // Real-life table parity: everyone gets to see WHICH cards are being
      // peeked at (positions only, never the faces). Cleared when the peek
      // display window ends (skip/swap/stage flip/fizzle).
      let newPublicPeek = null as GameContext["publicPeek"];
      if (
        payload.action === "peek" &&
        currentAbility.stage === "peeking" &&
        Array.isArray(payload.targets)
      ) {
        newPublicPeek = {
          peekerId: playerId,
          targets: payload.targets.map((t) => ({
            playerId: t.playerId,
            cardIndex: t.cardIndex,
          })),
          startedAt: Date.now(),
        };
      }

      // Real-life table parity for swaps: everyone sees WHICH two positions
      // traded cards, never the faces. Momentary — clients hide it ~2.5s
      // after occurredAt, so only round/score resets need to clear it. The
      // swap payload carries singular source/target objects (not a targets
      // array like peek), so assemble the two positions from them here.
      let newPublicSwap = null as GameContext["publicSwap"];
      if (payload.action === "swap" && currentAbility.stage === "swapping") {
        newPublicSwap = {
          swapperId: playerId,
          targets: [
            {
              playerId: payload.source.playerId,
              cardIndex: payload.source.cardIndex,
            },
            {
              playerId: payload.target.playerId,
              cardIndex: payload.target.cardIndex,
            },
          ],
          occurredAt: Date.now(),
        };
      }

      return {
        players: updatedPlayers,
        abilityStack: newAbilityStack,
        log: newLog,
        publicPeek: newPublicPeek,
        publicSwap: newPublicSwap,
      };
    }),
    updatePlayerLobbyReady: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DECLARE_LOBBY_READY);
      return context.players[event.playerId]
        ? {
            players: {
              ...context.players,
              [event.playerId]: {
                ...context.players[event.playerId]!,
                isReady: true,
              },
            },
          }
        : {};
    }),
    updatePlayerLobbyUnready: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DECLARE_LOBBY_UNREADY);
      return context.players[event.playerId]
        ? {
            players: {
              ...context.players,
              [event.playerId]: {
                ...context.players[event.playerId]!,
                isReady: false,
              },
            },
          }
        : {};
    }),
    dealCards: assign(({ context }) => {
      const deck = shuffleDeck(createDeck());
      const playersAfterDeal = produce(context.players, (draft) => {
        Object.values(draft).forEach((p) => {
          p.hand = [];
          p.isReady = false;
        });
        for (let i = 0; i < context.cardsPerPlayer; i++) {
          for (const playerId of context.turnOrder) {
            if (deck.length) {
              draft[playerId]!.hand.push(deck.pop()!);
            }
          }
        }
      });
      return {
        deck,
        players: playersAfterDeal,
        discardPile: [] as Card[],
        lockedCardIds: [] as string[],
        log: [
          ...context.log,
          createLogEntry(context.gameId, {
            message: `${getPlayerNameForLog(context.gameMasterId!, context.players)} dealt the cards.`,
            type: "public",
            tags: ["game-event"],
          }),
        ] as RichGameLogMessage[],
        gameStage: GameStage.DEALING,
        publicPeek: null,
        publicSwap: null,
        publicPenalty: null,
        turnDeadline: null,
      };
    }),
    updatePlayerPeekReady: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DECLARE_READY_FOR_PEEK);
      return context.players[event.playerId]
        ? {
            players: {
              ...context.players,
              [event.playerId]: {
                ...context.players[event.playerId]!,
                isReady: true,
              },
            },
          }
        : {};
    }),
    drawFromDeck: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DRAW_FROM_DECK);
      const newDeck = [...context.deck];
      const drawnCard = newDeck.pop()!;
      const pendingDrawnCard: { card: Card; source: "deck" | "discard" } = {
        card: drawnCard,
        source: "deck",
      };
      return {
        deck: newDeck,
        players: {
          ...context.players,
          [event.playerId]: {
            ...context.players[event.playerId]!,
            pendingDrawnCard,
          },
        },
      };
    }),
    drawFromDiscard: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DRAW_FROM_DISCARD);
      const newDiscard = [...context.discardPile];
      const drawnCard = newDiscard.pop()!;
      const pendingDrawnCard: { card: Card; source: "deck" | "discard" } = {
        card: drawnCard,
        source: "discard",
      };
      return {
        discardPile: newDiscard,
        players: {
          ...context.players,
          [event.playerId]: {
            ...context.players[event.playerId]!,
            pendingDrawnCard,
          },
        },
      };
    }),
    swapAndDiscard: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.SWAP_AND_DISCARD);
      const {
        playerId,
        payload: { handCardIndex },
      } = event;
      const updatedPlayers = produce(context.players, (draft) => {
        const player = draft[playerId]!;
        player.hand[handCardIndex] = player.pendingDrawnCard!.card;
        player.pendingDrawnCard = null;
      });
      const cardToDiscard = context.players[playerId]!.hand[handCardIndex]!;
      return {
        players: updatedPlayers,
        ...applyDiscardLogic({
          discardPile: context.discardPile,
          abilityStack: context.abilityStack,
          log: context.log,
          gameId: context.gameId,
          players: updatedPlayers,
          cardToDiscard,
          playerId,
        }),
      };
    }),
    discardDrawnCard: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DISCARD_DRAWN_CARD);
      const updatedPlayers = produce(context.players, (draft) => {
        draft[event.playerId]!.pendingDrawnCard = null;
      });
      const cardToDiscard =
        context.players[event.playerId]!.pendingDrawnCard!.card;
      return {
        players: updatedPlayers,
        ...applyDiscardLogic({
          discardPile: context.discardPile,
          abilityStack: context.abilityStack,
          log: context.log,
          gameId: context.gameId,
          players: updatedPlayers,
          cardToDiscard,
          playerId: event.playerId,
        }),
      };
    }),
    setNextPlayer: assign(({ context }) => {
      const { currentPlayerId, turnOrder } = context;
      if (!currentPlayerId) return {};
      let nextIndex =
        (turnOrder.indexOf(currentPlayerId) + 1) % turnOrder.length;
      let stop = turnOrder.length;
      while (stop > 0 && context.players[turnOrder[nextIndex]!]?.isLocked) {
        nextIndex = (nextIndex + 1) % turnOrder.length;
        stop--;
      }
      return {
        currentPlayerId: turnOrder[nextIndex]!,
        currentTurnSegment: TurnPhase.DRAW,
      };
    }),
    setupCheck: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.CALL_CHECK);
      const { playerId } = event;
      const callerIndex = context.turnOrder.indexOf(playerId);
      const finalTurnOrder = [
        ...context.turnOrder.slice(callerIndex + 1),
        ...context.turnOrder.slice(0, callerIndex),
      ].filter((id) => !context.players[id]!.isLocked);
      return {
        players: {
          ...context.players,
          [playerId]: {
            ...context.players[playerId]!,
            hasCalledCheck: true,
            isLocked: true,
            status: PlayerStatus.CALLED_CHECK,
          },
        },
        gameStage: GameStage.FINAL_TURNS,
        checkDetails: { callerId: playerId, finalTurnOrder, finalTurnIndex: 0 },
      };
    }),
    setNextPlayerInFinalTurns: assign(({ context }) => {
      if (!context.checkDetails) return {};
      let newIndex = context.checkDetails.finalTurnIndex;
      do {
        newIndex++;
      } while (
        newIndex < context.checkDetails.finalTurnOrder.length &&
        context.players[context.checkDetails.finalTurnOrder[newIndex]!]
          ?.isLocked
      );
      return {
        checkDetails: { ...context.checkDetails, finalTurnIndex: newIndex },
      };
    }),
    setCurrentPlayerInFinalTurns: assign(({ context }) => {
      const { checkDetails } = context;
      if (
        !checkDetails ||
        checkDetails.finalTurnIndex >= checkDetails.finalTurnOrder.length
      )
        return { currentPlayerId: null };
      return {
        currentPlayerId:
          checkDetails.finalTurnOrder[checkDetails.finalTurnIndex]!,
      };
    }),
    unsealDiscardPile: assign({ discardPileIsSealed: false }),
    setupMatchingOpportunity: assign(({ context }) => {
      if (!context.currentPlayerId) return {};
      const cardToMatch = context.discardPile.at(-1)!;
      return {
        matchingOpportunity: {
          cardToMatch,
          originalPlayerID: context.currentPlayerId,
          remainingPlayerIDs: context.turnOrder.filter(
            (id) => !context.players[id]!.isLocked,
          ),
          startTimestamp: Date.now(),
          // Ship the authoritative window length so the client bar animates
          // over the same duration the server's matchingTimerActor fires on
          // (which is env-configurable) instead of a hardcoded constant that
          // silently diverges in prod and ends the bar early (~75%).
          durationMs: MATCHING_STAGE_DURATION_MS,
        },
      };
    }),
    handleSuccessfulMatch: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
      const {
        playerId,
        payload: { handCardIndex },
      } = event;

      const cardFromHand = context.players[playerId]!.hand[handCardIndex]!;
      // The card already on top of the pile is the one being matched onto.
      const matchedBaseCard = context.discardPile.at(-1);
      const handWillBeEmpty =
        context.players[playerId]!.hand.filter((c) => c !== null).length === 1;

      const newPlayers = produce(context.players, (draft) => {
        const player = draft[playerId]!;
        // Leave a gap where the matched card was, then collapse any column that
        // is now fully empty (the only automatic reshuffle).
        player.hand[handCardIndex] = null;
        player.hand = compactFullColumns(player.hand);
        if (handWillBeEmpty) {
          player.hasCalledCheck = true;
          player.isLocked = true;
          player.status = PlayerStatus.CALLED_CHECK;
        }
      });

      let newCheckDetails = context.checkDetails;
      let gameStage = context.gameStage;
      if (handWillBeEmpty && !context.checkDetails) {
        const callerIndex = context.turnOrder.indexOf(playerId);
        const finalTurnOrder = [
          ...context.turnOrder.slice(callerIndex + 1),
          ...context.turnOrder.slice(0, callerIndex),
        ].filter((id) => !context.players[id]!.isLocked);
        newCheckDetails = {
          callerId: playerId,
          finalTurnOrder,
          finalTurnIndex: 0,
        };
        gameStage = GameStage.FINAL_TURNS;
      }

      // The discarded card's own ability is already on the stack (pushed when it
      // was discarded). A matched special pair only adds the matcher's ability on
      // top, giving the LIFO order from the rules: matcher first, discarder second.
      let newAbilityStack = context.abilityStack;
      if (abilityRanks.has(cardFromHand.rank)) {
        const type: AbilityType =
          cardFromHand.rank === CardRank.King
            ? "king"
            : cardFromHand.rank === CardRank.Queen
              ? "peek"
              : "swap";
        const matcherAbility: ServerActiveAbility = {
          type,
          stage: type === "king" || type === "peek" ? "peeking" : "swapping",
          playerId,
          sourceCard: cardFromHand,
          source: "stack",
        };
        if (type === "king") matcherAbility.remainingPeeks = 2;
        else if (type === "peek") matcherAbility.remainingPeeks = 1;

        // Same-player combo pooling: if this player matched a peek-capable card
        // (King/Queen) onto their OWN peek-capable ability already on top of the
        // stack, POOL them into one ability — all peeks first, then all swaps
        // (real-life 2× King = 4 peeks then 2 swaps). When the top belongs to a
        // DIFFERENT player, or either side is a plain swap (Jack), keep them as
        // separate stack entries so they resolve linearly, one owner at a time.
        const isPeekCapable = (t: AbilityType) => t === "king" || t === "peek";
        const top = context.abilityStack.at(-1);
        if (
          top &&
          top.playerId === playerId &&
          isPeekCapable(top.type) &&
          isPeekCapable(matcherAbility.type)
        ) {
          newAbilityStack = produce(context.abilityStack, (draft) => {
            const merged = draft.at(-1)!;
            merged.remainingPeeks =
              (merged.remainingPeeks ?? 0) + (matcherAbility.remainingPeeks ?? 0);
            // Each peek-capable ability owes one swap after its peeks; pool them.
            merged.remainingSwaps = (merged.remainingSwaps ?? 1) + 1;
            // Peeks come first for the whole pool; keep the discarder's stable
            // sourceCard (already the top's) so the peek→swap timer and the
            // client's context key stay correlated.
            merged.stage = "peeking";
          });
        } else {
          newAbilityStack = [...context.abilityStack, matcherAbility];
        }
      }

      const matchedRankName = formatRankForLog(cardFromHand.rank);
      const matchedArticle = /^(A|8)/.test(matchedRankName) ? "an" : "a";

      return {
        players: newPlayers,
        discardPile: [...context.discardPile, cardFromHand],
        matchingOpportunity: null,
        discardPileIsSealed: true,
        // Both the matched card and the card played on it are locked forever.
        lockedCardIds: [
          ...context.lockedCardIds,
          ...(matchedBaseCard ? [matchedBaseCard.id] : []),
          cardFromHand.id,
        ],
        abilityStack: newAbilityStack,
        log: [
          ...context.log,
          createLogEntry(context.gameId, {
            message: `${getPlayerNameForLog(playerId, context.players)} matched ${matchedArticle} ${matchedRankName}.`,
            type: "public",
            tags: ["player-action", "game-event"],
            actor: {
              id: playerId,
              name: getPlayerNameForLog(playerId, context.players),
            },
          }),
        ],
        checkDetails: newCheckDetails,
        gameStage,
      };
    }),
    handlePlayerPassedOnMatch: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.PASS_ON_MATCH_ATTEMPT);
      if (!context.matchingOpportunity) return {};
      return {
        matchingOpportunity: {
          ...context.matchingOpportunity,
          remainingPlayerIDs:
            context.matchingOpportunity.remainingPlayerIDs.filter(
              (id) => id !== event.playerId,
            ),
        },
      };
    }),
    clearMatchingOpportunity: assign({ matchingOpportunity: null }),
    calculateScores: assign(({ context }) => {
      const updatedPlayers = produce(context.players, (draft) => {
        for (const p of Object.values(draft)) {
          const score = p.hand.reduce(
            (acc, card) => acc + (card ? cardScoreValues[card.rank] : 0),
            0,
          );
          p.score = score;
        }
      });

      const playerScores: Record<PlayerId, number> = {};
      Object.values(updatedPlayers).forEach((p) => {
        playerScores[p.id] = p.score;
      });

      // Disqualified players are revealed and scored but cannot win.
      const eligibleScores = Object.values(updatedPlayers)
        .filter((p) => p.status !== PlayerStatus.DISQUALIFIED)
        .map((p) => p.score);
      const minScore = Math.min(...eligibleScores);
      const maxScore = Math.max(...Object.values(playerScores));
      const winnerIds = Object.values(updatedPlayers)
        .filter(
          (p) =>
            p.status !== PlayerStatus.DISQUALIFIED && p.score === minScore,
        )
        .map((p) => p.id);
      const loserId =
        Object.keys(playerScores).find((id) => playerScores[id] === maxScore) ??
        null;

      return {
        players: updatedPlayers,
        winnerId: winnerIds[0] ?? null,
        gameover: { winnerIds, loserId, playerScores },
        gameStage: GameStage.SCORING,
        publicPeek: null,
        publicSwap: null,
        publicPenalty: null,
        turnDeadline: null,
      };
    }),
    resetForNewRound: assign(({ context }) => {
      const newDealerIndex =
        (context.turnOrder.indexOf(context.gameMasterId!) + 1) %
        context.turnOrder.length;
      const newDealerId = context.turnOrder[newDealerIndex]!;

      const updatedPlayers = produce(context.players, (draft) => {
        for (const p of Object.values(draft)) {
          p.hand = [];
          p.isReady = false;
          p.isLocked = false;
          p.hasCalledCheck = false;
          p.pendingDrawnCard = null;
          p.isDealer = p.id === newDealerId;
          p.status = PlayerStatus.WAITING;
          p.score = 0;
        }
      });

      return {
        players: updatedPlayers,
        deck: [],
        discardPile: [],
        lockedCardIds: [],
        abilityStack: [],
        checkDetails: null,
        gameover: null,
        currentPlayerId: newDealerId,
        currentTurnSegment: null,
        lastRoundLoserId: context.gameover?.loserId || null,
        rematchVotes: [],
        // gameMasterId (the lobby host) is deliberately NOT reassigned here:
        // the host is stable for the lobby's lifetime and only changes when
        // the host actually leaves (removePlayerAndHandleGM). It used to be
        // overwritten with the rotated dealer, which handed the "Play Again"
        // control to the wrong player after round one.
        gameStage: GameStage.WAITING_FOR_PLAYERS,
      };
    }),
    setPlayerDisconnected: assign(({ context, event }) => {
      assertEvent(event, ["PLAYER_DISCONNECTED", PlayerActionType.LEAVE_GAME]);
      return context.players[event.playerId]
        ? {
            players: {
              ...context.players,
              [event.playerId]: {
                ...context.players[event.playerId]!,
                isConnected: false,
              },
            },
          }
        : {};
    }),
    addPlayerDisconnectedLog: assign({
      log: ({ context, event }) => {
        assertEvent(event, [
          "PLAYER_DISCONNECTED",
          PlayerActionType.LEAVE_GAME,
        ]);
        const playerName = getPlayerNameForLog(event.playerId, context.players);
        return [
          ...context.log,
          createLogEntry(context.gameId, {
            message: `${playerName} has disconnected.`,
            type: "public",
            tags: ["system-message"],
          }),
        ];
      },
    }),
    markPlayerAsConnected: assign(({ context, event }) => {
      assertEvent(event, "PLAYER_RECONNECTED");
      return context.players[event.playerId]
        ? {
            players: {
              ...context.players,
              [event.playerId]: {
                ...context.players[event.playerId]!,
                isConnected: true,
                socketId: event.newSocketId,
              },
            },
          }
        : {};
    }),
    // Deck exhaustion is handled inline in DRAW (Rules 11.A/11.B), so the
    // pause-and-recover state only ever handles a disconnected current player.
    enterErrorState: assign(
      (
        _,
        params: {
          errorType: "NETWORK_ERROR";
          playerId?: PlayerId;
        },
      ) => ({
        errorState: {
          message: `Player ${params.playerId} has disconnected.`,
          errorType: params.errorType,
          affectedPlayerId: params.playerId,
        },
        // The game is paused; don't leave a stale countdown ticking on clients.
        turnDeadline: null,
      }),
    ),
    clearErrorState: assign({ errorState: null }),
    reshuffleDiscardIntoDeck: assign(({ context }) => {
      const newDiscard = [...context.discardPile];
      const topCard = newDiscard.pop();
      return {
        deck: shuffleDeck(newDiscard),
        discardPile: topCard ? [topCard] : [],
        errorState: null,
        log: [
          ...context.log,
          createLogEntry(context.gameId, {
            message:
              "The draw pile ran out. The discard pile was shuffled into a new deck.",
            type: "public",
            tags: ["game-event"],
          }),
        ],
      };
    }),
    broadcastGameState: emit({ type: "BROADCAST_GAME_STATE" }),
    // A non-host toggling "I want to play again" at GAMEOVER. Add/remove them
    // from the advisory tally; the host's PLAY_AGAIN is what actually restarts.
    toggleRematchVote: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.REQUEST_PLAY_AGAIN);
      const { playerId } = event;
      if (!context.players[playerId]) return {};
      const has = context.rematchVotes.includes(playerId);
      return {
        rematchVotes: has
          ? context.rematchVotes.filter((id) => id !== playerId)
          : [...context.rematchVotes, playerId],
      };
    }),
    setInitialPlayer: assign(({ context }) => {
      // Real-life rule: the winner of the previous round leads the next one.
      // context.winnerId carries across resetForNewRound; fall back to seating
      // order for the first-ever game (winnerId null) or if the prior winner
      // has since left the table.
      const winnerStillHere =
        !!context.winnerId && !!context.players[context.winnerId];
      const firstPlayerId = winnerStillHere
        ? context.winnerId!
        : context.turnOrder[0]!;
      return {
        currentPlayerId: firstPlayerId,
        gameStage: GameStage.PLAYING,
        currentTurnSegment: TurnPhase.DRAW,
      };
    }),
    applyMatchPenalty: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
      const { playerId } = event;

      let tempDeck = [...context.deck];
      let tempDiscard = [...context.discardPile];
      let logMessageText = "";

      if (tempDeck.length === 0) {
        const topCard = tempDiscard.pop();
        tempDeck = shuffleDeck(tempDiscard);
        tempDiscard = topCard ? [topCard] : [];
        logMessageText = `The discard pile was reshuffled. `;
      }

      if (tempDeck.length === 0) {
        logMessageText += `${getPlayerNameForLog(playerId, context.players)} attempted an invalid match, but no penalty card could be drawn.`;
        return {
          log: [
            ...context.log,
            createLogEntry(context.gameId, {
              message: logMessageText,
              type: "public",
              tags: ["game-event", "error"],
            }),
          ],
        };
      }

      const penaltyCard = tempDeck.pop()!;
      const disqualified =
        context.players[playerId]!.hand.filter((c) => c !== null).length + 1 >=
        MAX_HAND_SIZE;
      // Where the penalty card lands, so all clients can highlight the slot.
      let penaltyIndex = 0;
      const updatedPlayers = produce(context.players, (draft) => {
        const player = draft[playerId]!;
        // Reuse the first empty gap if there is one, else grow the hand.
        const gap = player.hand.indexOf(null);
        if (gap >= 0) {
          player.hand[gap] = penaltyCard;
          penaltyIndex = gap;
        } else {
          penaltyIndex = player.hand.length;
          player.hand.push(penaltyCard);
        }
        if (disqualified) {
          player.isLocked = true;
          player.status = PlayerStatus.DISQUALIFIED;
        }
      });

      const playerName = getPlayerNameForLog(playerId, context.players);
      logMessageText += `${playerName} attempted an invalid match and received a penalty card.`;

      const newLog = [
        ...context.log,
        createLogEntry(context.gameId, {
          message: logMessageText,
          type: "public",
          // "penalty" + actor drive the client's PENALTY. stamp (and keep
          // the event off the toast rail — one announcement surface).
          tags: ["player-action", "game-event", "penalty"],
          actor: { id: playerId, name: playerName },
        }),
      ];
      if (disqualified) {
        newLog.push(
          createLogEntry(context.gameId, {
            message: `${playerName} reached ${MAX_HAND_SIZE} cards and is disqualified from the round.`,
            type: "public",
            tags: ["game-event"],
          }),
        );
      }

      return {
        deck: tempDeck,
        discardPile: tempDiscard,
        players: updatedPlayers,
        // Highlight the slot the penalty card landed in for ALL players
        // (position only — the face stays hidden, like swaps/peeks). Clients
        // self-expire the ring after a few seconds.
        publicPenalty: {
          playerId,
          cardIndex: penaltyIndex,
          occurredAt: Date.now(),
        },
        // A disqualified player is out of the current matching window too.
        matchingOpportunity:
          disqualified && context.matchingOpportunity
            ? {
                ...context.matchingOpportunity,
                remainingPlayerIDs:
                  context.matchingOpportunity.remainingPlayerIDs.filter(
                    (id) => id !== playerId,
                  ),
              }
            : context.matchingOpportunity,
        log: newLog,
      };
    }),
    handleFailedRecovery: assign(({ context }) => {
      const affectedPlayerId = context.errorState?.affectedPlayerId;
      if (!affectedPlayerId || !context.players[affectedPlayerId]) {
        return { errorState: null };
      }

      const newPlayers = { ...context.players } as Record<
        PlayerId,
        ServerPlayer
      >;
      newPlayers[affectedPlayerId] = {
        ...newPlayers[affectedPlayerId]!,
        forfeited: true,
        isConnected: false,
        isLocked: true,
      };

      const newTurnOrder = context.turnOrder.filter(
        (id) => id !== affectedPlayerId,
      );
      let newCurrentPlayerId = context.currentPlayerId;

      if (context.currentPlayerId === affectedPlayerId) {
        const currentIndex = context.turnOrder.indexOf(
          context.currentPlayerId!,
        );
        const nextIndex = (currentIndex + 1) % context.turnOrder.length;
        newCurrentPlayerId =
          context.turnOrder[nextIndex] === affectedPlayerId
            ? null
            : context.turnOrder[nextIndex]!;
      }

      const newLog = [
        ...context.log,
        createLogEntry(context.gameId, {
          message: `${getPlayerNameForLog(affectedPlayerId, context.players)} did not reconnect and forfeited the game.`,
          type: "public",
          tags: ["system-message"],
        }),
      ];

      if (newTurnOrder.length <= 1) {
        const winnerId = newTurnOrder[0] ?? null;
        // calculateScores never runs on this path — score the hands here so
        // the end screen doesn't show zeros, and hand the game-master seat to
        // a survivor so the Play Again button still exists for someone.
        const playerScores: Record<PlayerId, number> = {};
        for (const p of Object.values(newPlayers)) {
          const score = p.hand.reduce(
            (acc, card) => acc + (card ? cardScoreValues[card.rank] : 0),
            0,
          );
          newPlayers[p.id] = { ...p, score };
          playerScores[p.id] = score;
        }
        return {
          players: newPlayers,
          turnOrder: newTurnOrder,
          gameMasterId:
            context.gameMasterId === affectedPlayerId && winnerId
              ? winnerId
              : context.gameMasterId,
          gameStage: GameStage.GAMEOVER,
          winnerId,
          gameover: {
            winnerIds: winnerId ? [winnerId] : [],
            loserId: affectedPlayerId,
            playerScores,
          },
          log: newLog,
          errorState: null,
        };
      }

      return {
        players: newPlayers,
        turnOrder: newTurnOrder,
        currentPlayerId: newCurrentPlayerId,
        // A forfeited game master must not keep the seat: START/PLAY_AGAIN/
        // REMOVE are gameMaster-gated and would be permanently unavailable.
        gameMasterId:
          context.gameMasterId === affectedPlayerId
            ? (newTurnOrder[0] ?? context.gameMasterId)
            : context.gameMasterId,
        checkDetails: context.checkDetails
          ? {
              ...context.checkDetails,
              finalTurnOrder: context.checkDetails.finalTurnOrder.filter(
                (id) => id !== affectedPlayerId,
              ),
            }
          : null,
        log: newLog,
        errorState: null,
      };
    }),
    fizzleTopAbility: assign({
      abilityStack: ({ context }) => context.abilityStack.slice(0, -1),
      publicPeek: null,
      log: ({ context }) => {
        const fizzledAbility = context.abilityStack.at(-1);
        if (!fizzledAbility) return context.log;
        const message = `${getPlayerNameForLog(fizzledAbility.playerId, context.players)}'s ability fizzled.`;
        return [
          ...context.log,
          createLogEntry(context.gameId, {
            message,
            type: "public",
            tags: ["game-event", "ability"],
          }),
        ];
      },
    }),
    emitPeekResults,
    // Privately sends each player their own bottom-two cards for the initial
    // peek. Used both when everyone readies up and on the ready-stall timeout.
    sendInitialPeekInfo: enqueueActions(({ context, enqueue }) => {
      context.turnOrder.forEach((playerId: PlayerId) => {
        const playerHand = context.players[playerId]!.hand;
        // The initial-peek hand is always dense (freshly dealt, no gaps); the
        // filter only satisfies the Card[] wire type.
        const peekableCards: Card[] = playerHand.slice(-2).filter(
          (c: Card | null): c is Card => c !== null,
        );
        enqueue(
          emit({
            type: "SEND_EVENT_TO_PLAYER",
            payload: {
              playerId,
              eventName: SocketEventName.INITIAL_PEEK_INFO,
              eventData: { hand: peekableCards },
            },
          }) as any,
        );
      });
    }) as any,
    schedulePeekToSwap: enqueueActions(({ context, event, enqueue }) => {
      if (event.type !== PlayerActionType.USE_ABILITY) return;
      const ability = context.abilityStack.at(-1);
      if (!ability) return;
      if (
        ability.stage === "peeking" &&
        (!("remainingPeeks" in ability) || ability.remainingPeeks === undefined)
      ) {
        // Correlate the timer with the ability it was scheduled for, so a
        // late timer can't advance a *different* ability that reached the
        // top of the stack in the meantime.
        const timerEvent: GameEvent = {
          type: "TIMER.PEEK_TO_SWAP",
          sourceCardId: ability.sourceCard.id,
        };
        enqueue.raise(timerEvent as any, {
          delay: ABILITY_PEEK_VIEW_DURATION_MS,
        });
      }
    }) as any,
    transitionToSwapStage: assign(({ context, event }) => {
      assertEvent(event, "TIMER.PEEK_TO_SWAP");
      const currentAbility = context.abilityStack.at(-1);
      if (
        !currentAbility ||
        currentAbility.stage !== "peeking" ||
        currentAbility.sourceCard.id !== event.sourceCardId
      ) {
        return {};
      }
      return {
        abilityStack: produce(context.abilityStack, (draft) => {
          draft.at(-1)!.stage = "swapping";
        }),
        // The peek display window ends with the peeking stage.
        publicPeek: null,
      };
    }),
    log_ENTER_WAITING: () =>
      logger.info(
        { machine: "game", state: "WAITING_FOR_PLAYERS" },
        "Entered WAITING_FOR_PLAYERS state",
      ),
    log_ENTER_DEALING: () =>
      logger.info(
        { machine: "game", state: "DEALING" },
        "Entered DEALING state",
      ),
    log_ENTER_INITIAL_PEEK: () =>
      logger.info(
        { machine: "game", state: "INITIAL_PEEK" },
        "Entered INITIAL_PEEK state",
      ),
    log_ENTER_PLAYING: () =>
      logger.info(
        { machine: "game", state: "PLAYING" },
        "Entered PLAYING state",
      ),
    log_ENTER_FINAL_TURNS: () =>
      logger.info(
        { machine: "game", state: "FINAL_TURNS" },
        "Entered FINAL_TURNS state",
      ),
    log_ENTER_SCORING: () =>
      logger.info(
        { machine: "game", state: "SCORING" },
        "Entered SCORING state",
      ),
    log_ENTER_GAMEOVER: () =>
      logger.info(
        { machine: "game", state: "GAMEOVER" },
        "Entered GAMEOVER state",
      ),
    log_ENTER_ERROR: () =>
      logger.info({ machine: "game", state: "error" }, "Entered ERROR state"),
    log_ENTER_TURN_DRAW: () =>
      logger.info({ machine: "game", substate: "DRAW" }, "Turn phase: DRAW"),
    log_ENTER_TURN_DISCARD: () =>
      logger.info(
        { machine: "game", substate: "DISCARD" },
        "Turn phase: DISCARD",
      ),
    log_ENTER_TURN_MATCHING: () =>
      logger.info(
        { machine: "game", substate: "MATCHING" },
        "Turn phase: MATCHING",
      ),
    log_ENTER_TURN_ABILITY: () =>
      logger.info(
        { machine: "game", substate: "ABILITY" },
        "Turn phase: ABILITY",
      ),
  },
  delays: {
    // Time left until the current turn deadline. Every decision window
    // (DRAW, DISCARD, each ability, INITIAL_PEEK) assigns its own fresh
    // turnDeadline in its entry actions, which run before this delay is
    // scheduled — acting resets the clock (inactivity model). Clamped so an
    // already-expired deadline still auto-resolves (after 1s) rather than
    // firing at 0/negative, and can never exceed a full window.
    turnTimer: ({ context }) => {
      if (!context.turnDeadline) return TURN_TIMER_MS;
      return Math.min(
        Math.max(context.turnDeadline - Date.now(), 1000),
        TURN_TIMER_MS,
      );
    },
  },
  actors: {
    peekTimer: fromPromise(
      () =>
        new Promise((resolve) => setTimeout(resolve, PEEK_TOTAL_DURATION_MS)),
    ),
    matchingTimerActor: fromPromise(
      () =>
        new Promise((resolve) =>
          setTimeout(resolve, MATCHING_STAGE_DURATION_MS),
        ),
    ),
    reconnectTimer: fromPromise(
      () => new Promise((resolve) => setTimeout(resolve, RECONNECT_TIMEOUT_MS)),
    ),
  },
}).createMachine({
  id: "game",
  context: ({ input }) => ({
    gameId: input.gameId,
    maxPlayers: input.maxPlayers ?? MAX_PLAYERS,
    cardsPerPlayer: input.cardsPerPlayer ?? CARDS_PER_PLAYER,
    deck: [],
    players: {},
    discardPile: [],
    turnOrder: [],
    gameMasterId: null,
    currentPlayerId: null,
    currentTurnSegment: null,
    gameStage: GameStage.WAITING_FOR_PLAYERS,
    matchingOpportunity: null,
    abilityStack: [],
    checkDetails: null,
    winnerId: null,
    gameover: null,
    lastRoundLoserId: null,
    rematchVotes: [],
    log: [],
    chat: [],
    discardPileIsSealed: false,
    lockedCardIds: [],
    errorState: null,
    publicPeek: null,
    publicSwap: null,
    publicPenalty: null,
    turnDeadline: null,
    turnTimerMs: TURN_TIMER_MS,
  }),
  initial: GameStage.WAITING_FOR_PLAYERS,
  on: {
    // Reconnection never re-targets a state node: re-entering a stage would
    // reset the in-flight turn (draw phase, matching timer, ability stack).
    // Marking the player connected and re-broadcasting is sufficient; the
    // error.recovering state has its own targeted handler for the player
    // whose disconnect paused the game.
    PLAYER_RECONNECTED: {
      actions: ["markPlayerAsConnected", "broadcastGameState"] as const,
    },
    [PlayerActionType.SEND_CHAT_MESSAGE]: {
      actions: enqueueActions(({ context, event, enqueue }) => {
        assertEvent(event, PlayerActionType.SEND_CHAT_MESSAGE);
        const chatMessage: ChatMessage = {
          id: `chat_${Date.now()}_${logEntrySeq++}`,
          timestamp: new Date().toISOString(),
          ...event.payload,
        };
        enqueue.assign({ chat: [...context.chat, chatMessage] });
        enqueue(
          emit({
            type: "BROADCAST_CHAT_MESSAGE",
            chatMessage,
          }) as any,
        );
      }),
    },
  },
  states: {
    [GameStage.WAITING_FOR_PLAYERS]: {
      entry: "log_ENTER_WAITING",
      on: {
        PLAYER_JOIN_REQUEST: {
          guard: "canJoinGame",
          actions: ["addPlayer", "broadcastGameState"] as const,
        },
        [PlayerActionType.DECLARE_LOBBY_READY]: {
          actions: ["updatePlayerLobbyReady", "broadcastGameState"] as const,
        },
        // Ready is reversible while the game hasn't started (this handler is
        // scoped to WAITING_FOR_PLAYERS, so it can't fire mid-game).
        [PlayerActionType.DECLARE_LOBBY_UNREADY]: {
          actions: ["updatePlayerLobbyUnready", "broadcastGameState"] as const,
        },
        [PlayerActionType.START_GAME]: {
          target: GameStage.DEALING,
          guard: and(["isGameMaster", "areAllPlayersReady"]),
        },
        [PlayerActionType.REMOVE_PLAYER]: {
          guard: "isGameMaster",
          actions: ["removePlayer", "broadcastGameState"] as const,
        },
        [PlayerActionType.LEAVE_GAME]: {
          actions: ["removePlayerAndHandleGM", "broadcastGameState"],
        },
        PLAYER_DISCONNECTED: {
          actions: [
            "setPlayerDisconnected",
            "addPlayerDisconnectedLog",
            "broadcastGameState",
            raise(
              ({ event }) => ({
                type: "LOBBY_DISCONNECT_TIMEOUT" as const,
                playerId: event.playerId,
              }),
              { delay: LOBBY_DISCONNECT_TIMEOUT_MS },
            ),
          ],
        },
        LOBBY_DISCONNECT_TIMEOUT: {
          guard: ({ context, event }) => {
            const player = context.players[event.playerId];
            return !!player && !player.isConnected;
          },
          actions: ["removePlayerAndHandleGM", "broadcastGameState"] as const,
        },
      },
    },
    [GameStage.DEALING]: {
      entry: ["log_ENTER_DEALING", "dealCards", "broadcastGameState"] as const,
      after: { 100: GameStage.INITIAL_PEEK },
      on: {
        [PlayerActionType.LEAVE_GAME]: {
          actions: [
            "setPlayerDisconnected",
            "addPlayerDisconnectedLog",
            "broadcastGameState",
          ] as const,
        },
        PLAYER_DISCONNECTED: {
          actions: [
            "setPlayerDisconnected",
            "addPlayerDisconnectedLog",
            "broadcastGameState",
          ] as const,
        },
      },
    },
    [GameStage.INITIAL_PEEK]: {
      entry: [
        "log_ENTER_INITIAL_PEEK",
        assign(() => ({
          gameStage: GameStage.INITIAL_PEEK,
          turnDeadline: Date.now() + TURN_TIMER_MS,
        })),
        "broadcastGameState",
      ],
      initial: "waitingForReady",
      on: {
        [PlayerActionType.LEAVE_GAME]: {
          actions: [
            "setPlayerDisconnected",
            "addPlayerDisconnectedLog",
            "broadcastGameState",
          ] as const,
        },
        PLAYER_DISCONNECTED: {
          actions: [
            "setPlayerDisconnected",
            "addPlayerDisconnectedLog",
            "broadcastGameState",
          ] as const,
        },
      },
      states: {
        waitingForReady: {
          on: {
            [PlayerActionType.DECLARE_READY_FOR_PEEK]: {
              actions: ["updatePlayerPeekReady", "broadcastGameState"],
            },
          },
          always: {
            target: "peeking",
            guard: "allPlayersReadyForPeek",
            actions: "sendInitialPeekInfo",
          },
          // A connected player who never presses Ready can't hold the game
          // hostage: the peek phase is forced forward after the turn timer.
          after: {
            turnTimer: {
              target: "peeking",
              actions: "sendInitialPeekInfo",
            },
          },
        },
        peeking: {
          entry: [
            assign({ turnDeadline: null }),
            "broadcastGameState",
          ] as const,
          invoke: {
            src: "peekTimer",
            onDone: {
              target: `#game.${GameStage.PLAYING}`,
              actions: "setInitialPlayer",
            },
          },
        },
      },
    },
    [GameStage.PLAYING]: {
      entry: "log_ENTER_PLAYING",
      initial: "turn",
      on: {
        [PlayerActionType.LEAVE_GAME]: [
          {
            target: "#game.error",
            guard: "isCurrentPlayer" as const,
            actions: [
              "setPlayerDisconnected",
              "addPlayerDisconnectedLog",
              {
                type: "enterErrorState",
                params: ({ event }: { event: GameEvent }) => ({
                  errorType: "NETWORK_ERROR" as const,
                  playerId: (event as { playerId: PlayerId }).playerId,
                }),
              },
              // Tell the other clients the game is paused (disconnect flag,
              // log entry, cleared turn deadline).
              "broadcastGameState",
            ],
          },
          {
            actions: [
              "setPlayerDisconnected",
              "addPlayerDisconnectedLog",
              "broadcastGameState",
            ] as const,
          },
        ],
        PLAYER_DISCONNECTED: [
          {
            target: "#game.error",
            guard: "isCurrentPlayer" as const,
            actions: [
              "setPlayerDisconnected",
              "addPlayerDisconnectedLog",
              {
                type: "enterErrorState",
                params: ({ event }: { event: GameEvent }) => ({
                  errorType: "NETWORK_ERROR" as const,
                  playerId: (event as { playerId: PlayerId }).playerId,
                }),
              },
              // Tell the other clients the game is paused (disconnect flag,
              // log entry, cleared turn deadline).
              "broadcastGameState",
            ],
          },
          {
            actions: [
              "setPlayerDisconnected",
              "addPlayerDisconnectedLog",
              "broadcastGameState",
            ] as const,
          },
        ],
        [PlayerActionType.CALL_CHECK]: {
          target: GameStage.FINAL_TURNS,
          guard: and(["isPlayerTurn", "canCallCheck"]),
          actions: ["setupCheck", "broadcastGameState"] as const,
        },
      },
      states: {
        turn: createTurnStateNode([
          {
            // Disqualifications can leave fewer than two active players with
            // no Check in progress; the round ends immediately (the survivor
            // is the only player still eligible to win).
            guard: ({ context }: { context: GameContext }) =>
              !context.checkDetails &&
              context.turnOrder.filter(
                (id) => !context.players[id]!.isLocked,
              ).length < 2,
            target: `#game.${GameStage.SCORING}`,
          },
          {
            // A match that emptied a hand auto-calls Check; route into the
            // final-turns phase instead of looping the normal turn cycle.
            guard: ({ context }: { context: GameContext }) =>
              !!context.checkDetails,
            target: `#${GameStage.FINAL_TURNS}`,
          },
          {
            target: "turn",
            actions: ["setNextPlayer"] as const,
          },
        ]) as any,
      },
    },
    [GameStage.FINAL_TURNS]: {
      id: GameStage.FINAL_TURNS,
      entry: [
        "log_ENTER_FINAL_TURNS",
        "setCurrentPlayerInFinalTurns",
        "broadcastGameState",
      ] as const,
      always: { target: GameStage.SCORING, guard: "isCheckRoundOver" as const },
      on: {
        [PlayerActionType.LEAVE_GAME]: [
          {
            target: "#game.error",
            guard: "isCurrentPlayer" as const,
            actions: [
              "setPlayerDisconnected",
              "addPlayerDisconnectedLog",
              {
                type: "enterErrorState",
                params: ({ event }: { event: GameEvent }) => ({
                  errorType: "NETWORK_ERROR" as const,
                  playerId: (event as { playerId: PlayerId }).playerId,
                }),
              },
              // Tell the other clients the game is paused (disconnect flag,
              // log entry, cleared turn deadline).
              "broadcastGameState",
            ],
          },
          {
            actions: [
              "setPlayerDisconnected",
              "addPlayerDisconnectedLog",
              "broadcastGameState",
            ] as const,
          },
        ],
        PLAYER_DISCONNECTED: [
          {
            target: "#game.error",
            guard: "isCurrentPlayer" as const,
            actions: [
              "setPlayerDisconnected",
              "addPlayerDisconnectedLog",
              {
                type: "enterErrorState",
                params: ({ event }: { event: GameEvent }) => ({
                  errorType: "NETWORK_ERROR" as const,
                  playerId: (event as { playerId: PlayerId }).playerId,
                }),
              },
              // Tell the other clients the game is paused (disconnect flag,
              // log entry, cleared turn deadline).
              "broadcastGameState",
            ],
          },
          {
            actions: [
              "setPlayerDisconnected",
              "addPlayerDisconnectedLog",
              "broadcastGameState",
            ] as const,
          },
        ],
      },
      initial: "turn",
      states: {
        turn: createTurnStateNode({
          target: "turn",
          actions: [
            "setNextPlayerInFinalTurns",
            "setCurrentPlayerInFinalTurns",
            "broadcastGameState",
          ] as const,
        }) as any,
      },
    },
    [GameStage.SCORING]: {
      entry: [
        "log_ENTER_SCORING",
        "calculateScores",
        "broadcastGameState",
      ] as const,
      after: { 5000: GameStage.GAMEOVER },
    },
    [GameStage.GAMEOVER]: {
      entry: [
        "log_ENTER_GAMEOVER",
        assign({ gameStage: GameStage.GAMEOVER }),
        "broadcastGameState",
      ] as const,
      on: {
        [PlayerActionType.PLAY_AGAIN]: {
          target: GameStage.DEALING,
          guard: "isGameMaster",
          actions: "resetForNewRound",
        },
        [PlayerActionType.REQUEST_PLAY_AGAIN]: {
          actions: ["toggleRematchVote", "broadcastGameState"] as const,
        },
        [PlayerActionType.LEAVE_GAME]: {
          actions: [
            "setPlayerDisconnected",
            "addPlayerDisconnectedLog",
            "broadcastGameState",
          ] as const,
        },
        PLAYER_DISCONNECTED: {
          actions: [
            "setPlayerDisconnected",
            "addPlayerDisconnectedLog",
            "broadcastGameState",
          ] as const,
        },
      },
    },
    error: {
      id: "game.error",
      entry: "log_ENTER_ERROR",
      initial: "recovering",
      on: {
        // Keep tracking connection changes of the other players while paused.
        PLAYER_DISCONNECTED: {
          actions: [
            "setPlayerDisconnected",
            "addPlayerDisconnectedLog",
            "broadcastGameState",
          ] as const,
        },
        [PlayerActionType.LEAVE_GAME]: {
          actions: [
            "setPlayerDisconnected",
            "addPlayerDisconnectedLog",
            "broadcastGameState",
          ] as const,
        },
      },
      states: {
        recovering: {
          invoke: { src: "reconnectTimer", onDone: "failedRecovery" },
          on: {
            // Resume exactly where the game paused. The old target
            // (#game.history) could never work: a history node records its
            // value only when its PARENT exits, and this one's parent was
            // the machine root — which never exits — so its history was
            // always empty and the "resume" fell through to the root's
            // initial state (WAITING_FOR_PLAYERS), hard-locking the game.
            // gameStage + currentTurnSegment identify the pause point; each
            // target's entry re-arms its own deadline/timers, and matching
            // deliberately reopens a fresh window.
            PLAYER_RECONNECTED: [
              {
                guard: ({ context, event }) =>
                  context.errorState?.affectedPlayerId === event.playerId &&
                  context.gameStage === GameStage.FINAL_TURNS &&
                  context.currentTurnSegment === TurnPhase.DISCARD,
                target: "#FINAL_TURNS.turn.DISCARD",
                actions: [
                  "markPlayerAsConnected",
                  "clearErrorState",
                  "broadcastGameState",
                ] as const,
              },
              {
                guard: ({ context, event }) =>
                  context.errorState?.affectedPlayerId === event.playerId &&
                  context.gameStage === GameStage.FINAL_TURNS &&
                  context.currentTurnSegment === TurnPhase.MATCHING,
                target: "#FINAL_TURNS.turn.matching",
                actions: [
                  "markPlayerAsConnected",
                  "clearErrorState",
                  "broadcastGameState",
                ] as const,
              },
              {
                guard: ({ context, event }) =>
                  context.errorState?.affectedPlayerId === event.playerId &&
                  context.gameStage === GameStage.FINAL_TURNS &&
                  context.currentTurnSegment === TurnPhase.ABILITY,
                target: "#FINAL_TURNS.turn.ability",
                actions: [
                  "markPlayerAsConnected",
                  "clearErrorState",
                  "broadcastGameState",
                ] as const,
              },
              {
                guard: ({ context, event }) =>
                  context.errorState?.affectedPlayerId === event.playerId &&
                  context.gameStage === GameStage.FINAL_TURNS,
                target: `#${GameStage.FINAL_TURNS}`,
                actions: [
                  "markPlayerAsConnected",
                  "clearErrorState",
                  "broadcastGameState",
                ] as const,
              },
              {
                guard: ({ context, event }) =>
                  context.errorState?.affectedPlayerId === event.playerId &&
                  context.currentTurnSegment === TurnPhase.DISCARD,
                target: "#game.PLAYING.turn.DISCARD",
                actions: [
                  "markPlayerAsConnected",
                  "clearErrorState",
                  "broadcastGameState",
                ] as const,
              },
              {
                guard: ({ context, event }) =>
                  context.errorState?.affectedPlayerId === event.playerId &&
                  context.currentTurnSegment === TurnPhase.MATCHING,
                target: "#game.PLAYING.turn.matching",
                actions: [
                  "markPlayerAsConnected",
                  "clearErrorState",
                  "broadcastGameState",
                ] as const,
              },
              {
                guard: ({ context, event }) =>
                  context.errorState?.affectedPlayerId === event.playerId &&
                  context.currentTurnSegment === TurnPhase.ABILITY,
                target: "#game.PLAYING.turn.ability",
                actions: [
                  "markPlayerAsConnected",
                  "clearErrorState",
                  "broadcastGameState",
                ] as const,
              },
              {
                // DRAW pause (or anything unexpected): a fresh turn entry for
                // the same current player re-arms the draw window.
                guard: ({ context, event }) =>
                  context.errorState?.affectedPlayerId === event.playerId,
                target: `#game.${GameStage.PLAYING}`,
                actions: [
                  "markPlayerAsConnected",
                  "clearErrorState",
                  "broadcastGameState",
                ] as const,
              },
            ],
          },
        },
        failedRecovery: {
          entry: ["handleFailedRecovery", "broadcastGameState"] as const,
          always: [
            {
              guard: ({ context }) => !!context.gameover,
              target: `#game.${GameStage.GAMEOVER}`,
            },
            {
              guard: ({ context }) => !!context.checkDetails,
              target: `#${GameStage.FINAL_TURNS}`,
            },
            { target: `#game.${GameStage.PLAYING}` },
          ],
        },
      },
    },
  },
});

export type { GameContext, ServerPlayer } from "./types.js";
