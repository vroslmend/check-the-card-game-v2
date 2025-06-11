import { setup, assign, emit, assertEvent, type ActorRefFrom, type SnapshotFrom, type StateFrom, fromCallback } from 'xstate';
import {
  PlayerActionType,
  SocketEventName,
  GameStage,
  TurnPhase,
  type AbilityType,
  type ClientAbilityContext,
  type PlayerId,
  type GameId,
  type ClientCheckGameState,
  type CreateGameResponse,
  type JoinGameResponse,
  type ChatMessage,
  type RichGameLogMessage,
  type Card,
  type AbilityActionPayload,
  type PeekAbilityPayload,
  type SwapAbilityPayload,
  type SkipAbilityPayload,
  type PeekTarget,
  type SwapTarget,
} from 'shared-types';
import { toast } from 'sonner';

// Constants for error handling
const MAX_RECONNECT_ATTEMPTS = parseInt(process.env.NEXT_PUBLIC_MAX_RECONNECT_ATTEMPTS || '3', 10);
const RECONNECT_INTERVAL_MS = parseInt(process.env.NEXT_PUBLIC_RECONNECT_INTERVAL_MS || '5000', 10);

// #region ----- TYPE DEFINITIONS -----

// Define missing types
type AbilityAction = {
  type: AbilityType;
  targets?: any[];
};

type LogEntry = {
  id: string;
  text: string;
  timestamp: string;
};

type EmittedEvent = {
  type: 'EMIT_TO_SOCKET';
  eventName: SocketEventName;
  payload?: any;
  ack?: (...args: any[]) => void;
} | {
  type: 'REPORT_ERROR_TO_SERVER';
  errorType: string;
  message: string;
  context?: any;
};

export type UIMachineInput = {
  gameId?: string;
  localPlayerId?: string;
  initialGameState?: ClientCheckGameState;
};

export type PeekedCardInfo = {
  playerId: PlayerId | null;
  cardIndex: number;
  card: Card;
  expireAt?: number; // Optional timestamp when this peek should expire
  source: 'ability' | 'initial-peek'; // Source of the peek
};

export interface UIMachineContext {
  gameId?: string;
  currentGameState?: ClientCheckGameState;
  localPlayerId?: string;
  playerName?: string;
  pendingAbilityAction?: AbilityAction;
  abilityContext?: ClientAbilityContext;
  logEntries: LogEntry[];
  selectedCardIndices: number[];
  highlightedCardIndices: number[];
  peekedCardIndices: number[];
  visibleCardAnimations: Record<string, boolean>;
  modals: {
    createGame: {
      isOpen: boolean;
    };
    joinGame: {
      isOpen: boolean;
    };
    rules: {
      isOpen: boolean;
    };
    gameSettings: {
      isOpen: boolean;
    };
  };
  visibleCards: PeekedCardInfo[];
  chatMessages: ChatMessage[];
  gameLog: RichGameLogMessage[];
  isSidePanelOpen: boolean;
  error: {
    message: string;
    details?: string;
  } | null;
  reconnectionAttempts: number;
  connectionErrors: {
    message: string;
    timestamp: string;
  }[];
  modal?: {
    type: string;
    title: string;
    message: string;
  } | null;
}

export type UIMachineEvents =
  | { type: 'CREATE_GAME_REQUESTED'; playerName: string }
  | { type: 'JOIN_GAME_REQUESTED'; playerName: string; gameId: string }
  | { type: 'GAME_CREATED_SUCCESSFULLY'; response: CreateGameResponse }
  | { type: 'GAME_JOINED_SUCCESSFULLY'; response: JoinGameResponse }
  | { type: 'CONNECT' }
  | { type: 'DISCONNECT' }
  | { type: 'CLIENT_GAME_STATE_UPDATED'; gameState: ClientCheckGameState }
  | { type: 'NEW_GAME_LOG'; logMessage: RichGameLogMessage }
  | { type: 'INITIAL_PEEK_INFO'; hand: Card[] }
  | { type: 'ABILITY_PEEK_RESULT'; card: Card; playerId: PlayerId; cardIndex: number }
  | { type: 'ERROR_RECEIVED'; error: string }
  | { type: 'INITIAL_LOGS_RECEIVED'; logs: RichGameLogMessage[] }
  | { type: 'RECONNECT' }
  | { type: 'START_GAME' }
  | { type: 'PLAYER_READY' }
  | { type: 'LEAVE_GAME' }
  | { type: 'SUBMIT_CHAT_MESSAGE'; message: string; senderId: string; senderName: string; gameId: string }
  | { type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY'; playerId: PlayerId; cardIndex: number }
  | { type: 'CONFIRM_ABILITY_ACTION' }
  | { type: 'SKIP_ABILITY_STAGE' }
  | { type: 'CANCEL_ABILITY' }
  | { type: 'SWAP_AND_DISCARD'; cardIndex: number }
  | { type: 'DISCARD_DRAWN_CARD' }
  | { type: 'DRAW_FROM_DECK' }
  | { type: 'DRAW_FROM_DISCARD' }
  | { type: 'ATTEMPT_MATCH'; handCardIndex: number }
  | { type: 'PASS_ON_MATCH' }
  | { type: 'TOGGLE_SIDE_PANEL' }
  | { type: 'DECLARE_READY_FOR_PEEK_CLICKED' }
  | { type: 'CONNECTION_ERROR'; message: string }
  | { type: 'SERVER_ERROR'; message: string; details?: string }
  | { type: 'RETRY_RECONNECTION' }
  | { type: 'RECOVERY_FAILED' }
  | { type: 'DISMISS_MODAL' }
  | { type: 'CLEANUP_EXPIRED_CARDS' }
  | { type: 'CALL_CHECK' }
  | { type: 'PLAYER_ACTION'; payload: { type: PlayerActionType; payload?: any } };

// #endregion

export const uiMachine = setup({
  types: {
    context: {} as UIMachineContext,
    events: {} as UIMachineEvents,
    emitted: {} as EmittedEvent,
    input: {} as UIMachineInput,
  },
  actors: {
    cardVisibilityCleanup: fromCallback(({ sendBack }) => {
      // Clean up expired cards every second
      const interval = setInterval(() => {
        sendBack({ type: 'CLEANUP_EXPIRED_CARDS' });
      }, 1000);
      
      return () => clearInterval(interval);
    }),
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
      }
    }),
    setInitialLogs: assign({
      gameLog: ({ event }) => {
        assertEvent(event, 'INITIAL_LOGS_RECEIVED');
        return event.logs;
      }
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
    setGameIdAndPlayerId: assign({
      gameId: ({ event }) => {
        assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
        return event.response.gameId!;
      },
      localPlayerId: ({ event }) => {
        assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
        return event.response.playerId!;
      },
    }),
    setInitialGameState: assign({
      currentGameState: ({ event }) => {
        assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
        return event.response.gameState!;
      },
    }),
    resetGameContext: assign({
        localPlayerId: undefined,
        gameId: undefined,
        currentGameState: undefined,
        abilityContext: undefined,
        visibleCards: [],
        chatMessages: [],
        gameLog: [],
        error: null,
        reconnectionAttempts: 0,
        connectionErrors: [],
        modal: undefined,
    }),
    // #endregion

    // #region ----- Socket Emitters -----
    emitCreateGame: emit(({ self, event }) => {
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
    emitJoinGame: emit(({ self, event }) => {
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
    emitDeclareReadyForPeek: emit(({ context }) => ({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.PLAYER_ACTION,
      payload: { type: PlayerActionType.DECLARE_READY_FOR_PEEK, playerId: context.localPlayerId },
    })),
    emitSendMessage: emit(({ event }) => {
      assertEvent(event, 'SUBMIT_CHAT_MESSAGE');
      const { message, senderId, senderName, gameId } = event;
      return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.SEND_CHAT_MESSAGE,
        payload: { message, senderId, senderName, gameId },
      };
    }),
    // #endregion

    // #region ----- UI Actions -----
    showErrorToast: ({ event }) => {
        assertEvent(event, 'ERROR_RECEIVED');
        toast.error(event.error);
    },
    toggleSidePanel: assign({
        isSidePanelOpen: ({ context }) => !context.isSidePanelOpen,
    }),
    dismissModal: assign({
        modal: undefined,
    }),
    addPeekedCardToContext: assign({
      visibleCards: ({ context, event }) => {
        assertEvent(event, 'ABILITY_PEEK_RESULT');
        return [
          ...context.visibleCards,
          {
            playerId: event.playerId,
            cardIndex: event.cardIndex,
            card: event.card,
            source: 'ability' as const,
            // Set an expiration time, e.g., 5 seconds from now
            expireAt: Date.now() + 5000
          }
        ];
      },
    }),
    setInitialPeekCards: assign({
      visibleCards: ({ context, event }) => {
        assertEvent(event, 'INITIAL_PEEK_INFO');
        // Get the indices of the bottom two cards in a 2x2 grid
        const bottomCards = [2, 3]; 
        return event.hand.map((card, idx) => ({
          playerId: context.localPlayerId ?? null,
          cardIndex: bottomCards[idx],
          card,
          source: 'initial-peek' as const,
        }));
      },
    }),
    clearTemporaryCardStates: assign({
      visibleCards: [],
    }),
    // #endregion

    // #region ----- ABILITY CONTEXT -----
    syncAbilityContext: assign({
      abilityContext: ({ context }) => {
        const serverAbility = context.currentGameState?.activeAbility;
        const clientAbility = context.abilityContext;

        if (!serverAbility || serverAbility.playerId !== context.localPlayerId) {
          return undefined;
        }

        if (!clientAbility || clientAbility.type !== serverAbility.type) {
          const { type, stage, playerId } = serverAbility;
          let maxPeekTargets = 0;
          if (type === 'king') maxPeekTargets = 2;
          if (type === 'peek') maxPeekTargets = 1;

          const newContext: ClientAbilityContext = {
            type,
            stage,
            playerId,
            maxPeekTargets,
            selectedPeekTargets: [],
            selectedSwapTargets: [],
            peekedCards: [],
          };
          return newContext;
        }

        if (clientAbility.stage !== serverAbility.stage) {
          return {
            ...clientAbility,
            stage: serverAbility.stage,
            selectedPeekTargets: [],
            selectedSwapTargets: [],
          };
        }
        return clientAbility;
      },
    }),
    updateAbilityContext: assign({
      abilityContext: ({ context, event }) => {
        assertEvent(event, 'PLAYER_SLOT_CLICKED_FOR_ABILITY');
        const { abilityContext } = context;
        if (!abilityContext) return undefined;

        const { playerId, cardIndex } = event;
        const newTarget = { playerId, cardIndex: cardIndex! };

        if (abilityContext.stage === 'peeking') {
          const currentTargets = abilityContext.selectedPeekTargets;
          if (currentTargets.some(t => t.playerId === newTarget.playerId && t.cardIndex === newTarget.cardIndex)) {
            return abilityContext;
          }
          if (currentTargets.length < abilityContext.maxPeekTargets) {
            return {
              ...abilityContext,
              selectedPeekTargets: [...currentTargets, newTarget],
            };
          }
        }
        
        if (abilityContext.stage === 'swapping') {
          const currentTargets = abilityContext.selectedSwapTargets;
           if (currentTargets.some(t => t.playerId === newTarget.playerId && t.cardIndex === newTarget.cardIndex)) {
            return abilityContext;
          }
          if (currentTargets.length < 2) {
             return {
              ...abilityContext,
              selectedSwapTargets: [...currentTargets, newTarget],
            };
          }
        }
        return abilityContext;
      },
    }),
    clearAbilityContext: assign({
      abilityContext: undefined,
    }),
    // #endregion

    // #region ----- Error Handling -----
    showConnectionErrorToast: ({ event }) => {
      assertEvent(event, 'CONNECTION_ERROR');
      toast.error(`Connection error: ${event.message}. Attempting to reconnect...`);
    },
    
    showServerErrorToast: ({ event }) => {
      assertEvent(event, 'SERVER_ERROR');
      toast.error(`Server error: ${event.message}`);
    },
    
    addConnectionError: assign({
      connectionErrors: ({ context, event }) => {
        assertEvent(event, 'CONNECTION_ERROR');
        return [...context.connectionErrors, {
          message: event.message,
          timestamp: new Date().toISOString()
        }];
      }
    }),
    
    clearErrors: assign({
      error: null,
      connectionErrors: []
    }),
    
    incrementReconnectionAttempts: assign({
      reconnectionAttempts: ({ context }) => context.reconnectionAttempts + 1
    }),
    
    resetReconnectionAttempts: assign({
      reconnectionAttempts: 0
    }),
    
    reportErrorToServer: emit(({ event }) => {
      assertEvent(event, ['ERROR_RECEIVED', 'CONNECTION_ERROR', 'SERVER_ERROR']);
      return {
        type: 'REPORT_ERROR_TO_SERVER' as const,
        errorType: event.type,
        message: 'error' in event ? event.error : event.message,
        context: 'details' in event ? event.details : undefined
      };
    }),
    // #endregion

    cleanupExpiredVisibleCards: assign({
      visibleCards: ({ context }) => {
        const now = Date.now();
        return context.visibleCards.filter(vc => !vc.expireAt || vc.expireAt > now);
      }
    }),
  },
  guards: {
    isAbilityActionComplete: ({ context }) => {
        const { abilityContext } = context;
        if (!abilityContext) return false;
        if (abilityContext.stage === 'peeking') {
            return abilityContext.selectedPeekTargets.length === abilityContext.maxPeekTargets;
        }
        if (abilityContext.stage === 'swapping') {
            return abilityContext.selectedSwapTargets.length === 2;
        }
        return false;
      },
    canAttemptReconnection: ({ context }) => context.reconnectionAttempts < MAX_RECONNECT_ATTEMPTS,
  },
}).createMachine({
  id: 'ui',
  context: ({ input }) => ({
    localPlayerId: input.localPlayerId ?? undefined,
    gameId: input.gameId ?? undefined,
    currentGameState: input.initialGameState ?? undefined,
    abilityContext: undefined,
    visibleCards: [],
    chatMessages: input.initialGameState?.chat ?? [],
    gameLog: input.initialGameState?.log ?? [],
    isSidePanelOpen: false,
    error: null,
    reconnectionAttempts: 0,
    connectionErrors: [],
    modal: undefined,
    // Add missing required properties
    logEntries: [],
    selectedCardIndices: [],
    highlightedCardIndices: [],
    peekedCardIndices: [],
    visibleCardAnimations: {},
    modals: {
      createGame: { isOpen: false },
      joinGame: { isOpen: false },
      rules: { isOpen: false },
      gameSettings: { isOpen: false },
    },
  }),
  initial: 'initializing',
  on: {
    RECONNECT: '#ui.inGame.reconnecting',
    ERROR_RECEIVED: { 
      actions: ['showErrorToast', 'reportErrorToServer'] 
    },
    CONNECTION_ERROR: { 
      actions: ['showConnectionErrorToast', 'addConnectionError', 'reportErrorToServer'] 
    },
    SERVER_ERROR: { 
      actions: ['showServerErrorToast', 'reportErrorToServer'],
    },
    DISMISS_MODAL: {
      actions: 'dismissModal'
    }
  },
  states: {
    initializing: {
      always: [
        {
          target: 'inGame',
          guard: ({ context }) => !!context.currentGameState,
        },
        {
          target: 'outOfGame',
        },
      ],
    },
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
        DISCONNECT: {
          target: '.disconnected',
          actions: assign({
            error: { message: 'You have been disconnected from the game server' }
          })
        },
        LEAVE_GAME: { target: '.leaving' },
        TOGGLE_SIDE_PANEL: { actions: 'toggleSidePanel' },
        CLIENT_GAME_STATE_UPDATED: {
          actions: ['setCurrentGameState', 'syncAbilityContext'],
        },
        INITIAL_PEEK_INFO: {
          actions: 'setInitialPeekCards'
        },
        ABILITY_PEEK_RESULT: {
          actions: 'addPeekedCardToContext'
        },
        NEW_GAME_LOG: {
          actions: 'addGameLog'
        },
        INITIAL_LOGS_RECEIVED: {
          actions: 'setInitialLogs'
        },
        SUBMIT_CHAT_MESSAGE: {
          actions: ['addChatMessage', 'emitSendMessage'],
        },
        DECLARE_READY_FOR_PEEK_CLICKED: { actions: 'emitDeclareReadyForPeek' },
      },
      states: {
        lobby: {
          on: {
            START_GAME: { actions: 'emitStartGame' },
            PLAYER_READY: { actions: 'emitPlayerReady' },
            CLIENT_GAME_STATE_UPDATED: [
              {
                target: 'playing',
                guard: ({ event }) => event.gameState.gameStage !== GameStage.WAITING_FOR_PLAYERS,
                actions: ['setCurrentGameState', 'clearTemporaryCardStates', 'syncAbilityContext'],
              },
              {
                actions: ['setCurrentGameState', 'syncAbilityContext'],
              },
            ],
          },
        },
        playing: {
            initial: 'active',
            on: {
                SWAP_AND_DISCARD: {
                  actions: emit(({ context, event }) => ({
                    type: 'EMIT_TO_SOCKET',
                    eventName: SocketEventName.PLAYER_ACTION,
                    payload: {
                      type: PlayerActionType.SWAP_AND_DISCARD,
                      payload: { handCardIndex: event.cardIndex },
                      playerId: context.localPlayerId,
                    }
                  })),
                },
                DISCARD_DRAWN_CARD: {
                  actions: emit(({ context }) => ({
                    type: 'EMIT_TO_SOCKET',
                    eventName: SocketEventName.PLAYER_ACTION,
                    payload: {
                      type: PlayerActionType.DISCARD_DRAWN_CARD,
                      playerId: context.localPlayerId,
                    }
                  })),
                },
                DRAW_FROM_DECK: {
                  actions: emit(({ context }) => ({
                    type: 'EMIT_TO_SOCKET',
                    eventName: SocketEventName.PLAYER_ACTION,
                    payload: {
                      type: PlayerActionType.DRAW_FROM_DECK,
                      playerId: context.localPlayerId,
                    }
                  })),
                },
                DRAW_FROM_DISCARD: {
                  actions: emit(({ context }) => ({
                    type: 'EMIT_TO_SOCKET',
                    eventName: SocketEventName.PLAYER_ACTION,
                    payload: {
                      type: PlayerActionType.DRAW_FROM_DISCARD,
                      playerId: context.localPlayerId,
                    }
                  })),
                },
                ATTEMPT_MATCH: {
                  actions: emit(({ context, event }) => ({
                    type: 'EMIT_TO_SOCKET',
                    eventName: SocketEventName.PLAYER_ACTION,
                    payload: {
                      type: PlayerActionType.ATTEMPT_MATCH,
                      payload: { handCardIndex: event.handCardIndex },
                      playerId: context.localPlayerId,
                    }
                  })),
                },
                PASS_ON_MATCH: {
                  actions: emit(({ context }) => ({
                    type: 'EMIT_TO_SOCKET',
                    eventName: SocketEventName.PLAYER_ACTION,
                    payload: {
                      type: PlayerActionType.PASS_ON_MATCH_ATTEMPT,
                      playerId: context.localPlayerId,
                    }
                  })),
                },
                CALL_CHECK: {
                  actions: emit(({ context }) => ({
                    type: 'EMIT_TO_SOCKET',
                    eventName: SocketEventName.PLAYER_ACTION,
                    payload: {
                      type: PlayerActionType.CALL_CHECK,
                      playerId: context.localPlayerId,
                    }
                  })),
                },
                CONFIRM_ABILITY_ACTION: {
                  guard: 'isAbilityActionComplete',
                  actions: emit(({ context }) => {
                      const { abilityContext } = context;
                      if (!abilityContext) throw new Error('Ability context missing');
                      
                      let payload: AbilityActionPayload;
                      if (abilityContext.stage === 'peeking') {
                        payload = { action: 'peek', targets: abilityContext.selectedPeekTargets };
                      } else {
                        payload = { action: 'swap', source: abilityContext.selectedSwapTargets[0]!, target: abilityContext.selectedSwapTargets[1]! };
                      }
                      return {
                        type: 'EMIT_TO_SOCKET',
                        eventName: SocketEventName.PLAYER_ACTION,
                        payload: {
                          type: PlayerActionType.USE_ABILITY,
                          payload,
                          playerId: context.localPlayerId,
                        }
                      };
                  }),
                },
                SKIP_ABILITY_STAGE: {
                  actions: emit(({ context }) => ({
                    type: 'EMIT_TO_SOCKET',
                    eventName: SocketEventName.PLAYER_ACTION,
                    payload: {
                      type: PlayerActionType.USE_ABILITY,
                      payload: { action: 'skip' } satisfies SkipAbilityPayload,
                      playerId: context.localPlayerId,
                    }
                  })),
                },
            },
            states: {
                active: {
                  invoke: {
                    src: 'cardVisibilityCleanup',
                  },
                  on: {
                    CLEANUP_EXPIRED_CARDS: {
                      actions: 'cleanupExpiredVisibleCards'
                    }
                  },
                  always: [
                    {
                      target: 'ability',
                      guard: ({ context }) => !!context.abilityContext,
                    }
                  ]
                },
                idle: {
                    always: {
                        target: 'ability',
                        guard: ({ context }) => !!context.abilityContext,
                    },
                },
                ability: {
                    always: [
                      {
                        target: 'active',
                        guard: ({ context }) => !context.abilityContext,
                      }
                    ],
                    on: {
                        PLAYER_SLOT_CLICKED_FOR_ABILITY: { actions: 'updateAbilityContext' },
                        CANCEL_ABILITY: {
                            target: 'active',
                            actions: ['clearAbilityContext'],
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
          entry: 'incrementReconnectionAttempts',
          on: { 
            CONNECT: 'reconnecting',
            RETRY_RECONNECTION: {
              target: 'reconnecting',
              guard: 'canAttemptReconnection',
              actions: 'incrementReconnectionAttempts'
            },
            RECOVERY_FAILED: 'recoveryFailed'
          },
          after: {
            [RECONNECT_INTERVAL_MS]: [
              {
                target: 'reconnecting',
                guard: 'canAttemptReconnection',
                actions: 'incrementReconnectionAttempts'
              },
              {
                target: 'recoveryFailed'
              }
            ]
          }
        },
        reconnecting: {
          tags: ['loading'],
          entry: ['emitRejoinGame'],
          on: {
            CLIENT_GAME_STATE_UPDATED: {
              target: 'playing',
              actions: ['setCurrentGameState', 'syncAbilityContext', 'resetReconnectionAttempts', 'clearErrors'],
            },
            CONNECTION_ERROR: 'disconnected'
          },
          after: {
            [RECONNECT_INTERVAL_MS]: 'disconnected'
          }
        },
        recoveryFailed: {
          entry: ({ context }) => {
            toast.error(`Failed to reconnect after ${context.reconnectionAttempts} attempts. Please refresh the page and try again.`);
          },
          on: {
            CONNECT: 'reconnecting',
          }
        },
      },
    },
  },
});

export type UIMachineActorRef = ActorRefFrom<typeof uiMachine>;
export type UIMachineState = SnapshotFrom<typeof uiMachine>;
export type UIMachineSnapshot = StateFrom<typeof uiMachine>;