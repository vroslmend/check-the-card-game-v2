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
  type AttemptRejoinResponse,
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
import logger from '@/lib/logger';

// Constants for error handling
const MAX_RECONNECT_ATTEMPTS = parseInt(process.env.NEXT_PUBLIC_MAX_RECONNECT_ATTEMPTS || '3', 10);
const RECONNECT_INTERVAL_MS = parseInt(process.env.NEXT_PUBLIC_RECONNECT_INTERVAL_MS || '5000', 10);

// #region ----- TYPE DEFINITIONS -----

// These are the actions the server can send to the client machine
type ServerToClientEvents =
  | { type: 'CLIENT_GAME_STATE_UPDATED'; gameState: ClientCheckGameState }
  | { type: 'NEW_GAME_LOG'; logMessage: RichGameLogMessage }
  | { type: 'INITIAL_PEEK_INFO'; hand: Card[] }
  | { type: 'ABILITY_PEEK_RESULT'; card: Card; playerId: PlayerId; cardIndex: number }
  | { type: 'ERROR_RECEIVED'; error: string }
  | { type: 'INITIAL_LOGS_RECEIVED'; logs: RichGameLogMessage[] };

// These are the events the client can send to the server.
// By defining them as a discriminated union, we can ensure type safety
// when emitting events from the machine to the socket.
type SocketEmitEvent =
  | {
      eventName: SocketEventName.CREATE_GAME;
      payload: { name: string };
      ack: (response: CreateGameResponse) => void;
    }
  | {
      eventName: SocketEventName.JOIN_GAME;
      payload: [gameId: string, playerSetupData: { name: string }];
      ack: (response: JoinGameResponse) => void;
    }
  | {
      eventName: SocketEventName.ATTEMPT_REJOIN;
      payload: { gameId: string; playerId: string };
      ack: (response: any) => void; // TODO: Type this properly
    }
  | {
      eventName: SocketEventName.SEND_CHAT_MESSAGE;
      payload: { message: string; senderId: string; senderName: string; gameId: string };
      ack?: never;
    }
  | {
      eventName: SocketEventName.PLAYER_ACTION;
      payload: { type: PlayerActionType; payload?: any };
      ack?: never;
    };

// This is the shape of the event that the machine emits internally.
type EmittedEventToSocket = {
  type: 'EMIT_TO_SOCKET';
} & SocketEmitEvent;

type EmittedEvent = EmittedEventToSocket | {
  type: 'REPORT_ERROR_TO_SERVER';
  errorType: string;
  message: string;
  context?: any;
};

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
  currentAbilityContext?: ClientAbilityContext;
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
  | ServerToClientEvents
  | { type: 'CREATE_GAME_REQUESTED'; playerName: string }
  | { type: 'JOIN_GAME_REQUESTED'; playerName: string; gameId: string }
  | { type: 'GAME_CREATED_SUCCESSFULLY'; response: CreateGameResponse }
  | { type: 'GAME_JOINED_SUCCESSFULLY'; response: JoinGameResponse }
  | { type: 'CONNECT' }
  | { type: 'DISCONNECT' }
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
  | { type: 'CHOOSE_SWAP_TARGET' }
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
        logger.debug({ gameState: event.gameState }, 'Action: setCurrentGameState');
        return event.gameState;
      },
    }),
    addGameLog: assign({
      gameLog: ({ context, event }) => {
        assertEvent(event, 'NEW_GAME_LOG');
        logger.debug('Action: addGameLog');
        return [...context.gameLog, event.logMessage];
      }
    }),
    setInitialLogs: assign({
      gameLog: ({ event }) => {
        assertEvent(event, 'INITIAL_LOGS_RECEIVED');
        logger.debug({ logCount: event.logs.length }, 'Action: setInitialLogs');
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
        logger.debug({ chatMessage: newChatMessage }, 'Action: addChatMessage');
        return [...context.chatMessages, newChatMessage];
      },
    }),
    setGameIdAndPlayerId: assign({
      gameId: ({ event }) => {
        assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
        logger.info({ gameId: event.response.gameId }, 'Action: setGameId');
        return event.response.gameId!;
      },
      localPlayerId: ({ event }) => {
        assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
        logger.info({ playerId: event.response.playerId }, 'Action: setPlayerId');
        return event.response.playerId!;
      },
    }),
    setInitialGameState: assign({
      currentGameState: ({ event }) => {
        assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
        logger.info('Action: setInitialGameState');
        return event.response.gameState!;
      },
    }),
    resetGameContext: assign({
        localPlayerId: undefined,
        gameId: undefined,
        currentGameState: undefined,
        currentAbilityContext: undefined,
        visibleCards: [],
        chatMessages: [],
        gameLog: [],
        error: null,
        reconnectionAttempts: 0,
        connectionErrors: [],
        modal: undefined,
    }),
    persistSession: ({ event }) => {
      assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
      try {
        const session = {
          gameId: event.response.gameId,
          playerId: event.response.playerId,
        };
        sessionStorage.setItem('playerSession', JSON.stringify(session));
        logger.info({ session }, 'Action: persistSession');
      } catch (e) {
        logger.error({ error: e }, 'Failed to persist session to sessionStorage');
      }
    },
    clearSession: () => {
      try {
        sessionStorage.removeItem('playerSession');
        logger.info('Action: clearSession');
      } catch (e) {
        logger.error({ error: e }, 'Failed to clear session from sessionStorage');
      }
    },
    // #endregion

    // #region ----- Socket Emitters -----
    emitCreateGame: emit(({ self, event }) => {
      assertEvent(event, 'CREATE_GAME_REQUESTED');
      return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.CREATE_GAME as const,
        payload: { name: event.playerName },
        ack: (response: CreateGameResponse) => {
          self.send({ type: 'GAME_CREATED_SUCCESSFULLY', response });
        },
      };
    }),
    emitJoinGame: emit(({ self, event }): EmittedEventToSocket => {
      assertEvent(event, 'JOIN_GAME_REQUESTED');
      return {
        type: 'EMIT_TO_SOCKET',
        eventName: SocketEventName.JOIN_GAME as const,
        payload: [
          event.gameId,
          { name: event.playerName },
        ],
        ack: (response: JoinGameResponse) => {
          self.send({
            type: 'GAME_JOINED_SUCCESSFULLY',
            response,
          });
        },
      };
    }),
    emitAttemptRejoin: emit(({ context, self }) => {
      return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.ATTEMPT_REJOIN as const,
        payload: { gameId: context.gameId!, playerId: context.localPlayerId! },
        ack: (response: AttemptRejoinResponse) => {
          if (response.success) {
            self.send({ type: 'CLIENT_GAME_STATE_UPDATED', gameState: response.gameState! });
            const logs = (response as any).logs;
            if (logs) {
                self.send({ type: 'INITIAL_LOGS_RECEIVED', logs: logs });
            }
          } else {
            self.send({ type: 'RECOVERY_FAILED' });
          }
        },
      };
    }),
    emitChatMessage: emit(({ event }) => {
      assertEvent(event, 'SUBMIT_CHAT_MESSAGE');
      return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.SEND_CHAT_MESSAGE as const,
        payload: {
          message: event.message,
          senderId: event.senderId,
          senderName: event.senderName,
          gameId: event.gameId,
        },
      };
    }),
    // Convenience wrappers for Player Actions
    emitPlayerReady: emit({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.PLAYER_ACTION as const,
      payload: { type: PlayerActionType.DECLARE_LOBBY_READY },
    }),
    emitStartGame: emit({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.PLAYER_ACTION as const,
      payload: { type: PlayerActionType.START_GAME },
    }),
    emitDeclareReadyForPeek: emit({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.PLAYER_ACTION as const,
      payload: { type: PlayerActionType.DECLARE_READY_FOR_PEEK },
    }),
    emitDrawFromDeck: emit({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.PLAYER_ACTION as const,
      payload: { type: PlayerActionType.DRAW_FROM_DECK },
    }),
    emitDrawFromDiscard: emit({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.PLAYER_ACTION as const,
      payload: { type: PlayerActionType.DRAW_FROM_DISCARD },
    }),
    emitSwapAndDiscard: emit(({ event }) => {
      assertEvent(event, 'SWAP_AND_DISCARD');
      return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.PLAYER_ACTION as const,
        payload: {
          type: PlayerActionType.SWAP_AND_DISCARD,
          payload: { handCardIndex: event.cardIndex },
        },
      };
    }),
    emitDiscardDrawnCard: emit({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.PLAYER_ACTION as const,
      payload: { type: PlayerActionType.DISCARD_DRAWN_CARD },
    }),
    emitAttemptMatch: emit(({ event }) => {
      assertEvent(event, 'ATTEMPT_MATCH');
      return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.PLAYER_ACTION as const,
        payload: {
          type: PlayerActionType.ATTEMPT_MATCH,
          payload: { handCardIndex: event.handCardIndex },
        },
      };
    }),
    emitPassOnMatch: emit({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.PLAYER_ACTION as const,
      payload: { type: PlayerActionType.PASS_ON_MATCH_ATTEMPT },
    }),
    emitCallCheck: emit({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.PLAYER_ACTION as const,
      payload: { type: PlayerActionType.CALL_CHECK },
    }),
    // #endregion

    // #region ----- UI Actions -----
    showErrorToast: ({ event }) => {
        assertEvent(event, 'ERROR_RECEIVED');
        logger.error({ error: event.error }, 'Action: showErrorToast');
        toast.error(event.error);
    },
    toggleSidePanel: assign({
        isSidePanelOpen: ({ context }) => {
            logger.debug({ wasOpen: context.isSidePanelOpen }, 'Action: toggleSidePanel');
            return !context.isSidePanelOpen;
        }
    }),
    dismissModal: assign({
        modal: () => {
          logger.debug('Action: dismissModal');
          return undefined;
        }
    }),
    addPeekedCardToContext: assign({
      visibleCards: ({ context, event }) => {
        assertEvent(event, 'ABILITY_PEEK_RESULT');
        const newCard: PeekedCardInfo = {
          playerId: event.playerId,
          cardIndex: event.cardIndex,
          card: event.card,
          source: 'ability' as const,
          // Set an expiration time, e.g., 5 seconds from now
          expireAt: Date.now() + 5000
        };
        logger.debug({ peekedCard: newCard }, 'Action: addPeekedCardToContext');
        return [ ...context.visibleCards, newCard ];
      },
    }),
    setInitialPeekCards: assign({
      visibleCards: ({ context, event }) => {
        assertEvent(event, 'INITIAL_PEEK_INFO');
        logger.debug('Action: setInitialPeekCards');
        // Get the indices of the bottom two cards in a 2x2 grid
        const bottomCards = [2, 3]; 
        const PEEK_DURATION = 10000; // 10 seconds
        return event.hand.map((card, idx) => ({
          playerId: context.localPlayerId ?? null,
          cardIndex: bottomCards[idx],
          card,
          source: 'initial-peek' as const,
          expireAt: Date.now() + PEEK_DURATION,
        }));
      },
    }),
    clearTemporaryCardStates: assign({
      visibleCards: () => {
        logger.debug('Action: clearTemporaryCardStates');
        return [];
      }
    }),
    // #endregion

    // #region ----- ABILITY CONTEXT -----
    syncAbilityContext: assign({
      currentAbilityContext: ({ context }) => {
        const serverAbilityStack = context.currentGameState?.abilityStack ?? [];
        const currentClientAbility = context.currentAbilityContext;

        if (serverAbilityStack.length === 0) {
          if (currentClientAbility) logger.debug('Action: syncAbilityContext (clearing)');
          return undefined;
        }

        const topServerAbility = serverAbilityStack[serverAbilityStack.length - 1];

        if (topServerAbility.playerId !== context.localPlayerId) {
           if (currentClientAbility) logger.debug('Action: syncAbilityContext (clearing, not our turn)');
          return undefined;
        }

        if (!currentClientAbility || currentClientAbility.type !== topServerAbility.type) {
          logger.debug({ serverAbility: topServerAbility }, 'Action: syncAbilityContext (initializing new)');
          const { type, stage, playerId } = topServerAbility;
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

        if (currentClientAbility.stage !== topServerAbility.stage) {
          logger.debug({ oldStage: currentClientAbility.stage, newStage: topServerAbility.stage }, 'Action: syncAbilityContext (stage changed)');
          return {
            ...currentClientAbility,
            stage: topServerAbility.stage,
            selectedPeekTargets: [],
            selectedSwapTargets: [],
          };
        }
        return currentClientAbility;
      },
    }),
    updateAbilityContext: assign({
      currentAbilityContext: ({ context, event }) => {
        assertEvent(event, 'PLAYER_SLOT_CLICKED_FOR_ABILITY');
        const { currentAbilityContext: abilityContext } = context;
        if (!abilityContext) return undefined;
        logger.debug({ event, abilityContext }, 'Action: updateAbilityContext');

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
      currentAbilityContext: () => {
        logger.debug('Action: clearAbilityContext');
        return undefined;
      }
    }),
    // #endregion

    // #region ----- Error Handling -----
    showConnectionErrorToast: ({ event }) => {
      assertEvent(event, 'CONNECTION_ERROR');
      logger.warn({ message: event.message }, 'Action: showConnectionErrorToast');
      toast.error(`Connection error: ${event.message}. Attempting to reconnect...`);
    },
    
    showServerErrorToast: ({ event }) => {
      assertEvent(event, 'SERVER_ERROR');
      logger.error({ event }, 'Action: showServerErrorToast');
      toast.error(`Server error: ${event.message}`);
    },
    
    addConnectionError: assign({
      connectionErrors: ({ context, event }) => {
        assertEvent(event, 'CONNECTION_ERROR');
        const newError = {
          message: event.message,
          timestamp: new Date().toISOString()
        };
        logger.warn(newError, 'Action: addConnectionError');
        return [...context.connectionErrors, newError];
      }
    }),
    
    clearErrors: assign({
      error: () => {
        logger.debug('Action: clearErrors');
        return null;
      },
      connectionErrors: []
    }),
    
    incrementReconnectionAttempts: assign({
      reconnectionAttempts: ({ context }) => {
        const newCount = context.reconnectionAttempts + 1;
        logger.warn({ attempt: newCount }, 'Action: incrementReconnectionAttempts');
        return newCount;
      }
    }),
    
    resetReconnectionAttempts: assign({
      reconnectionAttempts: () => {
        logger.info('Action: resetReconnectionAttempts');
        return 0;
      }
    }),
    
    reportErrorToServer: emit(({ event }) => {
      assertEvent(event, ['ERROR_RECEIVED', 'CONNECTION_ERROR', 'SERVER_ERROR']);
      const errorPayload = {
        errorType: event.type,
        message: 'error' in event ? event.error : event.message,
        context: 'details' in event ? event.details : undefined
      };
      logger.debug(errorPayload, 'Action: reportErrorToServer');
      return {
        type: 'REPORT_ERROR_TO_SERVER' as const,
        ...errorPayload
      };
    }),
    // #endregion

    cleanupExpiredVisibleCards: assign({
      visibleCards: ({ context }) => {
        const now = Date.now();
        const initialCount = context.visibleCards.length;
        const remainingCards = context.visibleCards.filter(vc => !vc.expireAt || vc.expireAt > now);
        if (initialCount > remainingCards.length) {
            logger.trace({ removed: initialCount - remainingCards.length }, 'Action: cleanupExpiredVisibleCards');
        }
        return remainingCards;
      }
    }),
  },
  guards: {
    isAbilityActionComplete: ({ context }) => {
        const { currentAbilityContext: abilityContext } = context;
        if (!abilityContext) return false;
        let result = false;
        if (abilityContext.stage === 'peeking') {
            result = abilityContext.selectedPeekTargets.length === abilityContext.maxPeekTargets;
        }
        if (abilityContext.stage === 'swapping') {
            result = abilityContext.selectedSwapTargets.length === 2;
        }
        logger.debug({ result, abilityContext }, 'Guard: isAbilityActionComplete');
        return result;
      },
    canAttemptReconnection: ({ context }) => {
      const result = context.reconnectionAttempts < MAX_RECONNECT_ATTEMPTS;
      logger.debug({ result, attempts: context.reconnectionAttempts }, 'Guard: canAttemptReconnection');
      return result;
    },
  },
}).createMachine({
  id: 'ui',
  context: ({ input }) => ({
    localPlayerId: input.localPlayerId ?? undefined,
    gameId: input.gameId ?? undefined,
    currentGameState: input.initialGameState ?? undefined,
    currentAbilityContext: undefined,
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
    RECONNECT: {
      target: '#ui.inGame.reconnecting',
      actions: () => logger.info('Event: RECONNECT'),
    },
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
      entry: () => logger.info('State: initializing'),
      always: [
        {
          target: 'inGame.reconnecting',
          guard: ({ context }) => !!context.localPlayerId && !context.currentGameState,
          description: 'Has player ID from session, but no game state. Must reconnect.',
        },
        {
          target: 'inGame',
          guard: ({ context }) => {
            const hasState = !!context.currentGameState;
            logger.debug({ hasState }, 'Guard: hasInitialGameState');
            return hasState;
          },
        },
        {
          target: 'outOfGame',
        },
      ],
    },
    outOfGame: {
      id: 'outOfGame',
      entry: () => logger.info('State: outOfGame'),
      on: {
        CREATE_GAME_REQUESTED: {
          actions: ['emitCreateGame', () => logger.info('Event: CREATE_GAME_REQUESTED')],
        },
        JOIN_GAME_REQUESTED: {
          actions: ['emitJoinGame', () => logger.info('Event: JOIN_GAME_REQUESTED')],
        },
        GAME_CREATED_SUCCESSFULLY: {
          target: 'inGame',
          actions: ['setGameIdAndPlayerId', 'setInitialGameState', 'persistSession', () => logger.info('Event: GAME_CREATED_SUCCESSFULLY')],
        },
        GAME_JOINED_SUCCESSFULLY: {
          target: 'inGame',
          actions: ['setGameIdAndPlayerId', 'setInitialGameState', 'persistSession', () => logger.info('Event: GAME_JOINED_SUCCESSFULLY')],
        },
      },
    },
    inGame: {
      id: 'inGame',
      entry: () => logger.info('State: inGame'),
      initial: 'routing',
      on: {
        DISCONNECT: {
          target: '.disconnected',
          actions: [
            () => logger.warn('Event: DISCONNECT'),
            assign({
              error: { message: 'You have been disconnected from the game server' }
            })
          ]
        },
        LEAVE_GAME: { target: '.leaving' },
        TOGGLE_SIDE_PANEL: { actions: 'toggleSidePanel' },
        CLIENT_GAME_STATE_UPDATED: {
          target: '.routing',
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
          actions: ['addChatMessage', 'emitChatMessage'],
        },
        DECLARE_READY_FOR_PEEK_CLICKED: { actions: 'emitDeclareReadyForPeek' },
      },
      states: {
        routing: {
          entry: () => logger.info('State: inGame.routing'),
          always: [
            {
              target: 'lobby',
              guard: ({ context }) => context.currentGameState?.gameStage === GameStage.WAITING_FOR_PLAYERS,
            },
            {
              target: 'playing',
              guard: ({ context }) => !!context.currentGameState && context.currentGameState.gameStage !== GameStage.WAITING_FOR_PLAYERS,
            },
            // Fallback if there's no game state for some reason, prevents getting stuck
            { 
              target: '#outOfGame',
              actions: () => logger.warn('Routing fallback: no game state, returning to outOfGame.'),
            }
          ]
        },
        lobby: {
          entry: () => logger.info('State: inGame.lobby'),
          on: {
            START_GAME: { actions: 'emitStartGame' },
            PLAYER_READY: { actions: 'emitPlayerReady' },
          },
        },
        playing: {
            entry: ['clearTemporaryCardStates', () => logger.info('State: inGame.playing')],
            initial: 'idle', // Start in idle, then transition to ability if needed
            states: {
                idle: {
                  entry: () => logger.debug('State: inGame.playing.idle'),
                  invoke: {
                    src: 'cardVisibilityCleanup',
                  },
                  always: [
                    {
                      target: 'ability',
                      guard: ({ context }) => !!context.currentAbilityContext,
                    }
                  ],
                  on: {
                    CLEANUP_EXPIRED_CARDS: {
                      actions: 'cleanupExpiredVisibleCards'
                    },
                    SWAP_AND_DISCARD:   { actions: 'emitSwapAndDiscard' },
                    DISCARD_DRAWN_CARD: { actions: 'emitDiscardDrawnCard' },
                    DRAW_FROM_DECK:     { actions: 'emitDrawFromDeck' },
                    DRAW_FROM_DISCARD:  { actions: 'emitDrawFromDiscard' },
                    ATTEMPT_MATCH:      { actions: 'emitAttemptMatch' },
                    PASS_ON_MATCH:      { actions: 'emitPassOnMatch' },
                    CALL_CHECK:         { actions: 'emitCallCheck' },
                    CHOOSE_SWAP_TARGET: { target: 'selectingSwapTarget' },
                  },
                },
                ability: {
                    entry: () => logger.debug('State: inGame.playing.ability'),
                    always: [
                      {
                        target: 'idle',
                        guard: ({ context }) => !context.currentAbilityContext,
                      }
                    ],
                    on: {
                        PLAYER_SLOT_CLICKED_FOR_ABILITY: { actions: 'updateAbilityContext' },
                        CANCEL_ABILITY: {
                            target: 'idle',
                            actions: ['clearAbilityContext'],
                        },
                        CONFIRM_ABILITY_ACTION: {
                          guard: 'isAbilityActionComplete',
                          actions: emit(({ context }) => {
                            const { currentAbilityContext: abilityContext } = context;
                            if (!abilityContext) throw new Error('Ability context missing');
          
                            let payload: AbilityActionPayload;
                            if (abilityContext.stage === 'peeking') {
                              payload = { action: 'peek', targets: abilityContext.selectedPeekTargets as PeekTarget[] };
                            } else {
                              payload = { action: 'swap', source: abilityContext.selectedSwapTargets[0]! as SwapTarget, target: abilityContext.selectedSwapTargets[1]! as SwapTarget };
                            }
                            return {
                              type: 'EMIT_TO_SOCKET' as const,
                              eventName: SocketEventName.PLAYER_ACTION as const,
                              payload: {
                                type: PlayerActionType.USE_ABILITY,
                                payload,
                              },
                            };
                          }),
                        },
                        SKIP_ABILITY_STAGE: {
                          actions: emit(() => ({
                            type: 'EMIT_TO_SOCKET' as const,
                            eventName: SocketEventName.PLAYER_ACTION as const,
                            payload: {
                              type: PlayerActionType.USE_ABILITY,
                              payload: { action: 'skip' } satisfies SkipAbilityPayload,
                            },
                          })),
                        },
                    },
                },
                selectingSwapTarget: {
                  entry: () => logger.debug('State: inGame.playing.selectingSwapTarget'),
                  on: {
                    SWAP_AND_DISCARD: {
                      target: 'idle',
                      actions: 'emitSwapAndDiscard',
                    },
                    // Allow canceling the swap selection
                    DRAW_FROM_DECK: { target: 'idle' },
                    DRAW_FROM_DISCARD: { target: 'idle' },
                  }
                },
            },
        },
        leaving: {
          entry: ['resetGameContext', 'clearSession', () => logger.warn('State: inGame.leaving')],
          always: '#outOfGame',
        },
        disconnected: {
          entry: ['incrementReconnectionAttempts', () => logger.warn('State: inGame.disconnected')],
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
          entry: ['emitAttemptRejoin', () => logger.info('State: inGame.reconnecting')],
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
          entry: [
            () => logger.fatal('State: inGame.recoveryFailed'),
            ({ context }) => {
              toast.error(`Failed to reconnect after ${context.reconnectionAttempts} attempts. Please refresh the page and try again.`);
            },
          ],
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