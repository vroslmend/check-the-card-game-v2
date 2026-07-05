import {
  setup,
  assign,
  emit,
  assertEvent,
  type ActorRefFrom,
  type SnapshotFrom,
  type StateFrom,
  raise,
  enqueueActions,
} from "xstate";
import {
  PlayerActionType,
  SocketEventName,
  GameStage,
  type ClientAbilityContext,
  type PlayerId,
  type GameId,
  type ClientCheckGameState,
  type CreateGameResponse,
  type JoinGameResponse,
  type AttemptRejoinResponse,
  type ChatMessage,
  type RichGameLogMessage,
  type Card,
  type AbilityActionPayload,
  type PeekTarget,
  type SwapTarget,
  type AbilityType,
  TurnPhase,
} from "shared-types";
import { toast } from "sonner";
import logger from "@/lib/logger";
import { createGameActor, joinGameActor, rejoinActor } from "@/lib/actors";

const PEEK_ABILITY_DURATION_MS = 5000;
const INITIAL_PEEK_DURATION_MS = 10000;

type ServerToClientEvents =
  | { type: "CLIENT_GAME_STATE_UPDATED"; gameState: ClientCheckGameState }
  | { type: "NEW_GAME_LOG"; logMessage: RichGameLogMessage }
  | { type: "NEW_CHAT_MESSAGE"; chatMessage: ChatMessage }
  | { type: "INITIAL_PEEK_INFO"; hand: Card[] }
  | {
      type: "ABILITY_PEEK_RESULT";
      card: Card;
      playerId: PlayerId;
      cardIndex: number;
    }
  | { type: "ERROR_RECEIVED"; error: string }
  | { type: "INITIAL_LOGS_RECEIVED"; logs: RichGameLogMessage[] };

type SocketEmitEvent = {
  eventName: SocketEventName.PLAYER_ACTION;
  payload: { type: PlayerActionType | string; payload?: any };
};

type EmittedEventToSocket = { type: "EMIT_TO_SOCKET" } & SocketEmitEvent;

export type UIMachineInput = {
  gameId?: string;
  localPlayerId?: string;
};

export type PeekedCardInfo = {
  playerId: PlayerId | null;
  cardIndex: number;
  card: Card;
  expireAt?: number;
  source: "ability" | "initial-peek";
};

export interface UIMachineContext {
  gameId?: string;
  currentGameState?: ClientCheckGameState;
  localPlayerId?: string;
  currentAbilityContext?: ClientAbilityContext;
  visibleCards: PeekedCardInfo[];
  isSidePanelOpen: boolean;
  reconnectionAttempts: number;
  hasPassedMatch: boolean;
  modal: { type: "rejoin" | "error"; title: string; message: string } | null;
}

export type UIMachineEvents =
  | ServerToClientEvents
  | {
      type: "_SESSION_ESTABLISHED";
      response: CreateGameResponse | JoinGameResponse;
    }
  | { type: "CREATE_GAME_REQUESTED"; playerName: string }
  | { type: "JOIN_GAME_REQUESTED"; playerName: string; gameId: string }
  | { type: "LEAVE_GAME" }
  | { type: "SUBMIT_CHAT_MESSAGE"; message: string }
  | {
      type: "PLAYER_SLOT_CLICKED_FOR_ABILITY";
      playerId: PlayerId;
      cardIndex: number;
    }
  | { type: "CONFIRM_ABILITY_ACTION" }
  | { type: "SKIP_ABILITY_STAGE" }
  | { type: "TOGGLE_SIDE_PANEL" }
  | { type: "CLEANUP_EXPIRED_CARDS" }
  | { type: "DISMISS_MODAL" }
  | { type: "CONNECT"; recovered?: boolean }
  | { type: "RETRY_REJOIN" }
  | { type: "DISCONNECT" }
  | { type: PlayerActionType.START_GAME }
  | { type: PlayerActionType.DECLARE_LOBBY_READY }
  | {
      type: PlayerActionType.REMOVE_PLAYER;
      payload: { playerIdToRemove: string };
    }
  | { type: PlayerActionType.DRAW_FROM_DECK }
  | { type: PlayerActionType.DRAW_FROM_DISCARD }
  | {
      type: PlayerActionType.SWAP_AND_DISCARD;
      payload: { handCardIndex: number };
    }
  | { type: PlayerActionType.DISCARD_DRAWN_CARD }
  | { type: PlayerActionType.ATTEMPT_MATCH; payload: { handCardIndex: number } }
  | { type: PlayerActionType.PASS_ON_MATCH_ATTEMPT }
  | { type: PlayerActionType.CALL_CHECK }
  | { type: PlayerActionType.DECLARE_READY_FOR_PEEK }
  | { type: PlayerActionType.PLAY_AGAIN };

export const uiMachine = setup({
  types: {
    context: {} as UIMachineContext,
    events: {} as UIMachineEvents,
    emitted: {} as EmittedEventToSocket | { type: "NAVIGATE"; path: string },
    input: {} as UIMachineInput,
  },
  actors: {
    createGame: createGameActor,
    joinGame: joinGameActor,
    rejoinAndPoll: rejoinActor,
  },
  actions: {
    setCurrentGameState: assign({
      currentGameState: ({ event }) => {
        assertEvent(event, [
          "CLIENT_GAME_STATE_UPDATED",
          "_SESSION_ESTABLISHED",
        ]);
        if (event.type === "CLIENT_GAME_STATE_UPDATED") return event.gameState;
        if (
          event.type === "_SESSION_ESTABLISHED" &&
          "gameState" in event.response
        )
          return event.response.gameState;
        return undefined;
      },
      // "Pass" is final per matching opportunity, so only reset the flag when
      // the incoming state carries a different (or no) matching opportunity.
      hasPassedMatch: ({ context, event }) => {
        const nextState =
          event.type === "CLIENT_GAME_STATE_UPDATED"
            ? event.gameState
            : event.type === "_SESSION_ESTABLISHED" &&
                "gameState" in event.response
              ? event.response.gameState
              : undefined;
        const prev = context.currentGameState?.matchingOpportunity;
        const next = nextState?.matchingOpportunity;
        if (!next) return false;
        const sameOpportunity =
          !!prev &&
          prev.startTimestamp === next.startTimestamp &&
          prev.cardToMatch.id === next.cardToMatch.id;
        return sameOpportunity ? context.hasPassedMatch : false;
      },
      localPlayerId: ({ context, event }) => {
        if (context.localPlayerId) return context.localPlayerId;
        if (event.type === "CLIENT_GAME_STATE_UPDATED") {
          return event.gameState.viewingPlayerId;
        }
        if (
          event.type === "_SESSION_ESTABLISHED" &&
          "playerId" in event.response
        ) {
          return event.response.playerId;
        }
        return undefined;
      },
      gameId: ({ context, event }) => {
        if (context.gameId) return context.gameId;
        if (event.type === "CLIENT_GAME_STATE_UPDATED") {
          return event.gameState.gameId;
        }
        if (
          event.type === "_SESSION_ESTABLISHED" &&
          "gameId" in event.response
        ) {
          return event.response.gameId;
        }
        return undefined;
      },
    }),
    addGameLog: assign({
      currentGameState: ({ context, event }) => {
        assertEvent(event, "NEW_GAME_LOG");
        if (!context.currentGameState) return undefined;
        return {
          ...context.currentGameState,
          log: [...context.currentGameState.log, event.logMessage],
        };
      },
    }),
    addChatMessage: assign({
      currentGameState: ({ context, event }) => {
        assertEvent(event, "NEW_CHAT_MESSAGE");
        if (!context.currentGameState) return undefined;
        return {
          ...context.currentGameState,
          chat: [...context.currentGameState.chat, event.chatMessage],
        };
      },
    }),
    setInitialLogs: assign({
      currentGameState: ({ context, event }) => {
        assertEvent(event, "INITIAL_LOGS_RECEIVED");
        if (!context.currentGameState) return undefined;
        return { ...context.currentGameState, log: event.logs };
      },
    }),
    setGameIdAndPlayerId: assign({
      gameId: ({ event }) => {
        assertEvent(event, "_SESSION_ESTABLISHED");
        return event.response.gameId!;
      },
      localPlayerId: ({ event }) => {
        assertEvent(event, "_SESSION_ESTABLISHED");
        return event.response.playerId!;
      },
    }),
    resetGameContext: assign({
      localPlayerId: undefined,
      gameId: undefined,
      currentGameState: undefined,
      currentAbilityContext: undefined,
      visibleCards: [],
      reconnectionAttempts: 0,
    }),
    persistSession: ({ event }) => {
      assertEvent(event, "_SESSION_ESTABLISHED");
      if (
        !event.response.success ||
        !event.response.gameId ||
        !event.response.playerId
      )
        return;
      if (typeof window !== "undefined") {
        const sessionData = {
          gameId: event.response.gameId,
          playerId: event.response.playerId,
        };
        const sessionJSON = JSON.stringify(sessionData);
    localStorage.setItem("playerSession", sessionJSON);
    sessionStorage.setItem("playerSession", sessionJSON); // store in sessionStorage too
      }
    },
    clearSession: () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem("playerSession");
        sessionStorage.removeItem("playerSession");
      }
    },
    emitChatMessage: emit(({ event }) => {
      assertEvent(event, "SUBMIT_CHAT_MESSAGE");
      // Sender identity is derived server-side from the socket session.
      return {
        type: "EMIT_TO_SOCKET",
        eventName: SocketEventName.PLAYER_ACTION,
        payload: {
          type: PlayerActionType.SEND_CHAT_MESSAGE,
          payload: { message: event.message },
        },
      } as const;
    }),
    emitPlayerAction: emit(({ event }) => {
      const { type, ...rest } = event as any;
      return {
        type: "EMIT_TO_SOCKET",
        eventName: SocketEventName.PLAYER_ACTION,
        payload: { type, ...rest },
      } as const;
    }),
    emitConfirmAbility: emit(({ context }) => {
      const ability = context.currentAbilityContext;
      if (!ability) throw new Error("Ability context missing");
      const playerId = context.localPlayerId;
      if (!playerId) throw new Error("Local player ID missing");

      let payload: AbilityActionPayload;
      if (ability.stage === "peeking") {
        payload = { action: "peek", targets: ability.selectedPeekTargets };
      } else {
        payload = {
          action: "swap",
          source: ability.selectedSwapTargets[0]!,
          target: ability.selectedSwapTargets[1]!,
          sourceCard: ability.sourceCard,
        };
      }
      return {
        type: "EMIT_TO_SOCKET",
        eventName: SocketEventName.PLAYER_ACTION,
        payload: { type: PlayerActionType.USE_ABILITY, playerId, payload },
      } as const;
    }),
    emitLeaveGame: emit(() => ({
      type: "EMIT_TO_SOCKET" as const,
      eventName: SocketEventName.PLAYER_ACTION as const,
      payload: { type: PlayerActionType.LEAVE_GAME },
    })),
    emitSkipAbilityStage: emit(({ context }) => {
      const playerId = context.localPlayerId;
      if (!playerId) throw new Error("Local player ID missing");
      logger.debug(
        { action: "skip", playerId },
        "Emitting skip ability action",
      );
      return {
        type: "EMIT_TO_SOCKET",
        eventName: SocketEventName.PLAYER_ACTION,
        payload: {
          type: PlayerActionType.USE_ABILITY,
          playerId,
          payload: { action: "skip" },
        },
      } as const;
    }),
    showErrorToast: ({ event }) => {
      assertEvent(event, "ERROR_RECEIVED");
      toast.error(event.error);
    },
    toggleSidePanel: assign({
      isSidePanelOpen: ({ context }) => !context.isSidePanelOpen,
    }),
    addPeekedCardToContext: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, "ABILITY_PEEK_RESULT");
      const newCard: PeekedCardInfo = {
        playerId: event.playerId,
        cardIndex: event.cardIndex,
        card: event.card,
        source: "ability",
        expireAt: Date.now() + PEEK_ABILITY_DURATION_MS,
      };
      enqueue.assign({
        visibleCards: [
          ...context.visibleCards.filter(
            (c) =>
              !(
                c.playerId === event.playerId && c.cardIndex === event.cardIndex
              ),
          ),
          newCard,
        ],
      });
      enqueue.raise(
        { type: "CLEANUP_EXPIRED_CARDS" },
        { delay: PEEK_ABILITY_DURATION_MS + 250 },
      );
    }),
    setInitialPeekCards: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, "INITIAL_PEEK_INFO");
      const localPlayerId = context.localPlayerId;
      if (!localPlayerId || event.hand.length === 0) {
        enqueue.assign({ visibleCards: [] });
        return;
      }
      const handSize =
        context.currentGameState?.players[localPlayerId]?.hand.length ?? 0;
      const peekDuration = INITIAL_PEEK_DURATION_MS;
      enqueue.assign({
        visibleCards: event.hand.map((card, idx) => {
          const calculatedIndex = handSize
            ? handSize - event.hand.length + idx
            : idx;
          return {
            playerId: localPlayerId,
            cardIndex: calculatedIndex,
            card,
            source: "initial-peek" as const,
            expireAt: Date.now() + peekDuration,
          };
        }),
      });
      enqueue.raise(
        { type: "CLEANUP_EXPIRED_CARDS" },
        { delay: peekDuration + 250 },
      );
    }),
    syncAbilityContext: assign({
      currentAbilityContext: ({ context }) => {
        const serverAbilityStack = context.currentGameState?.abilityStack ?? [];
        if (
          serverAbilityStack.length === 0 ||
          serverAbilityStack.at(-1)!.playerId !== context.localPlayerId
        )
          return undefined;
        const topServerAbility = serverAbilityStack.at(-1)!;
        const currentClientAbility = context.currentAbilityContext;
        if (
          !currentClientAbility ||
          // Compare by source card so back-to-back abilities of the same type
          // (e.g. a matched King pair owned by the same player) don't reuse
          // the previous ability's selections.
          currentClientAbility.sourceCard.id !==
            topServerAbility.sourceCard.id ||
          currentClientAbility.stage !== topServerAbility.stage
        ) {
          const { type, stage, playerId, sourceCard } = topServerAbility;
          let maxPeekTargets = 0;
          let maxSwapTargets = 0;

          switch (type) {
            case "king":
              maxPeekTargets = 2;
              maxSwapTargets = 2;
              break;
            case "peek":
              maxPeekTargets = 1;
              maxSwapTargets = 2;
              break;
            case "swap":
              maxSwapTargets = 2;
              break;
          }

          return {
            type,
            stage,
            playerId,
            sourceCard,
            maxPeekTargets,
            maxSwapTargets,
            selectedPeekTargets: [],
            selectedSwapTargets: [],
            peekedCards: [],
          };
        }
        return currentClientAbility;
      },
    }),
    setAbilityPeekTarget: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, "PLAYER_SLOT_CLICKED_FOR_ABILITY");
      const ability = context.currentAbilityContext;

      if (!ability || ability.stage !== "peeking") {
        return;
      }

      const { playerId, cardIndex } = event;
      const { maxPeekTargets, selectedPeekTargets } = ability;
      const newTarget = { playerId, cardIndex };
      const isAlreadySelected = selectedPeekTargets.some(
        (t) => t.playerId === playerId && t.cardIndex === cardIndex,
      );

      let newSelectedTargets: PeekTarget[];
      if (isAlreadySelected) {
        newSelectedTargets = selectedPeekTargets.filter(
          (t) => !(t.playerId === playerId && t.cardIndex === cardIndex),
        );
      } else {
        newSelectedTargets = [...selectedPeekTargets, newTarget].slice(
          -maxPeekTargets,
        );
      }

      enqueue.assign({
        currentAbilityContext: {
          ...ability,
          selectedPeekTargets: newSelectedTargets,
        },
      });
    }),
    setAbilitySwapTarget: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, "PLAYER_SLOT_CLICKED_FOR_ABILITY");
      const ability = context.currentAbilityContext;

      if (!ability || ability.stage !== "swapping") {
        return;
      }

      const { selectedSwapTargets } = ability;
      const newTarget = {
        playerId: event.playerId,
        cardIndex: event.cardIndex,
      };
      const isAlreadySelected = selectedSwapTargets.some(
        (t) => t.playerId === event.playerId && t.cardIndex === event.cardIndex,
      );

      let newSelectedTargets: SwapTarget[];
      if (isAlreadySelected) {
        newSelectedTargets = selectedSwapTargets.filter(
          (t) =>
            !(t.playerId === event.playerId && t.cardIndex === event.cardIndex),
        );
      } else {
        newSelectedTargets = [...selectedSwapTargets, newTarget].slice(-2);
      }

      enqueue.assign({
        currentAbilityContext: {
          ...ability,
          selectedSwapTargets: newSelectedTargets,
        },
      });
    }),
    resetReconnectionAttempts: assign({ reconnectionAttempts: 0 }),
    cleanupExpiredVisibleCards: assign({
      visibleCards: ({ context }) => {
        const now = Date.now();
        const remaining = context.visibleCards.filter(
          (vc) => !vc.expireAt || vc.expireAt > now,
        );
        // Preserve reference identity when nothing expired to avoid
        // triggering re-renders for a no-op.
        return remaining.length === context.visibleCards.length
          ? context.visibleCards
          : remaining;
      },
    }),
    dismissModal: assign({ modal: null }),
    redirectToHome: () => {
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    },
    logInitializing: ({ context }) => {
      logger.info(
        {
          machine: "uiMachine",
          state: "initializing",
          context: {
            gameId: context.gameId,
            localPlayerId: context.localPlayerId,
            hasGameState: !!context.currentGameState,
          },
        },
        "Machine entered initializing state",
      );
    },
    logToOutOfGame: () =>
      logger.info(
        { machine: "uiMachine", transition: "to outOfGame" },
        "Routing to out-of-game",
      ),
    logToPromptToJoin: () =>
      logger.info(
        { machine: "uiMachine", transition: "to promptToJoin" },
        "Routing to promptToJoin",
      ),
    logToReconnecting: () =>
      logger.info(
        { machine: "uiMachine", transition: "to reconnecting" },
        "Routing to reconnecting",
      ),
    logJoiningGame: () =>
      logger.info(
        { machine: "uiMachine", event: "JOIN_GAME_REQUESTED" },
        "Invoking joinGame actor",
      ),
    logSessionEstablished: () =>
      logger.info(
        { machine: "uiMachine", event: "_SESSION_ESTABLISHED" },
        "Session established",
      ),
    log_ENTER_LOBBY: () =>
      logger.info({ machine: "ui", view: "Lobby" }, "UI state entered Lobby"),
    log_ENTER_INITIAL_PEEK: () =>
      logger.info(
        { machine: "ui", view: "Initial Peek" },
        "UI state entered Initial Peek",
      ),
    log_ENTER_GAME_BOARD: () =>
      logger.info(
        { machine: "ui", view: "Game Board" },
        "UI state entered main gameplay",
      ),
    log_ENTER_SCORING: () =>
      logger.info(
        { machine: "ui", view: "Scoring" },
        "UI state entered Scoring",
      ),
    log_ENTER_GAMEOVER: () =>
      logger.info(
        { machine: "ui", view: "Game Over" },
        "UI state entered Game Over",
      ),
    incrementReconnectionAttemptsAndScheduleRetry: enqueueActions(
      ({ context, enqueue }) => {
        const attempts = context.reconnectionAttempts + 1;
        enqueue.assign({ reconnectionAttempts: attempts });
        const delay = Math.min(1000 * 2 ** (attempts - 1), 15000);
        enqueue.raise({ type: "RETRY_REJOIN" }, { delay });
      },
    ),
  },
  guards: {
    isAbilityActionComplete: ({ context }) => {
      const ability = context.currentAbilityContext;
      if (!ability) return false;
      if (ability.stage === "peeking")
        return ability.selectedPeekTargets.length === ability.maxPeekTargets;
      if (ability.stage === "swapping")
        return ability.selectedSwapTargets.length === 2;
      return false;
    },
  },
}).createMachine({
  id: "ui",
  context: ({ input }) => ({
    localPlayerId: input.localPlayerId,
    gameId: input.gameId,
    currentGameState: undefined,
    currentAbilityContext: undefined,
    visibleCards: [],
    isSidePanelOpen: false,
    reconnectionAttempts: 0,
    hasPassedMatch: false,
    modal: null,
  }),
  initial: "initializing",
  on: {
    _SESSION_ESTABLISHED: {
      target: ".inGame",
      actions: [
        "dismissModal",
        "setGameIdAndPlayerId",
        "setCurrentGameState",
        "persistSession",
        emit(({ event }) => ({
          type: "NAVIGATE",
          path: `/game/${event.response.gameId}`,
        })),
      ],
    },
    ERROR_RECEIVED: { actions: "showErrorToast" },
  },
  states: {
    initializing: {
      entry: "logInitializing",
      always: [
        {
          target: "inGame.promptToJoin",
          guard: ({ context }) => !!context.gameId && !context.localPlayerId,
          description: "Has a game ID from URL, but no player ID from session.",
          actions: "logToPromptToJoin",
        },
        {
          target: "inGame.disconnected",
          guard: ({ context }) => !!context.localPlayerId,
          description: "Has a stored session; attempt an automatic rejoin.",
          actions: "logToReconnecting",
        },
        { target: "outOfGame", actions: "logToOutOfGame" },
      ],
    },
    outOfGame: {
      id: "outOfGame",
      initial: "idle",
      states: {
        idle: { tags: ["idle"] },
        creatingGame: {
          tags: ["loading"],
          invoke: {
            src: "createGame",
            input: ({ event }) => {
              assertEvent(event, "CREATE_GAME_REQUESTED");
              return { name: event.playerName };
            },
            onDone: {
              target: "idle",
              actions: raise(({ event }) => ({
                type: "_SESSION_ESTABLISHED",
                response: event.output,
              })),
            },
            onError: {
              target: "idle",
              actions: ({ event }) =>
                toast.error("Failed to create game", {
                  description: (event.error as Error).message,
                }),
            },
          },
        },
        joiningGame: {
          tags: ["loading"],
          invoke: {
            src: "joinGame",
            input: ({ event }) => {
              assertEvent(event, "JOIN_GAME_REQUESTED");
              return { gameId: event.gameId, name: event.playerName };
            },
            onDone: {
              target: "idle",
              actions: [
                "logSessionEstablished",
                raise(({ event }) => ({
                  type: "_SESSION_ESTABLISHED",
                  response: event.output,
                })),
              ],
            },
            onError: {
              target: "idle",
              actions: ({ event }) =>
                toast.error("Failed to join game", {
                  description: (event.error as Error).message,
                }),
            },
          },
        },
      },
      on: {
        CREATE_GAME_REQUESTED: { target: ".creatingGame" },
        JOIN_GAME_REQUESTED: { target: ".joiningGame" },
      },
    },
    inGame: {
      id: "inGame",
      initial: "routing",
      on: {
        // Creating or joining a new game while an old session is still live in
        // this tab (e.g. the user navigated back to the landing page without
        // leaving) auto-abandons the old game: tell the server we left, clear
        // the stored session, then run the normal create/join flow.
        // promptToJoin/joiningGame define their own JOIN_GAME_REQUESTED which
        // takes precedence, so the no-session join prompt is unaffected.
        CREATE_GAME_REQUESTED: {
          target: "#outOfGame.creatingGame",
          actions: ["emitLeaveGame", "resetGameContext", "clearSession"],
        },
        JOIN_GAME_REQUESTED: {
          target: "#outOfGame.joiningGame",
          actions: ["emitLeaveGame", "resetGameContext", "clearSession"],
        },
        LEAVE_GAME: { target: ".leaving" },
        TOGGLE_SIDE_PANEL: { actions: "toggleSidePanel" },
        CLIENT_GAME_STATE_UPDATED: {
          target: ".routing",
          actions: ["setCurrentGameState", "syncAbilityContext"],
        },
        INITIAL_LOGS_RECEIVED: { actions: "setInitialLogs" },
        NEW_GAME_LOG: { actions: "addGameLog" },
        NEW_CHAT_MESSAGE: { actions: "addChatMessage" },
        SUBMIT_CHAT_MESSAGE: { actions: "emitChatMessage" },
        ABILITY_PEEK_RESULT: {
          actions: "addPeekedCardToContext",
          target: ".ability.resolving.viewingPeek",
        },
        INITIAL_PEEK_INFO: {
          actions: "setInitialPeekCards",
        },
        START_GAME: { actions: "emitPlayerAction" },
        DECLARE_LOBBY_READY: { actions: "emitPlayerAction" },
        REMOVE_PLAYER: { actions: "emitPlayerAction" },
        DRAW_FROM_DECK: { actions: "emitPlayerAction" },
        DRAW_FROM_DISCARD: { actions: "emitPlayerAction" },
        SWAP_AND_DISCARD: { actions: "emitPlayerAction" },
        DISCARD_DRAWN_CARD: { actions: "emitPlayerAction" },
        ATTEMPT_MATCH: { actions: "emitPlayerAction" },
        PASS_ON_MATCH_ATTEMPT: {
          actions: ["emitPlayerAction", assign({ hasPassedMatch: true })],
        },
        CALL_CHECK: { actions: "emitPlayerAction" },
        DECLARE_READY_FOR_PEEK: { actions: "emitPlayerAction" },
        PLAY_AGAIN: { actions: "emitPlayerAction" },
        DISMISS_MODAL: { actions: "dismissModal" },
        SKIP_ABILITY_STAGE: { actions: "emitSkipAbilityStage" },
        CLEANUP_EXPIRED_CARDS: { actions: "cleanupExpiredVisibleCards" },
        DISCONNECT: { target: ".disconnected" },
      },
      states: {
        routing: {
          always: [
            {
              target: "lobby",
              guard: ({ context }) =>
                context.currentGameState?.gameStage ===
                GameStage.WAITING_FOR_PLAYERS,
            },
            {
              target: "dealing",
              guard: ({ context }) =>
                context.currentGameState?.gameStage === GameStage.DEALING,
            },
            {
              target: "initialPeek",
              guard: ({ context }) =>
                context.currentGameState?.gameStage === GameStage.INITIAL_PEEK,
            },
            {
              target: "playing",
              guard: ({ context }) =>
                context.currentGameState?.gameStage === GameStage.PLAYING,
            },
            {
              target: "finalTurns",
              guard: ({ context }) =>
                context.currentGameState?.gameStage === GameStage.FINAL_TURNS,
            },
            {
              target: "scoring",
              guard: ({ context }) =>
                context.currentGameState?.gameStage === GameStage.SCORING,
            },
            {
              target: "gameover",
              guard: ({ context }) =>
                context.currentGameState?.gameStage === GameStage.GAMEOVER,
            },
            {
              target: "#outOfGame",
              actions: () =>
                logger.warn(
                  "Routing fallback: no matching game state, returning to outOfGame.",
                ),
            },
          ],
        },
        lobby: {
          entry: "log_ENTER_LOBBY",
          tags: ["lobby", "playing"],
          on: {
            // Manual "refresh" from the lobby re-runs the rejoin handshake to
            // re-sync state with the server.
            RETRY_REJOIN: { target: "reconnecting" },
          },
        },
        initialPeek: {
          entry: ["log_ENTER_INITIAL_PEEK"],
          tags: ["peeking", "playing"],
        },
        dealing: {
          tags: ["playing"],
        },
        playing: {
          tags: ["playing"],
          entry: "log_ENTER_GAME_BOARD",
          always: [
            {
              target: "ability",
              guard: ({ context }) =>
                !!context.currentAbilityContext?.playerId &&
                context.currentGameState?.turnPhase === TurnPhase.ABILITY,
            },
          ],
        },
        finalTurns: {
          tags: ["playing"],
          always: [
            {
              target: "ability",
              guard: ({ context }) =>
                !!context.currentAbilityContext?.playerId &&
                context.currentGameState?.turnPhase === TurnPhase.ABILITY,
            },
          ],
        },
        ability: {
          tags: ["ability", "playing"],
          initial: "selecting",
          // Whatever substate we are in, leave the ability flow as soon as the
          // synced server state no longer has an ability for this player.
          always: [
            {
              target: "#inGame.routing",
              guard: ({ context }) => !context.currentAbilityContext,
            },
          ],
          on: {
            CLIENT_GAME_STATE_UPDATED: {
              actions: [
                assign({ hasPassedMatch: false }),
                "setCurrentGameState",
                "syncAbilityContext",
              ],
            },
            PLAYER_SLOT_CLICKED_FOR_ABILITY: [
              {
                actions: "setAbilityPeekTarget",
                guard: ({ context }) =>
                  context.currentAbilityContext?.stage === "peeking",
                reenter: true,
              },
              {
                actions: "setAbilitySwapTarget",
                guard: ({ context }) =>
                  context.currentAbilityContext?.stage === "swapping",
              },
            ],
            CONFIRM_ABILITY_ACTION: {
              guard: "isAbilityActionComplete",
              actions: "emitConfirmAbility",
              target: ".resolving",
            },
            SKIP_ABILITY_STAGE: {
              actions: "emitSkipAbilityStage",
            },
          },
          states: {
            selecting: {
              tags: ["ability-selecting"],
            },
            resolving: {
              initial: "waiting",
              states: {
                waiting: {},
                // The server owns the peek→swap transition (its own 5s timer
                // or an explicit skip). The client only waits here until the
                // synced ability context leaves the peeking stage.
                viewingPeek: {
                  always: {
                    guard: ({ context }) =>
                      context.currentAbilityContext?.stage !== "peeking",
                    target: "#inGame.ability.selecting",
                  },
                },
              },
            },
          },
        },
        scoring: { entry: "log_ENTER_SCORING", tags: ["scoring", "playing"] },
        gameover: {
          entry: "log_ENTER_GAMEOVER",
          tags: ["gameover", "playing"],
        },
        leaving: {
          entry: [
            "emitLeaveGame",
            "resetGameContext",
            "clearSession",
            "redirectToHome",
          ],
        },
        disconnected: {
          tags: ["recovering"],
          entry: "incrementReconnectionAttemptsAndScheduleRetry",
          on: {
            CONNECT: [
              {
                // No session to rejoin with (e.g. the join prompt) — just
                // resume routing instead of invoking a doomed rejoin.
                target: "routing",
                guard: ({ context }) => !context.localPlayerId,
                actions: "resetReconnectionAttempts",
              },
              // Always re-run the rejoin handshake — even when socket.io
              // connection-state recovery succeeded (recovered === true).
              // The server deletes the socket session on disconnect and marks
              // the player disconnected; a recovered socket that skips
              // ATTEMPT_REJOIN has no server-side session, so every action it
              // sends is silently dropped and broadcasts skip it — the exact
              // "joined back but frozen board" hardstuck. Rejoining is
              // idempotent and cheap.
              { target: "reconnecting" },
            ],
            RETRY_REJOIN: { target: "reconnecting" },
          },
        },
        reconnecting: {
          tags: ["recovering", "loading"],
          invoke: {
            src: "rejoinAndPoll",
            input: ({ context }) => ({
              gameId: context.gameId!,
              playerId: context.localPlayerId!,
            }),
            onDone: {
              target: "routing",
              actions: [
                assign({
                  currentGameState: ({ event }) => event.output.gameState,
                  reconnectionAttempts: 0,
                  hasPassedMatch: false,
                }),
                "syncAbilityContext",
                enqueueActions(({ event, enqueue }) => {
                  if (event.output.logs && event.output.logs.length > 0) {
                    enqueue.raise({
                      type: "INITIAL_LOGS_RECEIVED",
                      logs: event.output.logs,
                    });
                  }
                }),
              ],
            },
            onError: [
              {
                // The game (or this player's seat) no longer exists on the
                // server — retrying forever would loop, so clear the session.
                target: "recoveryFailed",
                guard: ({ event }) =>
                  ((event.error as Error)?.message ?? "")
                    .toLowerCase()
                    .includes("not found"),
              },
              { target: "disconnected" },
            ],
          },
        },
        recoveryFailed: { entry: ["clearSession", "redirectToHome"] },
        promptToJoin: {
          tags: ["prompting"],
          entry: assign({
            modal: {
              type: "rejoin" as const,
              title: "Join Game",
              message:
                "You have been invited to a game. Please enter your name to join.",
            },
          }),
          always: [
            {
              target: "routing",
              guard: ({ context }) => !!context.currentGameState,
            },
          ],
          on: {
            JOIN_GAME_REQUESTED: {
              target: "joiningGame",
              actions: "logJoiningGame",
            },
          },
        },
        joiningGame: {
          tags: ["loading"],
          invoke: {
            src: "joinGame",
            input: ({ event }) => {
              assertEvent(event, "JOIN_GAME_REQUESTED");
              return { gameId: event.gameId, name: event.playerName };
            },
            onDone: {
              actions: [
                "logSessionEstablished",
                raise(({ event }) => ({
                  type: "_SESSION_ESTABLISHED",
                  response: event.output,
                })),
              ],
            },
            onError: {
              target: "promptToJoin",
              actions: ({ event }) =>
                toast.error("Failed to join game", {
                  description: (event.error as Error).message,
                }),
            },
          },
        },
      },
    },
  },
});

export type UIMachineActorRef = ActorRefFrom<typeof uiMachine>;
export type UIMachineState = SnapshotFrom<typeof uiMachine>;
export type UIMachineSnapshot = StateFrom<typeof uiMachine>;
