import { setup, assign, emit, assertEvent, type ActorRefFrom, type SnapshotFrom } from 'xstate';
import { PlayerActionType, SocketEventName, GameStage, TurnPhase, CardRank, type AbilityType } from 'shared-types';
import type {
  PlayerId,
  Card,
  ClientCheckGameState,
  RichGameLogMessage,
  ChatMessage,
  AbilityPayload,
  PeekAbilityPayload,
  SwapAbilityPayload,
  CreateGameResponse,
  JoinGameResponse,
} from 'shared-types';
import { toast } from 'sonner';

// #region ----- TYPE DEFINITIONS -----
interface ToastPayload {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  isSidePanelOpen: boolean;
}

export interface AnimationCue {
  type: 'draw' | 'discard' | 'swap' | 'peek' | 'player-eliminated';
  payload?: any;
}

export interface AbilityContextContent {
  type: AbilityType;
  payload: Partial<AbilityPayload>;
  serverProvidedData?: {
    card: Card;
    playerId: PlayerId;
    cardIndex: number;
  }
}

export interface ModalPayload {
  type: 'error' | 'confirm-discard' | 'confirm-swap' | 'initial-peek' | 'ability-peek-result' | 'rejoin';
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: UIMachineEvent;
  onCancel?: UIMachineEvent;
  data?: any;
}

export interface UIMachineContext {
  localPlayerId: PlayerId | null;
  gameId: string | null;
  currentGameState: ClientCheckGameState | null;
  selectedHandCardIndex: number | null;
  abilityContext: AbilityContextContent | null;
  activeAnimationCue: AnimationCue | null;
  modal: ModalPayload | null;
  toasts: ToastPayload[];
  gameLog: RichGameLogMessage[];
  chatMessages: ChatMessage[];
  isSidePanelOpen: boolean;
}

export type UIMachineEvent =
  // Game Lifecycle
  | { type: 'CREATE_GAME_REQUESTED'; playerName: string }
  | { type: 'JOIN_GAME_REQUESTED'; playerName: string; gameId: string }
  | { type: 'GAME_CREATED_SUCCESSFULLY'; response: CreateGameResponse }
  | { type: 'GAME_JOINED_SUCCESSFULLY'; response: JoinGameResponse }
// Core
  | { type: 'CONNECT' }
  | { type: 'DISCONNECT' }
| { type: 'INITIALIZE'; localPlayerId: PlayerId; gameId: string }
  | { type: 'GAME_STATE_RECEIVED'; gameState: ClientCheckGameState }
  // Server Pushed Events
| { type: 'CLIENT_GAME_STATE_UPDATED'; gameState: ClientCheckGameState }
| { type: 'NEW_GAME_LOG'; logMessage: RichGameLogMessage }
  | { type: 'INITIAL_LOGS_RECEIVED'; logs: RichGameLogMessage[] }
| { type: 'NEW_CHAT_MESSAGE'; chatMessage: ChatMessage }
| { type: 'ERROR_RECEIVED'; error: string }
// User Interactions (UI Clicks)
| { type: 'DRAW_FROM_DECK_CLICKED' }
| { type: 'DRAW_FROM_DISCARD_CLICKED' }
  | { type: 'HAND_CARD_CLICKED'; cardIndex: number }
  | { type: 'DECLARE_READY_FOR_PEEK_CLICKED' }
| { type: 'CALL_CHECK_CLICKED' }
// Actions on a pending drawn card
| { type: 'CONFIRM_SWAP_PENDING_CARD_WITH_HAND'; handCardIndex: number }
| { type: 'CONFIRM_DISCARD_PENDING_DRAWN_CARD' }
// Ability Flow
  | { type: 'START_ABILITY'; abilityType: AbilityType, payload: Partial<AbilityPayload> }
  | { type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY'; targetPlayerId: PlayerId; cardIndex: number }
  | { type: 'SERVER_PROVIDED_CARD_FOR_ABILITY'; card: Card; playerId: PlayerId; cardIndex: number }
| { type: 'ABILITY_CONFIRM_ACTION' }
| { type: 'ABILITY_CANCEL_ACTION' }
  | { type: 'RESOLVE_ABILITY_SUCCESS' }
// UI Management
| { type: 'SHOW_TOAST'; toast: Omit<ToastPayload, 'id'> }
| { type: 'DISMISS_TOAST'; toastId: string }
| { type: 'SHOW_MODAL'; modal: ModalPayload }
| { type: 'DISMISS_MODAL' }
| { type: 'TRIGGER_ANIMATION'; cue: AnimationCue }
| { type: 'ANIMATION_COMPLETED'; cueType: AnimationCue['type'] }
// Chat
  | { type: 'SUBMIT_CHAT_MESSAGE'; message: string; senderId: PlayerId; senderName: string; gameId: string }
  // Side Panel
  | { type: 'TOGGLE_SIDE_PANEL' }
  // Socket connection
  | { type: 'RECONNECT' }
  // Player actions
  | { type: 'DRAW_CARD' }
  | { type: 'PLAY_CARD'; cardIndex: number }

type EmittedEvent = { type: 'EMIT_TO_SOCKET'; eventName: SocketEventName; payload: any, ack?: (response: any) => void };
// #endregion

export type UIMachineInput = {
  gameId: string;
  localPlayerId: string;
  gameState?: ClientCheckGameState;
}

export const uiMachine = setup({
  types: {
    context: {} as UIMachineContext,
    events: {} as UIMachineEvent,
    emitted: {} as EmittedEvent,
    input: {} as UIMachineInput,
  },
  actions: {
    initializeContext: assign(({ event }) => {
      assertEvent(event, 'INITIALIZE');
      return {
        localPlayerId: event.localPlayerId,
        gameId: event.gameId,
      };
    }),
     initializeIdsFromGameResponse: assign({
      localPlayerId: ({ event }) => {
        assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
        return event.response.playerId!;
      },
      gameId: ({ event }) => {
        assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
        return event.response.gameId!;
      },
    }),
    setCurrentGameState: assign({
      currentGameState: ({ event }) => {
        assertEvent(event, ['GAME_STATE_RECEIVED', 'CLIENT_GAME_STATE_UPDATED']);
        return event.gameState;
      },
      chatMessages: ({ event }) => {
        assertEvent(event, ['GAME_STATE_RECEIVED', 'CLIENT_GAME_STATE_UPDATED']);
        return event.gameState.chat ?? [];
      }
    }),
    setInitialGameState: assign({
      currentGameState: ({ event }) => {
        assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
        const { gameId, playerId, gameState } = event.response;
        if (gameState) {
             sessionStorage.setItem('initialGameState', JSON.stringify(gameState));
        }
        return {
          gameId,
          viewingPlayerId: playerId,
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
        } as ClientCheckGameState;
      }
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
      }
    }),
    addChatMessage: assign({
      chatMessages: ({ context, event }) => {
        assertEvent(event, 'NEW_CHAT_MESSAGE');
        return [...context.chatMessages, event.chatMessage];
      },
    }),
    showErrorModal: assign({
        modal: ({ event }): ModalPayload => {
            assertEvent(event, 'ERROR_RECEIVED');
            return {
              type: 'error',
              title: 'Server Error',
              message: event.error,
              confirmText: 'OK',
              onConfirm: { type: 'DISMISS_MODAL' },
            };
          },
    }),
    updateAbilityPayload: assign({
      abilityContext: ({ context, event }) => {
            assertEvent(event, 'PLAYER_SLOT_CLICKED_FOR_ABILITY');
        if (!context.abilityContext) return null;

            const newAbilityContext = JSON.parse(JSON.stringify(context.abilityContext));
            const { type } = newAbilityContext;
            const payload = newAbilityContext.payload;
        
            if (type === 'peek') {
                payload.targetPlayerId = event.targetPlayerId;
                payload.cardIndex = event.cardIndex;
            } else if (type === 'swap') {
                if (payload.sourcePlayerId === undefined) {
                    payload.sourcePlayerId = context.localPlayerId!;
                    payload.sourceCardIndex = event.cardIndex;
                } else {
                    payload.targetPlayerId = event.targetPlayerId;
                    payload.targetCardIndex = event.cardIndex;
                }
            }
            return newAbilityContext;
        }
    }),
    setAbilityServerData: assign({
      abilityContext: ({ context, event }) => {
            assertEvent(event, 'SERVER_PROVIDED_CARD_FOR_ABILITY');
        if (!context.abilityContext) return null;
            return {
                ...context.abilityContext,
                serverProvidedData: {
                    card: event.card,
                    playerId: event.playerId,
                    cardIndex: event.cardIndex
                }
            };
        }
    }),
    showAbilityResultModal: assign({
        modal: ({ context }): ModalPayload => {
            if (!context.abilityContext?.serverProvidedData) throw new Error('Cannot present ability result without server data');
            const { card } = context.abilityContext.serverProvidedData;
            return {
                type: 'ability-peek-result',
                title: 'Peek Result',
                message: `The card is: ${card.rank} of ${card.suit}`,
                confirmText: 'OK',
                onConfirm: { type: 'RESOLVE_ABILITY_SUCCESS' }
            }
        }
    }),
    clearAbilityContext: assign({ abilityContext: null }),
    clearModal: assign({ modal: null }),
    showRejoinModal: assign({
      modal: ({ context }) => ({
        type: 'rejoin',
        title: 'Join Game in Progress',
        message: `You are trying to join game ${context.gameId}. Please enter your name to continue.`,
      } as ModalPayload)
    }),
    // #region ----- Socket Emitters -----
    emitCreateGame: emit(({ event, self }) => {
      assertEvent(event, 'CREATE_GAME_REQUESTED');
      return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.CREATE_GAME,
        payload: { name: event.playerName },
        ack: (response: CreateGameResponse) => {
          if (response.success) {
            self.send({ type: 'GAME_CREATED_SUCCESSFULLY', response });
          } else {
            self.send({ type: 'ERROR_RECEIVED', error: response.message || 'Failed to create game.' });
          }
        }
      };
    }),
    emitJoinGame: emit(({ event, self }) => {
      assertEvent(event, 'JOIN_GAME_REQUESTED');
      return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.JOIN_GAME,
        payload: { name: event.playerName, gameId: event.gameId },
        ack: (response: JoinGameResponse) => {
          if (response.success) {
            self.send({ type: 'GAME_JOINED_SUCCESSFULLY', response });
          } else {
            self.send({ type: 'ERROR_RECEIVED', error: response.message || 'Failed to join game.' });
          }
        }
      };
    }),
    emitDrawFromDeck: emit({
      type: 'EMIT_TO_SOCKET',
      eventName: SocketEventName.PLAYER_ACTION,
      payload: { type: PlayerActionType.DRAW_FROM_DECK },
    }),
    emitDrawFromDiscard: emit({
      type: 'EMIT_TO_SOCKET',
      eventName: SocketEventName.PLAYER_ACTION,
      payload: { type: PlayerActionType.DRAW_FROM_DISCARD },
    }),
    emitReadyForInitialPeek: emit({
      type: 'EMIT_TO_SOCKET',
      eventName: SocketEventName.PLAYER_ACTION,
      payload: { type: PlayerActionType.DECLARE_READY_FOR_PEEK },
    }),
    emitConfirmDiscardPending: emit({
      type: 'EMIT_TO_SOCKET',
      eventName: SocketEventName.PLAYER_ACTION,
      payload: { type: PlayerActionType.DISCARD_DRAWN_CARD },
    }),
    emitConfirmSwapPending: emit(({ event }) => {
      assertEvent(event, 'CONFIRM_SWAP_PENDING_CARD_WITH_HAND');
      return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.PLAYER_ACTION,
        payload: { type: PlayerActionType.SWAP_AND_DISCARD, payload: { handCardIndex: event.handCardIndex } },
      };
    }),
    emitCallCheck: emit({
      type: 'EMIT_TO_SOCKET',
      eventName: SocketEventName.PLAYER_ACTION,
      payload: { type: PlayerActionType.CALL_CHECK },
    }),
    emitChatMessage: emit(({ event }) => {
      assertEvent(event, 'SUBMIT_CHAT_MESSAGE');
      const { type, ...payload } = event;
      return { type: 'EMIT_TO_SOCKET' as const, eventName: SocketEventName.SEND_CHAT_MESSAGE, payload };
    }),
    emitAbilityAction: emit(({ context }) => {
        if (!context.abilityContext) {
            throw new Error('Attempted to emit ability action without ability context');
        }
          return {
            type: 'EMIT_TO_SOCKET' as const,
            eventName: SocketEventName.PLAYER_ACTION,
            payload: { type: PlayerActionType.USE_ABILITY, payload: context.abilityContext.payload }
        }
    }),
    emitAttemptRejoin: emit(({ context }) => {
      if (!context.gameId || !context.localPlayerId) {
        console.error('Attempted to rejoin without gameId or localPlayerId');
            return {
          type: 'EMIT_TO_SOCKET' as const,
          eventName: SocketEventName.ERROR_MESSAGE,
          payload: { message: 'Client error: Missing context for rejoin.' },
        };
      }
          return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.ATTEMPT_REJOIN,
        payload: { gameId: context.gameId, playerId: context.localPlayerId },
      };
    }),
    // #endregion
  },
  guards: {
    isLocalPlayerTurn: ({ context }) => {
      return context.currentGameState?.currentPlayerId === context.localPlayerId;
    },
    hasDrawnCard: ({ context }) => {
        const localPlayer = context.localPlayerId ? context.currentGameState?.players[context.localPlayerId] : undefined;
        return !!localPlayer?.pendingDrawnCard;
    },
    isAbilityPayloadComplete: ({ context }) => {
      if (!context.abilityContext) return false;
        const { type, payload } = context.abilityContext;
        if (type === 'peek') {
            return !!(payload as Partial<PeekAbilityPayload>).targetPlayerId;
        }
        if (type === 'swap') {
            const swapPayload = payload as Partial<SwapAbilityPayload>;
            return !!(swapPayload.sourcePlayerId && swapPayload.targetPlayerId);
        }
        return false;
    }
  },
}).createMachine({
  initial: 'outOfGame',
  context: ({ input }) => ({
    localPlayerId: input.localPlayerId ?? null,
    gameId: input.gameId ?? null,
    currentGameState: input.gameState ?? null,
      selectedHandCardIndex: null,
      abilityContext: null,
      activeAnimationCue: null,
      modal: null,
      toasts: [],
    gameLog: [],
    chatMessages: [],
    isSidePanelOpen: false,
  }),
    states: {
    outOfGame: {
      id: 'outOfGame',
      initial: 'idle',
      states: {
        idle: {
          on: {
            CREATE_GAME_REQUESTED: 'creatingGame',
            JOIN_GAME_REQUESTED: 'joiningGame'
          }
        },
        creatingGame: {
          tags: ['loading'],
          entry: 'emitCreateGame',
          on: {
            GAME_CREATED_SUCCESSFULLY: 'gameCreated',
            ERROR_RECEIVED: {
              target: 'idle',
              actions: 'showErrorModal'
            }
          }
        },
        joiningGame: {
          tags: ['loading'],
          entry: 'emitJoinGame',
          on: {
            GAME_JOINED_SUCCESSFULLY: {
              target: '#inGame',
              actions: 'setInitialGameState'
            },
            ERROR_RECEIVED: {
              target: 'idle',
              actions: 'showErrorModal'
            }
          }
        },
        rejoiningGame: {
          entry: 'showRejoinModal',
          on: {
            JOIN_GAME_REQUESTED: 'joiningGame',
            DISMISS_MODAL: 'idle'
          }
        },
        gameCreated: {
            // This state is transient, immediately moving to inGame
            // if we have the right data.
            always: {
                target: '#inGame',
                guard: ({ context }) => !!context.currentGameState,
          }
        }
      }
    },
    inGame: {
      id: 'inGame',
      initial: 'connecting',
      on: {
        CLIENT_GAME_STATE_UPDATED: {
          actions: 'setCurrentGameState'
        },
        NEW_GAME_LOG: {
          actions: 'addGameLog'
        },
        INITIAL_LOGS_RECEIVED: {
            actions: 'setInitialLogs'
        },
        NEW_CHAT_MESSAGE: { actions: ['addChatMessage'] },
        ERROR_RECEIVED: { actions: 'showErrorModal' },
        DISCONNECT: '.disconnected',
        INITIALIZE: {
          target: '.rejoining',
        }
      },
      states: {
        connecting: {
          on: {
            CONNECT: 'connected',
            DISCONNECT: 'disconnected'
          }
        },
        connected: {
          tags: ['connected'],
          type: 'parallel',
          states: {
            turnActions: {
                 on: {
            HAND_CARD_CLICKED: {
                        actions: assign({
                            selectedHandCardIndex: ({ event }) => event.cardIndex
                        }),
                        guard: 'hasDrawnCard'
                    },
                    DECLARE_READY_FOR_PEEK_CLICKED: { actions: 'emitReadyForInitialPeek' },
                    DRAW_FROM_DECK_CLICKED: { actions: 'emitDrawFromDeck', guard: 'isLocalPlayerTurn' },
                    DRAW_FROM_DISCARD_CLICKED: { actions: 'emitDrawFromDiscard', guard: 'isLocalPlayerTurn' },
                    CALL_CHECK_CLICKED: { actions: 'emitCallCheck', guard: 'isLocalPlayerTurn' },
                    CONFIRM_DISCARD_PENDING_DRAWN_CARD: { actions: 'emitConfirmDiscardPending' },
                    CONFIRM_SWAP_PENDING_CARD_WITH_HAND: { actions: 'emitConfirmSwapPending' },
                 }
            },
            ability: {
                initial: 'idle',
      states: {
                    idle: {
                        on: {
                            START_ABILITY: {
                                target: 'collectingInput',
                                actions: assign({
                                    abilityContext: ({ event }) => ({ type: event.abilityType, payload: event.payload })
                                })
                            },
                        }
                    },
                    collectingInput: {
                        on: {
                            PLAYER_SLOT_CLICKED_FOR_ABILITY: [
                                {
                                    target: 'confirming',
                                    guard: 'isAbilityPayloadComplete',
                                    actions: 'updateAbilityPayload'
                                },
                                {
                                    actions: 'updateAbilityPayload'
                                }
                            ],
                            ABILITY_CANCEL_ACTION: {
                                target: 'idle',
                                actions: 'clearAbilityContext'
                            }
                        }
                    },
                    confirming: {
                        entry: 'emitAbilityAction',
                        on: {
                            RESOLVE_ABILITY_SUCCESS: 'idle',
            SERVER_PROVIDED_CARD_FOR_ABILITY: {
                                target: 'presentingResult',
                                actions: 'setAbilityServerData'
                            },
                            ERROR_RECEIVED: {
                                target: 'idle',
                                actions: ['showErrorModal', 'clearAbilityContext']
                            }
                        }
                    },
                    presentingResult: {
                        entry: 'showAbilityResultModal',
                        on: {
                            RESOLVE_ABILITY_SUCCESS: {
                                target: 'idle',
                                actions: ['clearModal', 'clearAbilityContext']
                            }
                        }
                    }
                }
            }
          }
        },
        disconnected: {
          tags: ['disconnected'],
          on: {
            CONNECT: 'connected',
            RECONNECT: 'connecting'
          }
        },
        rejoining: {
            tags: ['loading'],
            entry: 'emitAttemptRejoin',
            on: {
                GAME_STATE_RECEIVED: {
                    target: 'connected',
                    actions: 'setCurrentGameState'
                },
            ERROR_RECEIVED: {
                    target: '#outOfGame.rejoiningGame',
                    actions: 'showErrorModal'
                }
            }
          }
        }
        }
      }
});

export type UIMachineActorRef = ActorRefFrom<typeof uiMachine>;
export type UIMachineState = SnapshotFrom<typeof uiMachine>;