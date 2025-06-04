import { setup, assign, ActorRefFrom } from 'xstate';
import { PlayerActionType } from '@shared';
import type { ClientCheckGameState, ConcretePlayerActionEvents, Card, PlayerId, RichGameLogMessage } from '@shared';

// --- Placeholder & Helper Types ---
export type AnimationCue =
  | { type: 'CARD_DRAWN_TO_HAND'; playerId: PlayerId; cardIndex: number; card: Card; from: 'deck' | 'discard' }
  | { type: 'CARD_DISCARDED_FROM_HAND'; playerId: PlayerId; cardIndex: number; card: Card }
  | { type: 'CARD_SWAPPED_IN_HAND'; playerId: PlayerId; cardIndex: number; newCard: Card; oldCard: Card }
  | { type: 'CARD_REVEALED'; playerId: PlayerId; cardIndex: number; card: Card; duration?: number }
  | { type: 'PLAYER_HAND_EXPANDED'; playerId: PlayerId; newSize: number }
  | { type: 'DECK_SHUFFLED' }
  | { type: 'DISCARD_PILE_UPDATED'; topCard: Card | null; previousTopCard?: Card | null }
  | { type: 'ABILITY_TARGET_HIGHLIGHT'; targets: { playerId: PlayerId; cardIndex: number }[] }
  | { type: 'GAME_EVENT_EMPHASIS'; eventType: RichGameLogMessage['type'] } // e.g., for "Check!" call
  | { type: 'OTHER'; message: string }; // Generic cue

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

// To be observed by React layer to call usePlayerInput hook
export type ServerActionToPerform = ConcretePlayerActionEvents;

// --- XState Machine Definition ---

export interface UIMachineContext {
  localPlayerId: PlayerId | null;
  gameId: string | null;
  currentGameState: ClientCheckGameState | null;
  selectedHandCardIndex: number | null; // Player clicks a card in their own hand
  abilityContext: AbilityContextContent | null; // Context for multi-step abilities
  activeAnimationCue: AnimationCue | null; // For triggering animations
  modal: ModalPayload | null;
  toasts: ToastPayload[];
  _serverActionToPerform: ServerActionToPerform | null; // Action to be sent to server by React layer
}

export type UIMachineEvent =
  // Core
  | { type: 'INITIALIZE'; localPlayerId: PlayerId; gameId: string }
  | { type: 'GAME_STATE_RECEIVED'; gameState: ClientCheckGameState }
  | { type: 'SERVER_ACTION_SENT'; actionType: ServerActionToPerform['type'] } // After _serverActionToPerform is handled by React
  | { type: 'CLEAR_SERVER_ACTION' }

  // User Interactions (UI Clicks)
  | { type: 'DRAW_FROM_DECK_CLICKED' }
  | { type: 'DRAW_FROM_DISCARD_CLICKED' }
  | { type: 'HAND_CARD_CLICKED'; cardIndex: number }
  | { type: 'PLAYER_SLOT_CLICKED'; playerId: PlayerId; cardIndex: number } // For targeting other players' cards or empty slots
  | { type: 'DISCARD_SELECTED_HAND_CARD_CONFIRMED' } // After drawing, to discard the drawn card
  | { type: 'SWAP_WITH_SELECTED_HAND_CARD_CONFIRMED' } // After drawing, to swap with hand card
  | { type: 'CALL_CHECK_CLICKED' }
  | { type: 'PASS_MATCH_CLICKED' }
  | { type: 'ATTEMPT_MATCH_WITH_SELECTED_CARD_CLICKED' }

  // Ability Flow
  | { type: 'START_ABILITY'; ability: AbilityContextContent['type'] } // e.g. when player's turn for ability starts
  | { type: 'ABILITY_CARD_TARGET_SELECTED'; playerId: PlayerId; cardIndex: number; card: Card } // Universal for peek/swap target
  | { type: 'ABILITY_CONFIRM_ACTION' } // e.g. Confirm swap
  | { type: 'ABILITY_CANCEL_ACTION' } // Cancel current ability step / entire ability
  | { type: 'ABILITY_SKIP_PEEK' }
  | { type: 'ABILITY_SKIP_SWAP' }
  | { type: 'RESOLVE_ABILITY_SUCCESS' } // When server confirms ability resolution

  // UI Management
  | { type: 'SHOW_TOAST'; toast: Omit<ToastPayload, 'id'> }
  | { type: 'DISMISS_TOAST'; toastId: string }
  | { type: 'SHOW_MODAL'; modal: ModalPayload }
  | { type: 'DISMISS_MODAL' }
  | { type: 'TRIGGER_ANIMATION'; cue: AnimationCue }
  | { type: 'ANIMATION_COMPLETED'; cueType: AnimationCue['type'] };


export const uiMachine = setup({
  types: {
    context: {} as UIMachineContext,
    events: {} as UIMachineEvent,
  },
  actions: {
    assignGameState: assign({
      currentGameState: ({ event }) => {
        if (event.type === 'GAME_STATE_RECEIVED') return event.gameState;
        // This path should ideally not be taken if machine logic is correct
        // For type safety, ensure context.currentGameState is not null when accessed
        return null; 
      },
    }),
    assignLocalPlayerInfo: assign({
        localPlayerId: ({event}) => (event as Extract<UIMachineEvent, {type: 'INITIALIZE'}>).localPlayerId,
        gameId: ({event}) => (event as Extract<UIMachineEvent, {type: 'INITIALIZE'}>).gameId,
    }),
    setServerAction: assign({
      _serverActionToPerform: ({ event }, params: ServerActionToPerform | null) => params,
    }),
    clearServerAction: assign({
      _serverActionToPerform: null,
    }),
    setSelectedHandCardIndex: assign({
        selectedHandCardIndex: ({event}) => (event as Extract<UIMachineEvent, {type: 'HAND_CARD_CLICKED'}>).cardIndex
    }),
    clearSelectedHandCardIndex: assign({
        selectedHandCardIndex: null
    }),
    showToast: assign({
      toasts: ({ context, event }) => {
        const toastEvent = event as Extract<UIMachineEvent, {type: 'SHOW_TOAST'}>;
        return [...context.toasts, { ...toastEvent.toast, id: new Date().toISOString() }];
      },
    }),
    dismissToast: assign({
      toasts: ({ context, event }) => {
        const toastId = (event as Extract<UIMachineEvent, {type: 'DISMISS_TOAST'}>).toastId;
        return context.toasts.filter((t) => t.id !== toastId);
      },
    }),
    showModal: assign({
      modal: ({ event }) => (event as Extract<UIMachineEvent, {type: 'SHOW_MODAL'}>).modal,
    }),
    dismissModal: assign({
      modal: null,
    }),
    setAnimationCue: assign({
      activeAnimationCue: ({ event }) => (event as Extract<UIMachineEvent, {type: 'TRIGGER_ANIMATION'}>).cue,
    }),
    clearAnimationCue: assign({
      activeAnimationCue: null,
    }),
    initializeAbilityContext: assign({
        abilityContext: ({ event }) => {
            const abilityEvent = event as Extract<UIMachineEvent, { type: 'START_ABILITY' }>;
            const abilityType = abilityEvent.ability;
            if (abilityType === 'king') {
                return { type: 'king', step: 'peeking1', peekedCardsInfo: [], swapSlots: {} } satisfies Extract<AbilityContextContent, {type: 'king'}>;
            }
            if (abilityType === 'queen') {
                return { type: 'queen', step: 'peeking', swapSlots: {} } satisfies Extract<AbilityContextContent, {type: 'queen'}>;
            }
            if (abilityType === 'jack') {
                return { type: 'jack', step: 'swapping1', swapSlots: {} } satisfies Extract<AbilityContextContent, {type: 'jack'}>;
            }
            return null;
        }
    }),
    clearAbilityContext: assign({
        abilityContext: null,
    }),
    // More specific ability context update actions will be needed here
  },
  guards: {
    isPlayerTurn: ({ context }) => {
        const gs = context.currentGameState;
        return !!gs && !!context.localPlayerId && gs.currentPlayerId === context.localPlayerId && gs.currentPhase !== 'gameOver';
    },
    // Add more guards: canCallCheck, canDrawFromDeck, canDrawFromDiscard, etc.
    // isAbilityTargetingPhase: ({context}) => !!context.abilityContext && (context.abilityContext.step.startsWith('peeking') || context.abilityContext.step.startsWith('swapping'))
  },
}).createMachine(
  {
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
      _serverActionToPerform: null,
    },
    initial: 'initializing',
    states: {
      initializing: {
        on: {
          INITIALIZE: {
            target: 'idle',
            actions: ['assignLocalPlayerInfo'],
          },
        },
      },
      idle: {
        on: {
          GAME_STATE_RECEIVED: {
            actions: [
                'assignGameState',
            ],
          },
          SERVER_ACTION_SENT: 'awaitingServerResponse',
          CLEAR_SERVER_ACTION: { actions: ['clearServerAction'] },

          DRAW_FROM_DECK_CLICKED: {
            actions: [
                { type: 'setServerAction', params: ({ context }: { context: UIMachineContext }) => ({
                    type: PlayerActionType.DRAW_FROM_DECK,
                    playerId: context.localPlayerId!,
                } satisfies ServerActionToPerform)}
            ],
          },
          DRAW_FROM_DISCARD_CLICKED: {
            actions: [
                { type: 'setServerAction', params: ({ context }: { context: UIMachineContext }) => ({
                    type: PlayerActionType.DRAW_FROM_DISCARD,
                    playerId: context.localPlayerId!,
                } satisfies ServerActionToPerform)}
            ],
          },
          CALL_CHECK_CLICKED: {
            actions: [
                { type: 'setServerAction', params: ({ context }: { context: UIMachineContext }) => ({
                    type: PlayerActionType.CALL_CHECK,
                    playerId: context.localPlayerId!,
                } satisfies ServerActionToPerform)}
            ],
          },
          PASS_MATCH_CLICKED: {
            actions: [
                { type: 'setServerAction', params: ({ context }: { context: UIMachineContext }) => ({
                    type: PlayerActionType.PASS_MATCH,
                    playerId: context.localPlayerId!,
                } satisfies ServerActionToPerform)}
            ],
          },
          ATTEMPT_MATCH_WITH_SELECTED_CARD_CLICKED: {
            actions: [
                { type: 'setServerAction', params: ({ context }: { context: UIMachineContext }) => {
                    if (context.localPlayerId && context.selectedHandCardIndex !== null) {
                        return {
                            type: PlayerActionType.ATTEMPT_MATCH,
                            playerId: context.localPlayerId!,
                            handIndex: context.selectedHandCardIndex
                        } satisfies ServerActionToPerform;
                    }
                    return null; // Or handle error appropriately
                }},
                'clearSelectedHandCardIndex',
            ],
          },

          HAND_CARD_CLICKED: {
            actions: ['setSelectedHandCardIndex'],
          },
          
          START_ABILITY: [
            { target: 'abilityActive', actions: ['initializeAbilityContext'] }
          ],

          SHOW_TOAST: { actions: 'showToast' },
          DISMISS_TOAST: { actions: 'dismissToast' },
          SHOW_MODAL: { actions: 'showModal' },
          DISMISS_MODAL: { actions: 'dismissModal' },
          TRIGGER_ANIMATION: { actions: 'setAnimationCue' },
          ANIMATION_COMPLETED: { actions: 'clearAnimationCue' },
        },
      },
      awaitingServerResponse: {
        entry: ['clearServerAction'],
        on: {
          GAME_STATE_RECEIVED: { 
            target: 'idle',
            actions: ['assignGameState'],
          },
        },
      },
      abilityActive: {
        on: {
            GAME_STATE_RECEIVED: {
                actions: ['assignGameState'],
            },
            ABILITY_CARD_TARGET_SELECTED: {
            },
            ABILITY_CONFIRM_ACTION: {
            },
            ABILITY_CANCEL_ACTION: {
                actions: ['clearAbilityContext'],
                target: 'idle',
            },
            ABILITY_SKIP_PEEK: {
            },
            ABILITY_SKIP_SWAP: {
            },
            RESOLVE_ABILITY_SUCCESS: { 
                actions: ['clearAbilityContext'],
                target: 'idle'
            },
            SERVER_ACTION_SENT: 'awaitingServerResponse', 
        }
      }
    },
  }
);

export type UIMachineActor = ActorRefFrom<typeof uiMachine>;
export type UIMachineLogic = typeof uiMachine; 