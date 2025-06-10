import { setup, assign, emit, assertEvent, type ActorRefFrom, type SnapshotFrom, fromPromise } from 'xstate';
import {
  PlayerActionType,
  SocketEventName,
  GameStage,
  TurnPhase,
  type AbilityType,
} from 'shared-types';
import type {
  PlayerId,
  GameId,
  ClientCheckGameState,
  CreateGameResponse,
  JoinGameResponse,
  ChatMessage,
  RichGameLogMessage,
  Card,
  AbilityActionPayload,
  PeekAbilityPayload,
  SwapAbilityPayload,
} from 'shared-types';
import { toast } from 'sonner';

// #region ----- TYPE DEFINITIONS -----

type EmittedEvent = {
  type: 'EMIT_TO_SOCKET';
  eventName: SocketEventName;
  payload?: any;
  ack?: (...args: any[]) => void;
};

export type UIMachineInput = {
  gameId?: string;
  localPlayerId?: string;
  initialGameState?: ClientCheckGameState;
};

export type UIMachineContext = {
  localPlayerId: PlayerId | null;
  gameId: GameId | null;
  currentGameState: ClientCheckGameState | null;
  abilityContext: {
    type: AbilityType;
    payload: Partial<AbilityActionPayload>;
  } | null;
  peekedCard: { card: Card; playerId: PlayerId; cardIndex: number } | null;
  chatMessages: ChatMessage[];
  gameLog: RichGameLogMessage[];
  isSidePanelOpen: boolean;
  error: {
    message: string;
    details?: string;
  } | null;
};

type UIMachineEvents =
  | { type: 'CREATE_GAME_REQUESTED'; playerName: string }
  | { type: 'JOIN_GAME_REQUESTED'; playerName: string; gameId: string }
  | { type: 'GAME_CREATED_SUCCESSFULLY'; response: CreateGameResponse }
  | { type: 'GAME_JOINED_SUCCESSFULLY'; response: JoinGameResponse }
  | { type: 'CONNECT' }
  | { type: 'DISCONNECT' }
  | { type: 'CLIENT_GAME_STATE_UPDATED'; gameState: ClientCheckGameState }
  | { type: 'NEW_GAME_LOG'; logMessage: RichGameLogMessage }
  | { type: 'ABILITY_PEEK_RESULT'; card: Card; playerId: PlayerId; cardIndex: number }
  | { type: 'ERROR_RECEIVED'; error: string }
  | { type: 'INITIAL_LOGS_RECEIVED'; logs: RichGameLogMessage[] }
  | { type: 'RECONNECT' }
  | { type: 'START_GAME' }
  | { type: 'PLAYER_READY' }
  | { type: 'LEAVE_GAME' }
  | { type: 'SUBMIT_CHAT_MESSAGE'; message: string; senderId: string; senderName: string; gameId: string }
  | {
      type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY';
      playerId: PlayerId;
      cardIndex?: number;
    }
  | { type: 'CONFIRM_ABILITY_SELECTION' }
  | { type: 'CANCEL_ABILITY_SELECTION' }
  | { type: 'PLAY_CARD'; cardIndex: number }
  | { type: 'DRAW_CARD' }
  | { type: 'TOGGLE_SIDE_PANEL' }
  | { type: 'DECLARE_READY_FOR_PEEK_CLICKED' };

// #endregion

export const uiMachine = setup({
  types: {
    context: {} as UIMachineContext,
    events: {} as UIMachineEvents,
    emitted: {} as EmittedEvent,
    input: {} as UIMachineInput,
  },
  actions: {
    // #region ----- Context Updaters -----
    setCurrentGameState: assign({
      currentGameState: ({ event }) => {
        assertEvent(event, 'CLIENT_GAME_STATE_UPDATED');
        return event.gameState;
      },
    }),
    addGameLog: assign({
      gameLog: ({ context, event }) => {
        assertEvent(event, 'NEW_GAME_LOG');
        return [...context.gameLog, event.logMessage];
      },
    }),
    setInitialLogs: assign({
      gameLog: ({ event }) => {
        assertEvent(event, 'INITIAL_LOGS_RECEIVED');
        return event.logs;
      },
    }),
    addChatMessage: assign({
      chatMessages: ({ context, event }) => {
        assertEvent(event, 'SUBMIT_CHAT_MESSAGE');
        const newChatMessage: ChatMessage = {
          id: `chat_${Date.now()}`,
          message: event.message,
          senderId: event.senderId,
          senderName: event.senderName,
          timestamp: new Date().toISOString(),
        };
        return [...context.chatMessages, newChatMessage];
      },
    }),
    setGameIdAndPlayerId: assign(({ event }) => {
      assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
      return {
        gameId: event.response.gameId,
        localPlayerId: event.response.playerId,
      };
    }),
    setInitialGameState: assign(({ event }) => {
        assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
  
        if (event.type === 'GAME_JOINED_SUCCESSFULLY' && event.response.gameState) {
          return { currentGameState: event.response.gameState };
        }
  
        const { gameId, playerId } = event.response;
        const defaultGameState: ClientCheckGameState = {
          gameId: gameId!,
          viewingPlayerId: playerId!,
          gameMasterId: playerId!,
          players: {},
          deckSize: 52,
          discardPile: [],
          turnOrder: [],
          gameStage: GameStage.WAITING_FOR_PLAYERS,
          currentPlayerId: null,
          turnPhase: null,
          activeAbility: null,
          matchingOpportunity: null,
          checkDetails: null,
          gameover: null,
          lastRoundLoserId: null,
          log: [],
          chat: [],
        };
        return { currentGameState: defaultGameState };
      }),
    resetGameContext: assign({
        localPlayerId: null,
        gameId: null,
        currentGameState: null,
        abilityContext: null,
        peekedCard: null,
        chatMessages: [],
        gameLog: [],
        error: null,
    }),
    // #endregion

    // #region ----- Socket Emitters -----
    emitCreateGame: emit(({ event, self }) => {
      assertEvent(event, 'CREATE_GAME_REQUESTED');
      return {
        type: 'EMIT_TO_SOCKET',
        eventName: SocketEventName.CREATE_GAME,
        payload: { name: event.playerName },
        ack: (response: CreateGameResponse) => {
          if (response.success) {
            self.send({ type: 'GAME_CREATED_SUCCESSFULLY', response });
          } else {
            self.send({ type: 'ERROR_RECEIVED', error: response.message || 'Failed to create game.' });
          }
        },
      } as const;
    }),
    emitJoinGame: emit(({ event, self }) => {
      assertEvent(event, 'JOIN_GAME_REQUESTED');
      return {
        type: 'EMIT_TO_SOCKET',
        eventName: SocketEventName.JOIN_GAME,
        payload: {
          gameId: event.gameId,
          playerSetupData: { name: event.playerName },
        },
        ack: (response: JoinGameResponse) => {
          if (response.success) {
            self.send({ type: 'GAME_JOINED_SUCCESSFULLY', response });
          } else {
            self.send({ type: 'ERROR_RECEIVED', error: response.message || 'Failed to join game.' });
          }
        },
      } as const;
    }),
    emitRejoinGame: emit(({ context }) => ({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.ATTEMPT_REJOIN,
      payload: { gameId: context.gameId, playerId: context.localPlayerId },
    })),
    emitPlayerReady: emit(({ context }) => ({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.PLAYER_ACTION,
      payload: { type: PlayerActionType.DECLARE_LOBBY_READY, playerId: context.localPlayerId },
    })),
    emitStartGame: emit(({ context }) => ({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.PLAYER_ACTION,
      payload: { type: PlayerActionType.START_GAME, playerId: context.localPlayerId },
    })),
    emitLeaveGame: () => {
      // No-op: leaving is handled by socket disconnect on server
    },
    emitPlayCard: emit(({ event }) => {
      assertEvent(event, 'PLAY_CARD');
      return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.PLAYER_ACTION,
        payload: {
          type: PlayerActionType.SWAP_AND_DISCARD,
          payload: { handCardIndex: event.cardIndex },
        },
      };
    }),
    emitDrawCard: emit(({ context }) => ({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.PLAYER_ACTION,
      payload: { type: PlayerActionType.DRAW_FROM_DECK, playerId: context.localPlayerId },
    })),
    emitSendMessage: emit(({ event }) => {
      assertEvent(event, 'SUBMIT_CHAT_MESSAGE');
      const { type, ...payload } = event;
      return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.SEND_CHAT_MESSAGE,
        payload,
      };
    }),
    emitUseAbility: emit(({ context }) => ({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.PLAYER_ACTION,
      payload: {
        type: PlayerActionType.USE_ABILITY,
        playerId: context.localPlayerId,
        payload: context.abilityContext?.payload,
      },
    })),
    // #endregion

    // #region ----- UI Actions -----
    showErrorToast: ({ event }) => {
        assertEvent(event, 'ERROR_RECEIVED');
        toast.error(event.error);
    },
    toggleSidePanel: assign({
        isSidePanelOpen: ({ context }) => !context.isSidePanelOpen,
    }),
    setPeekedCard: assign({
        peekedCard: ({ event }) => {
          assertEvent(event, 'ABILITY_PEEK_RESULT');
          return { card: event.card, playerId: event.playerId, cardIndex: event.cardIndex };
        },
    }),
    clearPeekedCard: assign({
        peekedCard: null,
    }),
    // #endregion

    // #region ----- ABILITY CONTEXT -----
    initializeAbilityContext: assign({
      abilityContext: ({ context }) => {
        const abilityType = context.currentGameState?.activeAbility?.type;
        if (!abilityType) return null;
        
        let payload: Partial<AbilityActionPayload>;
        if(abilityType === 'peek' || abilityType === 'king'){
            payload = { action: 'peek', targets: [] };
        } else if (abilityType === 'swap') {
            payload = { action: 'swap', source: undefined, target: undefined };
        } else {
            payload = { action: 'skip' };
        }

        return { type: abilityType, payload };
      },
    }),
    updateAbilityContext: assign({
      abilityContext: ({ context, event }) => {
        assertEvent(event, 'PLAYER_SLOT_CLICKED_FOR_ABILITY');
        const { abilityContext } = context;
        if (!abilityContext) return null;

        const { playerId, cardIndex } = event;

        if ((abilityContext.type === 'peek' || abilityContext.type === 'king') && abilityContext.payload.action === 'peek') {
            const currentTargets = abilityContext.payload.targets || [];
            const maxTargets = abilityContext.type === 'king' ? 2 : 1;
            if(currentTargets.length < maxTargets) {
                const newPayload: PeekAbilityPayload = {
                    action: 'peek',
                    targets: [...currentTargets, { playerId: playerId, cardIndex: cardIndex! }]
                };
                return { ...abilityContext, payload: newPayload };
            }
        }
        
        if (abilityContext.type === 'swap' && abilityContext.payload.action === 'swap') {
            const payload = abilityContext.payload;
            if (!payload.source) { // first click is the source
                const newPayload: Partial<SwapAbilityPayload> = {
                    action: 'swap',
                    source: { playerId, cardIndex: cardIndex! }
                };
                return { ...abilityContext, payload: newPayload };
            } else { // second click is the target
                const newPayload: SwapAbilityPayload = {
                    action: 'swap',
                    source: payload.source,
                    target: { playerId, cardIndex: cardIndex! }
                };
                return { ...abilityContext, payload: newPayload };
            }
        }

        return abilityContext;
      },
    }),
    clearAbilityContext: assign({
      abilityContext: null,
    }),
    // #endregion

  },
  guards: {
    isAbilityPayloadComplete: ({ context }) => {
        if (!context.abilityContext?.payload) return false;
        const { type, payload } = context.abilityContext;

        if (payload.action === 'peek') {
            const maxTargets = type === 'king' ? 2 : 1;
            return payload.targets ? payload.targets.length === maxTargets : false;
        }
        if (payload.action === 'swap') {
            return !!payload.source && !!payload.target;
        }
        return false;
      },
  },
}).createMachine({
  id: 'ui',
  context: ({ input }) => ({
    localPlayerId: input.localPlayerId ?? null,
    gameId: input.gameId ?? null,
    currentGameState: input.initialGameState ?? null,
    abilityContext: null,
    peekedCard: null,
    chatMessages: [],
    gameLog: [],
    isSidePanelOpen: true,
    error: null,
  }),
  initial: 'outOfGame',
  on: {
    RECONNECT: '#inGame.rejoining',
    ERROR_RECEIVED: { actions: 'showErrorToast' },
  },
  states: {
    outOfGame: {
      id: 'outOfGame',
      on: {
        CREATE_GAME_REQUESTED: {
            actions: 'emitCreateGame',
        },
        JOIN_GAME_REQUESTED: {
            actions: 'emitJoinGame',
        },
        GAME_CREATED_SUCCESSFULLY: {
          target: 'inGame',
          actions: ['setGameIdAndPlayerId', 'setInitialGameState'],
        },
        GAME_JOINED_SUCCESSFULLY: {
          target: 'inGame',
          actions: ['setGameIdAndPlayerId', 'setInitialGameState'],
        },
      },
    },
    inGame: {
      id: 'inGame',
      initial: 'lobby',
      on: {
        DISCONNECT: '.disconnected',
        LEAVE_GAME: { target: 'leaving' },
        TOGGLE_SIDE_PANEL: { actions: 'toggleSidePanel' },
        CLIENT_GAME_STATE_UPDATED: { actions: 'setCurrentGameState' },
        ABILITY_PEEK_RESULT: { actions: 'setPeekedCard' },
        NEW_GAME_LOG: { actions: 'addGameLog' },
        INITIAL_LOGS_RECEIVED: { actions: 'setInitialLogs' },
        SUBMIT_CHAT_MESSAGE: { actions: ['addChatMessage', 'emitSendMessage'] },
      },
      states: {
        lobby: {
          on: {
            START_GAME: { actions: 'emitStartGame' },
            PLAYER_READY: { actions: 'emitPlayerReady' },
            CLIENT_GAME_STATE_UPDATED: [ // Re-check transition after any update
              {
                target: 'playing',
                guard: ({ event }) => event.gameState.gameStage !== GameStage.WAITING_FOR_PLAYERS,
                actions: 'setCurrentGameState',
              },
              {
                actions: 'setCurrentGameState', // otherwise, just update the state
              },
            ],
          },
        },
        playing: {
            initial: 'idle',
            on: {
                PLAY_CARD: { actions: 'emitPlayCard' },
                DRAW_CARD: { actions: 'emitDrawCard' },
            },
            states: {
                idle: {
                    always: { // Automatically enter ability mode if an ability is active
                        target: 'ability',
                        guard: ({ context }) => !!context.currentGameState?.activeAbility,
                        actions: 'initializeAbilityContext',
                    },
                },
                ability: {
                    on: {
                        PLAYER_SLOT_CLICKED_FOR_ABILITY: { actions: 'updateAbilityContext' },
                        CONFIRM_ABILITY_SELECTION: {
                            target: 'idle',
                            actions: ['emitUseAbility', 'clearAbilityContext', 'clearPeekedCard'],
                            guard: 'isAbilityPayloadComplete',
                        },
                        CANCEL_ABILITY_SELECTION: {
                            target: 'idle',
                            actions: ['clearAbilityContext', 'clearPeekedCard'],
                        },
                    },
                },
            },
        },
        leaving: {
          entry: ['emitLeaveGame', 'resetGameContext'],
          always: '#outOfGame',
        },
        disconnected: {
          on: { CONNECT: 'rejoining' },
        },
        rejoining: {
          tags: ['loading'],
          entry: 'emitRejoinGame',
          on: {
            CLIENT_GAME_STATE_UPDATED: {
              target: 'playing', // Go back to playing state on successful rejoin
              actions: 'setCurrentGameState',
            },
          },
        },
      },
    },
  },
});

export type UIMachineActorRef = ActorRefFrom<typeof uiMachine>;
export type UIMachineState = SnapshotFrom<typeof uiMachine>;