import { setup, assign, ActorRefFrom, emit, fromPromise, sendTo } from 'xstate';
import {
  PlayerId,
  Card,
  ClientCheckGameState,
  RichGameLogMessage,
  ChatMessage,
  ConcretePlayerActionEvents,
  PlayerActionType,
} from 'shared-types';

// --- Type Definitions ---

export type AnimationCue =
  | { type: 'CARD_DRAWN_TO_HAND'; playerId: PlayerId; cardIndex: number; card: Card; from: 'deck' | 'discard' }
  | { type: 'CARD_DISCARDED_FROM_HAND'; playerId: PlayerId; cardIndex: number; card: Card }
  | { type: 'CARD_SWAPPED_IN_HAND'; playerId: PlayerId; cardIndex: number; newCard: Card; oldCard: Card }
  | { type: 'CARD_REVEALED'; playerId: PlayerId; cardIndex: number; card: Card; duration?: number }
  | { type: 'PLAYER_HAND_EXPANDED'; playerId: PlayerId; newSize: number }
  | { type: 'DECK_SHUFFLED' }
  | { type: 'DISCARD_PILE_UPDATED'; topCard: Card | null; previousTopCard?: Card | null }
  | { type: 'ABILITY_TARGET_HIGHLIGHT'; targets: { playerId: PlayerId; cardIndex: number }[] }
  | { type: 'GAME_EVENT_EMPHASIS'; eventType: RichGameLogMessage['type'] }
  | { type: 'OTHER'; message: string };

export type ModalPayload =
  | { type: 'INFO'; title: string; message: string; confirmText?: string; }
  | { type: 'CONFIRMATION'; title: string; message: string; confirmText?: string; cancelText?: string; onConfirmEvent: UIMachineEvent['type']; onCancelEvent?: UIMachineEvent['type']; eventPayload?: any }
  | { type: 'ERROR'; title: string; message: string; confirmText?: string; }
  | { type: 'ABILITY_CHOICE'; title: string; message: string; choices: { text: string; event: UIMachineEvent['type'], payload?: any }[] };

export type ToastPayload = {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  duration?: number;
};

export type AbilityContextContent =
  | {
      type: 'king';
      step: 'peeking1' | 'peeking2' | 'swapping1' | 'swapping2' | 'confirmingSwap' | 'done';
      peekedCardsInfo?: { playerId: PlayerId, cardIndex: number, card: Card }[];
      swapSlots?: {
        slot1?: { playerId: PlayerId, cardIndex: number, card: Card };
        slot2?: { playerId: PlayerId, cardIndex: number, card: Card };
      };
    }
  | {
      type: 'queen';
      step: 'peeking' | 'swapping1' | 'swapping2' | 'confirmingSwap' | 'done';
      peekedCardInfo?: { playerId: PlayerId, cardIndex: number, card: Card };
      swapSlots?: {
        slot1?: { playerId: PlayerId, cardIndex: number, card: Card };
        slot2?: { playerId: PlayerId, cardIndex: number, card: Card };
      };
    }
  | {
      type: 'jack';
      step: 'swapping1' | 'swapping2' | 'confirmingSwap' | 'done';
      swapSlots?: {
        slot1?: { playerId: PlayerId, cardIndex: number, card: Card };
        slot2?: { playerId: PlayerId, cardIndex: number, card: Card };
      };
    };

export type ServerActionToPerform = ConcretePlayerActionEvents;

// --- XState Machine Definition ---

export interface UIMachineContext {
  localPlayerId: PlayerId | null;
  gameId: string | null;
  currentGameState: ClientCheckGameState | null;
  selectedHandCardIndex: number | null;
  abilityContext: AbilityContextContent | null;
  activeAnimationCue: AnimationCue | null;
  modal: ModalPayload | null;
  toasts: ToastPayload[];
}

export type UIMachineEvent =
// Core
| { type: 'INITIALIZE'; localPlayerId: PlayerId; gameId: string }
| { type: 'GAME_STATE_RECEIVED'; gameState: ClientCheckGameState } // For direct state setting if ever needed
// Server Pushed Events (handled by provider, sent to machine)
| { type: 'CLIENT_GAME_STATE_UPDATED'; gameState: ClientCheckGameState }
| { type: 'NEW_GAME_LOG'; logMessage: RichGameLogMessage }
| { type: 'NEW_CHAT_MESSAGE'; chatMessage: ChatMessage }
| { type: 'ERROR_RECEIVED'; error: string }
// User Interactions (UI Clicks)
| { type: 'DRAW_FROM_DECK_CLICKED' }
| { type: 'DRAW_FROM_DISCARD_CLICKED' }
| { type: 'HAND_CARD_CLICKED'; cardIndex: number } // For local player's hand selection
| { type: 'DISCARD_SELECTED_HAND_CARD_CONFIRMED' }
| { type: 'SWAP_WITH_SELECTED_HAND_CARD_CONFIRMED' }
| { type: 'CALL_CHECK_CLICKED' }
| { type: 'PASS_MATCH_CLICKED' }
| { type: 'ATTEMPT_MATCH_WITH_SELECTED_CARD_CLICKED'; cardId: string }
| { type: 'READY_FOR_INITIAL_PEEK_CLICKED' }
| { type: 'INITIAL_PEEK_ACKNOWLEDGED_CLICKED' }
// Actions on a pending drawn card
| { type: 'CONFIRM_SWAP_PENDING_CARD_WITH_HAND'; handCardIndex: number }
| { type: 'CONFIRM_DISCARD_PENDING_DRAWN_CARD' }
// Ability Flow
| { type: 'START_ABILITY'; ability: AbilityContextContent['type'] }
// | { type: 'ABILITY_CARD_TARGET_SELECTED'; playerId: PlayerId; cardIndex: number; card: Card } // Replaced by new flow
| { type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY'; targetPlayerId: PlayerId; cardIndex: number } // New: User clicks a slot for ability
| { type: 'SERVER_PROVIDED_CARD_FOR_ABILITY'; card: Card; playerId: PlayerId; cardIndex: number } // New: Server sends card details for that slot
| { type: 'ABILITY_CONFIRM_ACTION' }
| { type: 'ABILITY_CANCEL_ACTION' }
| { type: 'ABILITY_SKIP_PEEK' }
| { type: 'ABILITY_SKIP_SWAP' }
| { type: 'RESOLVE_ABILITY_SUCCESS' } // Event from server after ability resolution
// UI Management
| { type: 'SHOW_TOAST'; toast: Omit<ToastPayload, 'id'> }
| { type: 'DISMISS_TOAST'; toastId: string }
| { type: 'SHOW_MODAL'; modal: ModalPayload }
| { type: 'SHOW_CONFIRM_MODAL'; modalPayload: ModalPayload; }
| { type: 'DISMISS_MODAL' }
| { type: 'TRIGGER_ANIMATION'; cue: AnimationCue }
| { type: 'ANIMATION_COMPLETED'; cueType: AnimationCue['type'] }
// Chat
| { type: 'SUBMIT_CHAT_MESSAGE'; message: string; senderId: PlayerId; senderName: string; gameId: string };


export const uiMachine = setup({
  types: {
    context: {} as UIMachineContext,
    events: {} as UIMachineEvent,
  },
  actions: {
    setCurrentGameState: assign({
      currentGameState: ({ event }) => {
        const gameStateEvent = event as { type: 'CLIENT_GAME_STATE_UPDATED', gameState: ClientCheckGameState };
        return gameStateEvent.gameState;
      }
    }),
    clearSelectedHandCard: assign({
      selectedHandCardIndex: null,
    }),
  },
  guards: {
    isCurrentPlayer: ({ context }: { context: UIMachineContext }) => context.localPlayerId === context.currentGameState?.currentPlayerId,
    isPlayersTurnAndInDrawPhase: ({ context }: { context: UIMachineContext }) =>
      context.localPlayerId === context.currentGameState?.currentPlayerId &&
      context.currentGameState?.currentPhase === 'playPhase',
    canDrawFromDeck: ({ context }: { context: UIMachineContext }) => {
      if (!context.localPlayerId || !context.currentGameState) return false;
      const player = context.currentGameState.players[context.localPlayerId];
      return (
        context.currentGameState.currentPlayerId === context.localPlayerId &&
        context.currentGameState.currentPhase === 'playPhase' &&
        !player?.pendingDrawnCard
      );
    },
    canDrawFromDiscard: ({ context }: { context: UIMachineContext }) => {
      if (!context.localPlayerId || !context.currentGameState) return false;
      const player = context.currentGameState.players[context.localPlayerId];
      return (
        context.currentGameState.currentPlayerId === context.localPlayerId &&
        context.currentGameState.currentPhase === 'playPhase' &&
        !player?.pendingDrawnCard &&
        !context.currentGameState.topDiscardIsSpecialOrUnusable
      );
    },
    isHoldingCard: ({ context }: { context: UIMachineContext }) => {
      if (!context.localPlayerId || !context.currentGameState) return false;
      const player = context.currentGameState.players[context.localPlayerId];
      return !!player?.pendingDrawnCard;
    },
    hasSelectedHandCard: ({ context }: { context: UIMachineContext }) => context.selectedHandCardIndex !== null,
    isValidSwapWithPendingCard: ({ context }: { context: UIMachineContext }) => {
      if (!context.localPlayerId || !context.currentGameState || context.selectedHandCardIndex === null) return false;
      const playerState = context.currentGameState.players[context.localPlayerId];
      if (!playerState || !playerState.pendingDrawnCard) return false;
      return context.selectedHandCardIndex >= 0 && context.selectedHandCardIndex < playerState.hand.length;
    },
    canDiscardPendingDrawnCard: ({ context }: { context: UIMachineContext }) => {
      if (!context.localPlayerId || !context.currentGameState) return false;
      const playerState = context.currentGameState.players[context.localPlayerId];
      return !!playerState && playerState.pendingDrawnCardSource === 'deck';
    },
    canAttemptMatch: ({ context }: { context: UIMachineContext }) => {
      if (!context.localPlayerId || !context.currentGameState || context.selectedHandCardIndex === null) return false;
      const playerState = context.currentGameState.players[context.localPlayerId];
      if (!playerState) return false;
      return context.selectedHandCardIndex >= 0 && context.selectedHandCardIndex < playerState.hand.length;
    },
    canCallCheck: ({ context }: { context: UIMachineContext }) => {
      if (!context.localPlayerId || !context.currentGameState) return false;
      const player = context.currentGameState.players[context.localPlayerId];
      if (!player) return false;
      return (
        context.currentGameState.currentPlayerId === context.localPlayerId &&
        context.currentGameState.currentPhase === 'playPhase' &&
        !player.hasCalledCheck &&
        !player.pendingDrawnCard
      );
    },
    canPassMatch: ({ context }: { context: UIMachineContext }) => {
      if (!context.localPlayerId || !context.currentGameState) return false;
      return context.currentGameState.currentPhase === 'matchingStage' ||
            (!!context.currentGameState.matchingOpportunityInfo &&
            context.currentGameState.matchingOpportunityInfo.potentialMatchers.includes(context.localPlayerId));
    },
  }
}).createMachine({
  id: 'uiMachine',
  context: {
    localPlayerId: null,
    gameId: null,
    currentGameState: null,
    selectedHandCardIndex: null,
    abilityContext: null,
    activeAnimationCue: null,
    modal: null,
    toasts: [],
  },
  initial: 'initializing',
  states: {
    initializing: {
      on: {
        INITIALIZE: {
          target: 'idle',
          actions: assign({
            localPlayerId: ({ event }) => event.localPlayerId,
            gameId: ({ event }) => event.gameId,
          }),
        },
      },
    },
    idle: {
      on: {
        CLIENT_GAME_STATE_UPDATED: {
          actions: ['setCurrentGameState', 'clearSelectedHandCard'],
        },
        DRAW_FROM_DECK_CLICKED: {
          target: 'awaitingServerResponse',
          guard: 'canDrawFromDeck',
          actions: emit(({ context }) => ({
            type: 'EMIT_TO_SOCKET',
            eventName: PlayerActionType.DRAW_FROM_DECK,
            payload: {
              type: PlayerActionType.DRAW_FROM_DECK,
              playerId: context.localPlayerId!,
              gameId: context.gameId!,
            } as ServerActionToPerform,
          })),
        },
        DRAW_FROM_DISCARD_CLICKED: {
          target: 'awaitingServerResponse',
          guard: 'canDrawFromDiscard',
          actions: emit(({ context }) => ({
            type: 'EMIT_TO_SOCKET',
            eventName: PlayerActionType.DRAW_FROM_DISCARD,
            payload: {
              type: PlayerActionType.DRAW_FROM_DISCARD,
              playerId: context.localPlayerId!,
              gameId: context.gameId!,
            } as ServerActionToPerform,
          })),
        },
        CALL_CHECK_CLICKED: {
          target: 'awaitingServerResponse',
          guard: 'canCallCheck',
          actions: emit(({ context }) => ({
            type: 'EMIT_TO_SOCKET',
            eventName: PlayerActionType.CALL_CHECK,
            payload: {
              type: PlayerActionType.CALL_CHECK,
              playerId: context.localPlayerId!,
              gameId: context.gameId!,
            } as ServerActionToPerform,
          })),
        },
      },
    },
    awaitingServerResponse: {
      on: {
        CLIENT_GAME_STATE_UPDATED: {
          target: 'idle',
          actions: ['setCurrentGameState', 'clearSelectedHandCard'],
        },
        ERROR_RECEIVED: {
          target: 'idle',
          // actions: ['showErrorToast'],
        },
      },
    },
  },
});

export type UIMachineActor = ActorRefFrom<typeof uiMachine>;
export type UIMachineLogic = typeof uiMachine; 