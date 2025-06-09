import { setup, assign, emit, assertEvent, type ActorRefFrom, type SnapshotFrom } from 'xstate';
import { PlayerActionType, SocketEventName } from 'shared-types';
import type {
  PlayerId,
  Card,
  ClientCheckGameState,
  RichGameLogMessage,
  ConcretePlayerActionEvents,
  ChatMessage,
  AbilityArgs,
} from 'shared-types';
import { toast } from 'sonner';

// #region ----- TYPE DEFINITIONS -----
interface ToastPayload {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface AnimationCue {
  type: 'draw' | 'discard' | 'swap' | 'peek' | 'player-eliminated';
  payload?: any;
}

export interface AbilityContextContent {
  type: 'peek' | 'swap'; // Corrected based on AbilityArgs which doesn't have a 'type' property
  payload: AbilityArgs;
}

export interface ModalPayload {
  type: 'confirm-discard' | 'confirm-swap' | 'error' | 'initial-peek';
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
  | { type: 'DISCARD_SELECTED_HAND_CARD_CONFIRMED' }
  | { type: 'SWAP_WITH_SELECTED_HAND_CARD_CONFIRMED' }
  | { type: 'PLAYER_ACTION_CLICKED'; action: ConcretePlayerActionEvents }
  | { type: 'DECLARE_READY_FOR_PEEK_CLICKED' }
  | { type: 'INITIAL_PEEK_ACKNOWLEDGED_CLICKED' }
  // Actions on a pending drawn card
  | { type: 'CONFIRM_SWAP_PENDING_CARD_WITH_HAND'; handCardIndex: number }
  | { type: 'CONFIRM_DISCARD_PENDING_DRAWN_CARD' }
  // Ability Flow
  | { type: 'START_ABILITY'; ability: AbilityContextContent['type'], payload: AbilityArgs }
  | { type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY'; targetPlayerId: PlayerId; cardIndex: number }
  | { type: 'SERVER_PROVIDED_CARD_FOR_ABILITY'; card: Card; playerId: PlayerId; cardIndex: number }
  | { type: 'ABILITY_CONFIRM_ACTION' }
  | { type: 'ABILITY_CANCEL_ACTION' }
  | { type: 'ABILITY_SKIP_PEEK' }
  | { type: 'ABILITY_SKIP_SWAP' }
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
  | { type: 'TOGGLE_SIDE_PANEL' };

type EmittedEvent = { type: 'EMIT_TO_SOCKET'; eventName: SocketEventName; payload: any };
// #endregion

export const uiMachine = setup({
  types: {
    context: {} as UIMachineContext,
    events: {} as UIMachineEvent,
    emitted: {} as EmittedEvent,
  },
  actions: {
    initializeContext: assign(({ event }) => {
      assertEvent(event, 'INITIALIZE');
      return {
        localPlayerId: event.localPlayerId,
        gameId: event.gameId,
      };
    }),
    setCurrentGameState: assign({
      currentGameState: ({ event }) => {
        assertEvent(event, ['GAME_STATE_RECEIVED', 'CLIENT_GAME_STATE_UPDATED']);
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
      }
    }),
    addChatMessage: assign({
      chatMessages: ({ context, event }) => {
        assertEvent(event, 'NEW_CHAT_MESSAGE');
        return [...context.chatMessages, event.chatMessage];
      },
    }),
    logGameEventToast: ({ event }) => {
      assertEvent(event, 'NEW_GAME_LOG');
      if (event.logMessage.type !== 'info' && event.logMessage.message.includes('turn')) {
        toast.info(event.logMessage.message, { position: 'top-center' });
      }
    },
    showToastFromChatMessage: ({ event }) => {
      assertEvent(event, 'NEW_CHAT_MESSAGE');
      toast(event.chatMessage.message, {
        description: `From ${event.chatMessage.senderName}`,
        position: 'bottom-left',
      });
    },
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
    // All actions that emit to the socket
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
    emitAcknowledgePeek: emit({
      type: 'EMIT_TO_SOCKET',
      eventName: SocketEventName.PLAYER_ACTION,
      payload: { type: PlayerActionType.ACKNOWLEDGE_PEEK },
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
        payload: { type: PlayerActionType.SWAP_AND_DISCARD, handCardIndex: event.handCardIndex },
      };
    }),
    emitPlayerAction: emit(({ event }) => {
      assertEvent(event, 'PLAYER_ACTION_CLICKED');
      return { type: 'EMIT_TO_SOCKET' as const, eventName: SocketEventName.PLAYER_ACTION, payload: event.action };
    }),
    emitChatMessage: emit(({ event }) => {
      assertEvent(event, 'SUBMIT_CHAT_MESSAGE');
      const { type, ...payload } = event;
      return { type: 'EMIT_TO_SOCKET' as const, eventName: SocketEventName.SEND_CHAT_MESSAGE, payload };
    }),
  },
  guards: {
    isLocalPlayerTurn: ({ context }) => {
      return context.currentGameState?.currentPlayerId === context.localPlayerId;
    },
    hasDrawnCard: ({ context }) => {
        const localPlayer = context.localPlayerId ? context.currentGameState?.players[context.localPlayerId] : undefined;
        return !!localPlayer?.pendingDrawnCard;
    },
    isInitialPeeking: ({ context }) => {
        return context.currentGameState?.currentPhase === 'initialPeekPhase';
    },
  },
}).createMachine({
  id: 'ui',
  type: 'parallel',
  context: {
    localPlayerId: null,
    gameId: null,
    currentGameState: null,
    selectedHandCardIndex: null,
    abilityContext: null,
    activeAnimationCue: null,
    modal: null,
    toasts: [],
    gameLog: [],
    chatMessages: [],
    isSidePanelOpen: true,
  },
  on: {
    CLIENT_GAME_STATE_UPDATED: {
      target: '.game.routing',
      actions: 'setCurrentGameState',
    },
    NEW_GAME_LOG: { actions: ['addGameLog', 'logGameEventToast'] },
    INITIAL_LOGS_RECEIVED: { actions: 'setInitialLogs' },
    NEW_CHAT_MESSAGE: { actions: ['addChatMessage', 'showToastFromChatMessage'] },
    ERROR_RECEIVED: { actions: 'showErrorModal' },
    TOGGLE_SIDE_PANEL: {
      actions: assign({
        isSidePanelOpen: ({ context }) => !context.isSidePanelOpen,
      }),
    },
  },
  states: {
    socket: {
      initial: 'connecting',
      states: {
        connecting: {
          on: { CONNECT: 'connected' },
        },
        connected: {
          on: { DISCONNECT: 'disconnected' },
        },
        disconnected: {
          on: { CONNECT: 'connected' },
        },
      },
    },
    game: {
      on: {
        INITIALIZE: {
          target: '.loading',
          actions: ['initializeContext'],
        },
        DRAW_FROM_DECK_CLICKED: {
          target: '.awaitingServerResponse',
          actions: 'emitDrawFromDeck',
        },
        DRAW_FROM_DISCARD_CLICKED: {
          target: '.awaitingServerResponse',
          actions: 'emitDrawFromDiscard',
        },
        DECLARE_READY_FOR_PEEK_CLICKED: {
          target: '.awaitingServerResponse',
          actions: 'emitReadyForInitialPeek',
        },
        PLAYER_ACTION_CLICKED: {
          target: '.awaitingServerResponse',
          actions: 'emitPlayerAction',
        },
        INITIAL_PEEK_ACKNOWLEDGED_CLICKED: {
          actions: 'emitAcknowledgePeek',
        },
        SUBMIT_CHAT_MESSAGE: { actions: 'emitChatMessage' },
      },
      initial: 'uninitialized',
      states: {
        uninitialized: {},
        loading: {
          // This state waits for the first GAME_STATE_UPDATE
        },
        routing: {
          always: [
            { target: 'lobby', guard: ({ context }) => context.currentGameState?.currentPhase === 'awaitingPlayers' },
            { target: 'initialPeek', guard: ({ context }) => context.currentGameState?.currentPhase === 'initialPeekPhase' },
            { target: 'playing', guard: ({ context }) => ['playPhase', 'finalTurnsPhase'].includes(context.currentGameState?.currentPhase ?? '') },
            { target: 'matching', guard: ({ context }) => context.currentGameState?.currentPhase === 'matchingStage' },
            { target: 'abilityResolution', guard: ({ context }) => context.currentGameState?.currentPhase === 'abilityResolutionPhase' },
            { target: 'gameOver', guard: ({ context }) => ['scoringPhase', 'gameOver'].includes(context.currentGameState?.currentPhase ?? '') },
            // Fallback if we have a game state but no matching phase
            { target: 'lobby', guard: ({ context }) => !!context.currentGameState },
            // If we have no game state at all, go to loading
            { target: 'loading' }
          ]
        },
        lobby: {},
        initialPeek: {},
        playing: {},
        matching: {},
        abilityResolution: {},
        gameOver: {},
        awaitingServerResponse: {
          // After sending an action, wait here. The CLIENT_GAME_STATE_UPDATED
          // event at the root will receive the server's response and
          // push us back to the 'routing' state.
        },
      },
    },
  },
});

export type UIMachineActorRef = ActorRefFrom<typeof uiMachine>;
export type UIMachineState = SnapshotFrom<typeof uiMachine>;