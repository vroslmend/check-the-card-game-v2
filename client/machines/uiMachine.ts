import { setup, assign, ActorRefFrom, emit } from 'xstate';
import { PlayerActionType } from '@shared';
import type { ClientCheckGameState, ConcretePlayerActionEvents, Card, PlayerId, RichGameLogMessage, ChatMessage, AbilityArgs } from '@shared';

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
  | { type: 'HAND_CARD_CLICKED'; cardIndex: number }
  | { type: 'PLAYER_SLOT_CLICKED'; playerId: PlayerId; cardIndex: number }
  | { type: 'DISCARD_SELECTED_HAND_CARD_CONFIRMED' }
  | { type: 'SWAP_WITH_SELECTED_HAND_CARD_CONFIRMED' }
  | { type: 'CALL_CHECK_CLICKED' }
  | { type: 'PASS_MATCH_CLICKED' }
  | { type: 'ATTEMPT_MATCH_WITH_SELECTED_CARD_CLICKED' }
  | { type: 'READY_FOR_INITIAL_PEEK_CLICKED' }
  | { type: 'INITIAL_PEEK_ACKNOWLEDGED_CLICKED' }
  // Actions on a pending drawn card (after DRAW_FROM_DECK/DISCARD resolves and pendingDrawnCard is set in context.currentGameState)
  | { type: 'CONFIRM_SWAP_PENDING_CARD_WITH_HAND'; handCardIndex: number }
  | { type: 'CONFIRM_DISCARD_PENDING_DRAWN_CARD' }
  // Ability Flow
  | { type: 'START_ABILITY'; ability: AbilityContextContent['type'] }
  | { type: 'ABILITY_CARD_TARGET_SELECTED'; playerId: PlayerId; cardIndex: number; card: Card }
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
  | { type: 'ANIMATION_COMPLETED'; cueType: AnimationCue['type'] };

export const uiMachine = setup({
  types: {
    context: {} as UIMachineContext,
    events: {} as UIMachineEvent,
    emitted: {} as { type: 'EMIT_TO_SOCKET'; eventName: string; payload: any },
  },
  actions: {
    initializeContext: assign({
      localPlayerId: ({ event }) => (event as Extract<UIMachineEvent, { type: 'INITIALIZE' }>).localPlayerId,
      gameId: ({ event }) => (event as Extract<UIMachineEvent, { type: 'INITIALIZE' }>).gameId,
    }),
    setCurrentGameState: assign({
      currentGameState: ({ event }) => (event as Extract<UIMachineEvent, { type: 'CLIENT_GAME_STATE_UPDATED' }>).gameState,
    }),
    setSelectedHandCardIndex: assign({
      selectedHandCardIndex: ({ event }) => (event as Extract<UIMachineEvent, { type: 'HAND_CARD_CLICKED' }>).cardIndex,
    }),
    clearSelectedHandCardIndex: assign({
      selectedHandCardIndex: null,
    }),
    initializeAbilityContext: assign({
      abilityContext: ({ event }) => {
        const abilityEvent = event as Extract<UIMachineEvent, { type: 'START_ABILITY' }>;
        const abilityType = abilityEvent.ability;
        if (abilityType === 'king') {
          return { type: 'king', step: 'peeking1', peekedCardsInfo: [], swapSlots: {} } satisfies Extract<AbilityContextContent, { type: 'king' }>;
        }
        if (abilityType === 'queen') {
          return { type: 'queen', step: 'peeking', peekedCardInfo: undefined, swapSlots: {} } satisfies Extract<AbilityContextContent, { type: 'queen' }>;
        }
        if (abilityType === 'jack') {
          return { type: 'jack', step: 'swapping1', swapSlots: {} } satisfies Extract<AbilityContextContent, { type: 'jack' }>;
        }
        return null;
      }
    }),
    updateAbilityPeekedInfo: assign({
      abilityContext: ({ context, event }) => {
        if (!context.abilityContext) return null;
        const { card, cardIndex, playerId } = event as Extract<UIMachineEvent, { type: 'ABILITY_CARD_TARGET_SELECTED' }>;

        if (context.abilityContext.type === 'king' && (context.abilityContext.step === 'peeking1' || context.abilityContext.step === 'peeking2')) {
          const currentPeeked = context.abilityContext.peekedCardsInfo || [];
          if (currentPeeked.length < 2) {
            const newPeekedItem = { card, cardIndex: cardIndex, playerId };
            return { ...context.abilityContext, peekedCardsInfo: [...currentPeeked, newPeekedItem] };
          }
        }
        if (context.abilityContext.type === 'queen' && context.abilityContext.step === 'peeking') {
          return { ...context.abilityContext, peekedCardInfo: { card, cardIndex: cardIndex, playerId } };
        }
        return context.abilityContext;
      }
    }),
    updateAbilitySwapSlot: assign({
      abilityContext: ({ context, event }) => {
        if (!context.abilityContext) return null;
        if (!['swapping1', 'swapping2'].includes(context.abilityContext.step)) return context.abilityContext;
        // Ensure the ability type is one that uses swapSlots in this manner
        if (context.abilityContext.type !== 'jack' && context.abilityContext.type !== 'king' && context.abilityContext.type !== 'queen') return context.abilityContext;

        const { card, cardIndex, playerId } = event as Extract<UIMachineEvent, { type: 'ABILITY_CARD_TARGET_SELECTED' }>;
        
        const currentSwapSlots = context.abilityContext.swapSlots || { slot1: undefined, slot2: undefined };
        const newSwapSlots = { ...currentSwapSlots };

        if (!newSwapSlots.slot1) {
          newSwapSlots.slot1 = { card, cardIndex, playerId };
        } else if (!newSwapSlots.slot2) {
          // Avoid selecting the exact same card instance for both slots
          if (newSwapSlots.slot1.playerId === playerId && newSwapSlots.slot1.cardIndex === cardIndex && newSwapSlots.slot1.card.id === card.id) {
            return context.abilityContext; 
          }
          newSwapSlots.slot2 = { card, cardIndex, playerId };
        }
        return { ...context.abilityContext, swapSlots: newSwapSlots };
      }
    }),
    showToast: assign({
      toasts: ({ context, event }) => {
        const toastEvent = event as Extract<UIMachineEvent, { type: 'SHOW_TOAST' }>;
        return [...context.toasts, { ...toastEvent.toast, id: new Date().toISOString() }];
      }
    }),
    dismissToast: assign({
      toasts: ({ context, event }) => {
        const toastId = (event as Extract<UIMachineEvent, { type: 'DISMISS_TOAST' }>).toastId;
        return context.toasts.filter((t: ToastPayload) => t.id !== toastId);
      }
    }),
    setAnimationCue: assign({
      activeAnimationCue: ({ event }) => (event as Extract<UIMachineEvent, { type: 'TRIGGER_ANIMATION' }>).cue,
    }),
    clearAnimationCue: assign({
      activeAnimationCue: null,
    }),
    setModal: assign({
      modal: ({ event }) => {
        const modalEvent = event as Extract<UIMachineEvent, { type: 'SHOW_MODAL' }>;
        return modalEvent.modal; 
      }
    }),
    clearModal: assign({ modal: null }),

    logGameEventToast: assign({
      toasts: ({ context, event }) => {
        const gameLogEvent = event as Extract<UIMachineEvent, { type: 'NEW_GAME_LOG' }>;
        return [...context.toasts, { id: Date.now().toString(), type: 'info', message: gameLogEvent.logMessage.message, duration: 3000 } satisfies ToastPayload];
      }
    }),
    showToastFromChatMessage: assign({
      toasts: ({ context, event }) => {
        const chatMessageEvent = event as Extract<UIMachineEvent, { type: 'NEW_CHAT_MESSAGE' }>;
        const sender = chatMessageEvent.chatMessage.senderName || 'Player';
        const messageContent = chatMessageEvent.chatMessage.message;
        return [...context.toasts, { id: Date.now().toString(), type: 'info', message: `New chat from ${sender}: ${messageContent}`, duration: 5000 } satisfies ToastPayload];
      }
    }),
    showErrorModal: assign({
      modal: ({ event }) => {
        const errorEvent = event as Extract<UIMachineEvent, { type: 'ERROR_RECEIVED' }>;
        const errorMessage = errorEvent.error || 'An unknown error occurred.'; // ERROR_RECEIVED event.error is a string
        return { type: 'ERROR', title: 'Error', message: errorMessage, confirmText: 'OK' } satisfies Extract<ModalPayload, {type: 'ERROR'}>;
      }
    }),
    showConfirmModal: assign({
      modal: ({ event }) => {
        const confirmEvent = event as Extract<UIMachineEvent, { type: 'SHOW_CONFIRM_MODAL' }>;
        return confirmEvent.modalPayload; 
      }
    }),
    clearAbilityContext: assign({
      abilityContext: null,
    }),
    advanceAbilityStep: assign({
      abilityContext: ({ context }) => {
        const { abilityContext } = context;
        if (!abilityContext) return null;

        switch (abilityContext.type) {
          case 'king': {
            let nextStep: Extract<AbilityContextContent, {type: 'king'}>['step'] = abilityContext.step;
            if (abilityContext.step === 'peeking1') nextStep = 'peeking2';
            else if (abilityContext.step === 'peeking2') nextStep = 'swapping1';
            else if (abilityContext.step === 'swapping1') nextStep = 'swapping2';
            else if (abilityContext.step === 'swapping2') nextStep = 'confirmingSwap';
            // else it remains 'confirmingSwap' or 'done' which are terminal for this action
            return {
              type: 'king',
              step: nextStep,
              peekedCardsInfo: abilityContext.peekedCardsInfo || [],
              swapSlots: abilityContext.swapSlots || {},
            } satisfies Extract<AbilityContextContent, {type: 'king'}>;
          }
          case 'queen': {
            let nextStep: Extract<AbilityContextContent, {type: 'queen'}>['step'] = abilityContext.step;
            if (abilityContext.step === 'peeking') nextStep = 'swapping1';
            else if (abilityContext.step === 'swapping1') nextStep = 'swapping2';
            else if (abilityContext.step === 'swapping2') nextStep = 'confirmingSwap';
            return {
              type: 'queen',
              step: nextStep,
              peekedCardInfo: abilityContext.peekedCardInfo, // Optional, so carry over
              swapSlots: abilityContext.swapSlots || {},
            } satisfies Extract<AbilityContextContent, {type: 'queen'}>;
          }
          case 'jack': {
            let nextStep: Extract<AbilityContextContent, {type: 'jack'}>['step'] = abilityContext.step;
            if (abilityContext.step === 'swapping1') nextStep = 'swapping2';
            else if (abilityContext.step === 'swapping2') nextStep = 'confirmingSwap';
            return {
              type: 'jack',
              step: nextStep,
              swapSlots: abilityContext.swapSlots || {},
            } satisfies Extract<AbilityContextContent, {type: 'jack'}>;
          }
          default: {
            const _exhaustiveCheck: never = abilityContext; // Ensures all cases are handled
            return abilityContext; // Should be unreachable, return original context
          }
        }
      }
    }),
    advanceToSwapStep: assign({
      abilityContext: ({ context }) => {
        const { abilityContext } = context;
        if (!abilityContext) return null;

        if (abilityContext.type === 'king') {
          return {
            type: 'king',
            step: 'swapping1',
            peekedCardsInfo: abilityContext.peekedCardsInfo || [],
            swapSlots: abilityContext.swapSlots || {},
          } satisfies Extract<AbilityContextContent, {type: 'king'}>;
        }
        if (abilityContext.type === 'queen') {
          return {
            type: 'queen',
            step: 'swapping1',
            peekedCardInfo: abilityContext.peekedCardInfo, // Optional
            swapSlots: abilityContext.swapSlots || {},
          } satisfies Extract<AbilityContextContent, {type: 'queen'}>;
        }
        return abilityContext; // No change for Jack or if context is not King/Queen
      }
    }),
  },
  guards: {
    isPlayerTurn: ({ context }) => {
      const gs = context.currentGameState;
      return !!gs && !!context.localPlayerId && gs.currentPlayerId === context.localPlayerId && gs.currentPhase !== 'gameOver';
    },
    canDrawFromDeck: ({ context }) => {
      const gs = context.currentGameState;
      const lpId = context.localPlayerId;
      if (!gs || !lpId) return false;
      const playerState = gs.players[lpId];
      if (!playerState || playerState.isLocked || playerState.pendingDrawnCard) return false;

      const isCorrectPhase =
        (gs.currentPhase === 'playPhase' && gs.currentPlayerId === lpId) ||
        (gs.currentPhase === 'finalTurnsPhase' && gs.currentPlayerId === lpId && gs.playerWhoCalledCheck !== lpId);

      return isCorrectPhase && gs.deckSize > 0;
    },
    canDrawFromDiscard: ({ context }) => {
      const gs = context.currentGameState;
      const lpId = context.localPlayerId;
      if (!gs || !lpId) return false;
      const playerState = gs.players[lpId];
      if (!playerState || playerState.isLocked || playerState.pendingDrawnCard) return false;

      const isCorrectPhase =
        (gs.currentPhase === 'playPhase' && gs.currentPlayerId === lpId) ||
        (gs.currentPhase === 'finalTurnsPhase' && gs.currentPlayerId === lpId && gs.playerWhoCalledCheck !== lpId);
      
      return (
        isCorrectPhase &&
        gs.discardPile.length > 0 &&
        !gs.discardPileIsSealed &&
        !gs.topDiscardIsSpecialOrUnusable
      );
    },
    canCallCheck: ({ context }) => {
      const gs = context.currentGameState;
      const lpId = context.localPlayerId;
      if (!gs || !lpId) return false;
      const playerState = gs.players[lpId];
      // Player cannot call check if they are locked, have a pending card, or are in the middle of an ability resolution.
      if (!playerState || playerState.isLocked || playerState.pendingDrawnCard || context.abilityContext !== null) return false;

      return (
        gs.currentPhase === 'playPhase' &&
        gs.currentPlayerId === lpId &&
        gs.playerWhoCalledCheck === null
      );
    },
    canAttemptMatch: ({ context }) => {
      const gs = context.currentGameState;
      const lpId = context.localPlayerId;
      if (!gs || !lpId || context.selectedHandCardIndex === null) return false;
      const playerState = gs.players[lpId];
      if (!playerState || playerState.isLocked) return false; // playerWhoCalledCheck is implicitly locked

      if (gs.currentPhase !== 'matchingStage' || !gs.matchingOpportunityInfo) return false;
      if (!gs.matchingOpportunityInfo.potentialMatchers.includes(lpId)) return false;

      const selectedClientCard = playerState.hand[context.selectedHandCardIndex];
      // Ensure selectedClientCard is a Card, not HiddenCard, before accessing rank
      if (!selectedClientCard || ('isHidden' in selectedClientCard && selectedClientCard.isHidden)) return false;
      const selectedCard = selectedClientCard as Card; // Type assertion after check

      return selectedCard.rank === gs.matchingOpportunityInfo.cardToMatch.rank;
    },
    canPassMatch: ({ context }) => {
      const gs = context.currentGameState;
      const lpId = context.localPlayerId;
      if (!gs || !lpId) return false;
      const playerState = gs.players[lpId];
      if (!playerState || playerState.isLocked) return false;

      if (gs.currentPhase !== 'matchingStage' || !gs.matchingOpportunityInfo) return false;
      return gs.matchingOpportunityInfo.potentialMatchers.includes(lpId);
    },
    isInAbilityPeekingPhase: ({ context }) => {
      if (!context.abilityContext) return false;
      const { type, step } = context.abilityContext;
      if (type === 'king' && (step === 'peeking1' || step === 'peeking2')) return true;
      if (type === 'queen' && step === 'peeking') return true;
      return false;
    },
    isInAbilitySwappingPhase: ({ context }) => {
      if (!context.abilityContext) return false;
      const { type, step } = context.abilityContext;
      if (type === 'king' && (step === 'swapping1' || step === 'swapping2')) return true;
      if (type === 'queen' && (step === 'swapping1' || step === 'swapping2')) return true;
      if (type === 'jack' && (step === 'swapping1' || step === 'swapping2')) return true;
      return false;
    }
  },
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
          target: 'initialSetup',
          actions: ['initializeContext'],
        },
      },
    },
    initialSetup: {
      initial: 'awaitingPeekReadiness',
      states: {
        awaitingPeekReadiness: {
          on: {
            READY_FOR_INITIAL_PEEK_CLICKED: {
              target: 'awaitingServerConfirmation', 
              actions: [
                emit(({ context }) => ({
                  type: 'EMIT_TO_SOCKET',
                  eventName: PlayerActionType.DECLARE_READY_FOR_PEEK,
                  payload: { playerId: context.localPlayerId! }
                }))
              ],
              guard: ({ context }) => {
                const playerState = context.currentGameState?.players[context.localPlayerId!];
                // Only allow if player is not already marked as ready for peek
                return !!playerState && !playerState.isReadyForInitialPeek;
              }
            },
            CLIENT_GAME_STATE_UPDATED: [
              {
                guard: ({ context }) => !!context.currentGameState?.players[context.localPlayerId!]?.cardsToPeek,
                target: 'peekingCards',
                actions: ['setCurrentGameState'] 
              },
              {
                actions: ['setCurrentGameState'] 
              }
            ]
          }
        },
        awaitingServerConfirmation: { 
          on: {
            CLIENT_GAME_STATE_UPDATED: [
              {
                guard: ({ context }) => !!context.currentGameState?.players[context.localPlayerId!]?.cardsToPeek,
                target: 'peekingCards',
                actions: ['setCurrentGameState']
              },
              {
                guard: ({ context }) => !!context.currentGameState?.players[context.localPlayerId!]?.isReadyForInitialPeek,
                target: 'awaitingPeekReadiness', 
                actions: ['setCurrentGameState']
              },
              {
                actions: ['setCurrentGameState']
              }
            ]
          }
        },
        peekingCards: {
          on: {
            INITIAL_PEEK_ACKNOWLEDGED_CLICKED: {
              target: 'awaitingPostPeekGameState',
              actions: [
                emit(({ context }) => ({
                  type: 'EMIT_TO_SOCKET',
                  eventName: PlayerActionType.REQUEST_PEEK_REVEAL,
                  payload: { playerId: context.localPlayerId! }
                }))
              ],
              guard: ({ context }) => {
                const playerState = context.currentGameState?.players[context.localPlayerId!];
                // Only allow if player actually has cards to peek
                return !!playerState && !!playerState.cardsToPeek && playerState.cardsToPeek.length > 0;
              }
            },
            CLIENT_GAME_STATE_UPDATED: [
              {
                guard: ({ context }) => {
                  const playerState = context.currentGameState?.players[context.localPlayerId!];
                  return !!playerState && (playerState.cardsToPeek === null || playerState.hasCompletedInitialPeek);
                },
                target: '#uiMachine.idle', 
                actions: ['setCurrentGameState']
              },
              {
                actions: ['setCurrentGameState'] 
              }
            ]
          }
        },
        awaitingPostPeekGameState: {
          on: {
            CLIENT_GAME_STATE_UPDATED: [
              {
                guard: ({ context }) => {
                  const playerState = context.currentGameState?.players[context.localPlayerId!];
                  return !!playerState && (playerState.cardsToPeek === null || playerState.hasCompletedInitialPeek) && context.currentGameState?.currentPhase === 'playPhase';
                },
                target: '#uiMachine.idle',
                actions: ['setCurrentGameState']
              },
              {
                guard: ({ context }) => {
                  const playerState = context.currentGameState?.players[context.localPlayerId!];
                  return !!playerState && (playerState.cardsToPeek === null || playerState.hasCompletedInitialPeek);
                },
                target: 'awaitingPeekReadiness',
                actions: ['setCurrentGameState']
              },
              {
                actions: ['setCurrentGameState']
              }
            ]
          }
        }
      }
    },
    idle: {
      on: {
        CLIENT_GAME_STATE_UPDATED: [
          {
            guard: ({ context }) => !!context.currentGameState?.players[context.localPlayerId!]?.pendingDrawnCard,
            target: 'playerAction.promptPendingCardDecision',
            actions: ['setCurrentGameState']
          },
          {
            guard: ({ context }) => {
              const gs = context.currentGameState;
              const localPlayerId = context.localPlayerId;
              if (!gs || !localPlayerId || !gs.matchingOpportunityInfo) return false;
              return gs.matchingOpportunityInfo.potentialMatchers.includes(localPlayerId);
            },
            target: 'playerAction.promptMatchDecision',
            actions: ['setCurrentGameState']
          },
          {
            guard: ({ context }) => !!context.currentGameState?.players[context.localPlayerId!]?.pendingSpecialAbility,
            target: 'abilityActive',
            actions: ['setCurrentGameState', 'initializeAbilityContext']
          },
          {
            actions: ['setCurrentGameState']
          }
        ],
        NEW_GAME_LOG: { actions: ['logGameEventToast'] },
        NEW_CHAT_MESSAGE: { actions: ['showToastFromChatMessage'] },
        ERROR_RECEIVED: { actions: ['showErrorModal'] },
        GAME_STATE_RECEIVED: [ /* ... */ ],
        DRAW_FROM_DECK_CLICKED: {
          target: 'awaitingServerResponse',
          actions: [ emit(({ context }) => ({ type: 'EMIT_TO_SOCKET', eventName: PlayerActionType.DRAW_FROM_DECK, payload: { playerId: context.localPlayerId! } as ServerActionToPerform })) ],
          guard: 'canDrawFromDeck'
        },
        DRAW_FROM_DISCARD_CLICKED: {
          target: 'awaitingServerResponse',
          actions: [ emit(({ context }) => ({ type: 'EMIT_TO_SOCKET', eventName: PlayerActionType.DRAW_FROM_DISCARD, payload: { playerId: context.localPlayerId! } as ServerActionToPerform })) ],
          guard: 'canDrawFromDiscard'
        },
        CALL_CHECK_CLICKED: {
          target: 'awaitingServerResponse',
          actions: [ emit(({ context }) => ({ type: 'EMIT_TO_SOCKET', eventName: PlayerActionType.CALL_CHECK, payload: { playerId: context.localPlayerId! } as ServerActionToPerform })) ],
          guard: 'canCallCheck'
        },
        HAND_CARD_CLICKED: { actions: ['setSelectedHandCardIndex'] },
        START_ABILITY: { target: 'abilityActive', actions: ['initializeAbilityContext'] },
        SHOW_TOAST: { actions: ['showToast'] },
        DISMISS_TOAST: { actions: ['dismissToast'] },
        SHOW_MODAL: { actions: ['setModal'] },
        DISMISS_MODAL: { actions: ['clearModal'] },
        TRIGGER_ANIMATION: { actions: 'setAnimationCue' },
        ANIMATION_COMPLETED: { actions: 'clearAnimationCue' },
      },
    },
    awaitingServerResponse: {
      on: {
        CLIENT_GAME_STATE_UPDATED: [
          {
            guard: ({ context }) => !!context.currentGameState?.players[context.localPlayerId!]?.pendingDrawnCard,
            target: 'playerAction.promptPendingCardDecision',
            actions: ['setCurrentGameState']
          },
          {
            guard: ({ context }) => {
              const gs = context.currentGameState;
              const localPlayerId = context.localPlayerId;
              if (!gs || !localPlayerId || !gs.matchingOpportunityInfo) return false;
              return gs.matchingOpportunityInfo.potentialMatchers.includes(localPlayerId);
            },
            target: 'playerAction.promptMatchDecision',
            actions: ['setCurrentGameState']
          },
          {
            guard: ({ context }) => !!context.currentGameState?.players[context.localPlayerId!]?.pendingSpecialAbility,
            target: 'abilityActive',
            actions: ['setCurrentGameState', 'initializeAbilityContext']
          },
          {
            target: 'idle',
            actions: ['setCurrentGameState']
          }
        ],
        GAME_STATE_RECEIVED: [ /* Similar structure as CLIENT_GAME_STATE_UPDATED if used */
          {
            target: 'idle',
            actions: ['setCurrentGameState']
          }
        ],
        NEW_GAME_LOG: { actions: ['logGameEventToast'] },
        NEW_CHAT_MESSAGE: { actions: ['showToastFromChatMessage'] },
        ERROR_RECEIVED: {
          target: 'idle', 
          actions: ['showErrorModal']
        },
        RESOLVE_ABILITY_SUCCESS: {
            target: 'idle',
            actions: ['clearAbilityContext', 'setCurrentGameState']
        }
      },
    },
    playerAction: {
      states: {
        promptPendingCardDecision: {
          on: {
            CONFIRM_SWAP_PENDING_CARD_WITH_HAND: {
              target: '#uiMachine.awaitingServerResponse',
              actions: [
                emit(({ context, event }) => ({
                  type: 'EMIT_TO_SOCKET',
                  eventName: PlayerActionType.SWAP_AND_DISCARD,
                  payload: { playerId: context.localPlayerId!, handIndex: event.handCardIndex } as ServerActionToPerform
                }))
              ],
              guard: ({context}) => !!context.currentGameState?.players[context.localPlayerId!]?.pendingDrawnCard
            },
            CONFIRM_DISCARD_PENDING_DRAWN_CARD: {
              target: '#uiMachine.awaitingServerResponse',
              actions: [
                emit(({ context }) => ({
                  type: 'EMIT_TO_SOCKET',
                  eventName: PlayerActionType.DISCARD_DRAWN_CARD,
                  payload: { playerId: context.localPlayerId! } as ServerActionToPerform
                }))
              ],
              guard: ({context}) => context.currentGameState?.players[context.localPlayerId!]?.pendingDrawnCardSource === 'deck',
            },
            CLIENT_GAME_STATE_UPDATED: [
              {
                guard: ({ context }) => !context.currentGameState?.players[context.localPlayerId!]?.pendingDrawnCard,
                target: '#uiMachine.idle',
                actions: ['setCurrentGameState']
              },
              { actions: ['setCurrentGameState'] }
            ]
          }
        },
        promptMatchDecision: {
          on: {
            ATTEMPT_MATCH_WITH_SELECTED_CARD_CLICKED: {
              target: '#uiMachine.awaitingServerResponse',
              actions: [
                emit(({ context }) => ({
                  type: 'EMIT_TO_SOCKET',
                  eventName: PlayerActionType.ATTEMPT_MATCH,
                  payload: { playerId: context.localPlayerId!, handIndex: context.selectedHandCardIndex! } as ServerActionToPerform
                })),
                'clearSelectedHandCardIndex'
              ],
              guard: ({context}) => context.selectedHandCardIndex !== null,
            },
            PASS_MATCH_CLICKED: {
              target: '#uiMachine.awaitingServerResponse',
              actions: [
                emit(({ context }) => ({
                  type: 'EMIT_TO_SOCKET',
                  eventName: PlayerActionType.PASS_MATCH,
                  payload: { playerId: context.localPlayerId! } as ServerActionToPerform
                }))
              ],
              guard: 'canPassMatch'
            },
            HAND_CARD_CLICKED: { actions: ['setSelectedHandCardIndex'] },
            CLIENT_GAME_STATE_UPDATED: [
              {
                guard: ({ context }) => {
                  const gs = context.currentGameState;
                  const localPlayerId = context.localPlayerId;
                  if (!gs || !localPlayerId || !gs.matchingOpportunityInfo) return true;
                  return !gs.matchingOpportunityInfo.potentialMatchers.includes(localPlayerId!);
                },
                target: '#uiMachine.idle',
                actions: ['setCurrentGameState']
              },
              { actions: ['setCurrentGameState'] }
            ]
          }
        }
      }
    },
    abilityActive: {
      on: {
        CLIENT_GAME_STATE_UPDATED: [
          {
            guard: ({ context }) => !!context.currentGameState?.players[context.localPlayerId!]?.pendingDrawnCard,
            target: '#uiMachine.playerAction.promptPendingCardDecision',
            actions: ['setCurrentGameState', 'clearAbilityContext']
          },
          {
            guard: ({ context }) => {
              const gs = context.currentGameState;
              const localPlayerId = context.localPlayerId;
              if (!gs || !localPlayerId || !gs.matchingOpportunityInfo) return false;
              return gs.matchingOpportunityInfo.potentialMatchers.includes(localPlayerId);
            },
            target: '#uiMachine.playerAction.promptMatchDecision',
            actions: ['setCurrentGameState', 'clearAbilityContext']
          },
          {
            guard: ({ context }) => !context.currentGameState?.players[context.localPlayerId!]?.pendingSpecialAbility,
            target: '#uiMachine.idle',
            actions: ['setCurrentGameState', 'clearAbilityContext']
          },
          { actions: ['setCurrentGameState'] }
        ],
        NEW_GAME_LOG: { /* ... */ },
        NEW_CHAT_MESSAGE: { /* ... */ },
        ERROR_RECEIVED: { target: '#uiMachine.idle', actions: [/* show error */ 'clearAbilityContext'] },
        ABILITY_CARD_TARGET_SELECTED: {
          actions: [
            assign({
              abilityContext: ({ context, event }) => {
                const { abilityContext } = context;
                if (!abilityContext) return context.abilityContext;
                const { playerId, cardIndex, card } = event as Extract<UIMachineEvent, { type: 'ABILITY_CARD_TARGET_SELECTED' }>;

                // Peek logic (King, Queen)
                if (abilityContext.type === 'king' && (abilityContext.step === 'peeking1' || abilityContext.step === 'peeking2')) {
                  const currentPeeked = abilityContext.peekedCardsInfo || [];
                  if (currentPeeked.length < 2) {
                    const newPeekedItem = { playerId, cardIndex: cardIndex, card };
                    return { ...abilityContext, peekedCardsInfo: [...currentPeeked, newPeekedItem] };
                  }
                } else if (abilityContext.type === 'queen' && abilityContext.step === 'peeking') {
                  return { ...abilityContext, peekedCardInfo: { playerId, cardIndex: cardIndex, card } };
                }
                // Swap logic (King, Queen, Jack)
                else if ((abilityContext.type === 'king' || abilityContext.type === 'queen' || abilityContext.type === 'jack') &&
                         (abilityContext.step === 'swapping1' || abilityContext.step === 'swapping2')) {
                  const currentSwapSlots = abilityContext.swapSlots || { slot1: undefined, slot2: undefined };
                  const newSwapSlots = { ...currentSwapSlots };
                  if (!newSwapSlots.slot1) {
                    newSwapSlots.slot1 = { playerId, cardIndex, card };
                  } else if (!newSwapSlots.slot2) {
                     if (newSwapSlots.slot1.playerId === playerId && newSwapSlots.slot1.cardIndex === cardIndex && newSwapSlots.slot1.card.id === card.id) {
                        return abilityContext; // Avoid selecting the same card twice
                    }
                    newSwapSlots.slot2 = { playerId, cardIndex, card };
                  }
                  return { ...abilityContext, swapSlots: newSwapSlots };
                }
                return abilityContext;
              }
            }),
            'advanceAbilityStep'
          ]
        },
        ABILITY_CONFIRM_ACTION: {
          target: 'awaitingServerResponse',
          actions: [
            emit(({ context }) => {
              let abilityResolutionArgs: AbilityArgs = {};

              if (context.abilityContext) {
                if (context.abilityContext.swapSlots?.slot1 && context.abilityContext.swapSlots?.slot2) {
                  abilityResolutionArgs.swapTargets = [
                    { playerID: context.abilityContext.swapSlots.slot1.playerId, cardIndex: context.abilityContext.swapSlots.slot1.cardIndex },
                    { playerID: context.abilityContext.swapSlots.slot2.playerId, cardIndex: context.abilityContext.swapSlots.slot2.cardIndex },
                  ];
                }
              }

              const serverPayload: ConcretePlayerActionEvents = {
                type: PlayerActionType.RESOLVE_SPECIAL_ABILITY,
                playerId: context.localPlayerId!,
                abilityResolutionArgs: abilityResolutionArgs,
              };

              return {
                type: 'EMIT_TO_SOCKET',
                eventName: PlayerActionType.RESOLVE_SPECIAL_ABILITY,
                payload: serverPayload
              };
            }),
            'clearAbilityContext'
          ]
        },
        ABILITY_CANCEL_ACTION: {
          target: 'idle',
          actions: ['clearAbilityContext'],
        },
        ABILITY_SKIP_PEEK: {
          target: 'awaitingServerResponse',
          actions: [emit(({ context }) => ({
            type: 'EMIT_TO_SOCKET',
            eventName: PlayerActionType.RESOLVE_SPECIAL_ABILITY,
            payload: { type: PlayerActionType.RESOLVE_SPECIAL_ABILITY, playerId: context.localPlayerId!, abilityResolutionArgs: { skipAbility: true, skipType: 'peek' } } as ConcretePlayerActionEvents
          })), 'clearAbilityContext']
        },
        ABILITY_SKIP_SWAP: {
          target: 'awaitingServerResponse',
          actions: [emit(({ context }) => ({
            type: 'EMIT_TO_SOCKET',
            eventName: PlayerActionType.RESOLVE_SPECIAL_ABILITY,
            payload: { type: PlayerActionType.RESOLVE_SPECIAL_ABILITY, playerId: context.localPlayerId!, abilityResolutionArgs: { skipAbility: true, skipType: 'swap' } } as ConcretePlayerActionEvents
          })), 'clearAbilityContext']
        },
        RESOLVE_ABILITY_SUCCESS: {
          target: 'idle',
          actions: ['setCurrentGameState', 'clearAbilityContext']
        }
      }
    }
  },
});

export type UIMachineActor = ActorRefFrom<typeof uiMachine>;
export type UIMachineLogic = typeof uiMachine;