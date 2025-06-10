import { setup, assign, emit, assertEvent, type ActorRefFrom, type SnapshotFrom, fromPromise } from 'xstate';
import {
  PlayerActionType,
  SocketEventName,
  GameStage,
  TurnPhase,
  CardRank,
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
  AbilityPayload,
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
    payload: Partial<AbilityPayload>;
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
      type: 'EMIT_TO_SOCKET',
      eventName: SocketEventName.ATTEMPT_REJOIN,
      payload: { gameId: context.gameId, playerId: context.localPlayerId },
    }) as const),
    emitStartGame: emit({
      type: 'EMIT_TO_SOCKET',
      eventName: SocketEventName.PLAYER_ACTION,
      payload: { type: PlayerActionType.DECLARE_READY_FOR_PEEK },
    }),
    emitLeaveGame: () => {
      // No-op: leaving is handled by socket disconnect on server
    },
    emitPlayCard: emit(({ event }) => {
      assertEvent(event, 'PLAY_CARD');
      return {
        type: 'EMIT_TO_SOCKET',
        eventName: SocketEventName.PLAYER_ACTION,
        payload: {
          type: PlayerActionType.SWAP_AND_DISCARD,
          payload: { handCardIndex: event.cardIndex },
        },
      } as const;
    }),
    emitDrawCard: emit({
      type: 'EMIT_TO_SOCKET',
      eventName: SocketEventName.PLAYER_ACTION,
      payload: { type: PlayerActionType.DRAW_FROM_DECK },
    }),
    emitSendMessage: emit(({ event }) => {
      assertEvent(event, 'SUBMIT_CHAT_MESSAGE');
      const { type, ...payload } = event;
      return {
        type: 'EMIT_TO_SOCKET',
        eventName: SocketEventName.SEND_CHAT_MESSAGE,
        payload,
      } as const;
    }),
    emitUseAbility: emit(({ context }) => ({
      type: 'EMIT_TO_SOCKET',
      eventName: SocketEventName.PLAYER_ACTION,
      payload: {
        type: PlayerActionType.USE_ABILITY,
        payload: context.abilityContext?.payload,
      },
    }) as const),
    // #endregion

    setPeekedCard: assign({
      peekedCard: ({ event }) => {
        assertEvent(event, 'ABILITY_PEEK_RESULT');
        return { card: event.card, playerId: event.playerId, cardIndex: event.cardIndex };
      },
    }),
    clearPeekedCard: assign({
      peekedCard: null,
    }),

    setInitialGameState: assign(({ event }) => {
      assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);

      if (event.type === 'GAME_JOINED_SUCCESSFULLY' && event.response.gameState) {
        return { currentGameState: event.response.gameState };
      }

      // When creating, we don't get a full game state back, just a persisted snapshot which we ignore.
      // We create a default shell and wait for the first GAME_STATE_UPDATE.
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
        checkDetails: null,
        gameover: null,
        lastRoundLoserId: null,
        log: [],
        chat: [],
      };
      return { currentGameState: defaultGameState };
    }),
    initializeNewGameContext: assign({
      localPlayerId: ({ event }) => {
        assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
        return event.response.playerId ?? null;
      },
      gameId: ({ event }) => {
        assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
        return event.response.gameId ?? null;
      },
    }),
    showErrorToast: ({ event }) => {
      assertEvent(event, 'ERROR_RECEIVED');
      toast.error(event.error);
    },

    persistState: ({ self }) => {
      try {
        const snapshot = self.getSnapshot();
        const snapshotToPersist = {
          ...snapshot,
          value: { inGame: 'connected' },
        };
        sessionStorage.setItem('ui-machine-persisted-state', JSON.stringify(snapshotToPersist));
      } catch (e) {
        console.error('Failed to persist state to sessionStorage', e);
      }
    },

    // #region ----- ABILITY CONTEXT -----
    initializeAbilityContext: assign({
      abilityContext: ({ context }) => {
        const abilityType = context.currentGameState?.activeAbility?.type;
        if (!abilityType) return null;
        return { type: abilityType, payload: {} };
      },
    }),
    updateAbilityContext: assign({
      abilityContext: ({ context, event }) => {
        assertEvent(event, 'PLAYER_SLOT_CLICKED_FOR_ABILITY');
        const { abilityContext } = context;
        if (!abilityContext) return null;

        const { playerId, cardIndex } = event;

        if (abilityContext.type === 'peek') {
          const newPayload: Partial<AbilityPayload> = {
            ...abilityContext.payload,
            type: 'peek',
            targetPlayerId: playerId,
            cardIndex: cardIndex,
          };
          return { ...abilityContext, payload: newPayload };
        }
        if (abilityContext.type === 'swap') {
          const { sourcePlayerId, sourceCardIndex } = abilityContext.payload as Partial<SwapAbilityPayload>;
          let newPayload: Partial<AbilityPayload>;
          if (!sourcePlayerId) {
            newPayload = {
              ...abilityContext.payload,
              type: 'swap',
              sourcePlayerId: playerId,
              sourceCardIndex: cardIndex,
            };
          } else {
            newPayload = {
              ...abilityContext.payload,
              type: 'swap',
              targetPlayerId: playerId,
              targetCardIndex: cardIndex,
            };
          }
          return { ...abilityContext, payload: newPayload };
        }
        return abilityContext;
      },
    }),
    clearAbilityContext: assign({
      abilityContext: null,
    }),
    // #endregion

    toggleSidePanel: assign({
      isSidePanelOpen: ({ context }) => !context.isSidePanelOpen,
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
  },
  guards: {
    isAbilityPayloadComplete: ({ context }) => {
      if (!context.abilityContext) return false;
      const { type, payload } = context.abilityContext;
      if (type === 'peek') {
        const { targetPlayerId, cardIndex } = payload as PeekAbilityPayload;
        return targetPlayerId != null && cardIndex != null;
      }
      if (type === 'swap') {
        const { sourcePlayerId, sourceCardIndex, targetPlayerId, targetCardIndex } = payload as SwapAbilityPayload;
        return sourcePlayerId != null && sourceCardIndex != null && targetPlayerId != null && targetCardIndex != null;
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
  },
  states: {
    outOfGame: {
      id: 'outOfGame',
      initial: 'idle',
      states: {
        idle: {
          on: {
            CREATE_GAME_REQUESTED: 'creatingGame',
            JOIN_GAME_REQUESTED: 'joiningGame',
          },
        },
        creatingGame: {
          tags: ['loading'],
          entry: 'emitCreateGame',
          on: {
            GAME_CREATED_SUCCESSFULLY: {
              target: '#inGame.connected',
              actions: ['setInitialGameState', 'initializeNewGameContext', 'persistState'],
            },
            ERROR_RECEIVED: {
              target: 'idle',
              actions: 'showErrorToast',
            },
          },
        },
        joiningGame: {
          tags: ['loading'],
          entry: 'emitJoinGame',
          on: {
            GAME_JOINED_SUCCESSFULLY: {
              target: '#inGame.connected',
              actions: ['setInitialGameState', 'initializeNewGameContext', 'persistState'],
            },
            ERROR_RECEIVED: {
              target: 'idle',
              actions: 'showErrorToast',
            },
          },
        },
      },
    },
    inGame: {
      id: 'inGame',
      initial: 'connecting',
      on: {
        DISCONNECT: '.disconnected',
        LEAVE_GAME: {
          target: '.leaving',
        },
        TOGGLE_SIDE_PANEL: {
          actions: 'toggleSidePanel',
        },
        CLIENT_GAME_STATE_UPDATED: {
          actions: 'setCurrentGameState',
        },
        ABILITY_PEEK_RESULT: {
          actions: 'setPeekedCard',
        },
        NEW_GAME_LOG: {
          actions: 'addGameLog',
        },
        INITIAL_LOGS_RECEIVED: {
          actions: 'setInitialLogs',
        },
        SUBMIT_CHAT_MESSAGE: {
          actions: ['addChatMessage', 'emitSendMessage'],
        },
        ERROR_RECEIVED: { actions: 'showErrorToast' },
      },
      states: {
        connecting: {
          tags: ['loading'],
          on: {
            CONNECT: 'rejoining',
          },
        },
        rejoining: {
          tags: ['loading'],
          entry: 'emitRejoinGame',
          on: {
            CLIENT_GAME_STATE_UPDATED: {
              target: 'connected',
              actions: 'setCurrentGameState',
            },
          },
        },
        connected: {
          tags: ['connected'],
          always: {
            target: 'playing',
          },
        },
        playing: {
          initial: 'idle',
          on: {
            START_GAME: {
              actions: 'emitStartGame',
            },
            PLAY_CARD: {
              actions: 'emitPlayCard',
            },
            DRAW_CARD: {
              actions: 'emitDrawCard',
            },
          },
          states: {
            idle: {
              always: {
                target: '#inGame.playing.ability',
                guard: ({ context }) => !!context.currentGameState?.activeAbility,
                actions: 'initializeAbilityContext',
              },
            },
            ability: {
              initial: 'selecting',
              states: {
                selecting: {
                  on: {
                    PLAYER_SLOT_CLICKED_FOR_ABILITY: {
                      actions: 'updateAbilityContext',
                    },
                    CONFIRM_ABILITY_SELECTION: {
                      target: '#inGame.playing.idle',
                      actions: ['emitUseAbility', 'clearAbilityContext', 'clearPeekedCard'],
                      guard: 'isAbilityPayloadComplete',
                    },
                    CANCEL_ABILITY_SELECTION: {
                      target: '#inGame.playing.idle',
                      actions: ['clearAbilityContext', 'clearPeekedCard'],
                    },
                  },
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
          on: {
            CONNECT: 'rejoining',
          },
        },
      },
    },
  },
});

export type UIMachineActorRef = ActorRefFrom<typeof uiMachine>;
export type UIMachineState = SnapshotFrom<typeof uiMachine>;