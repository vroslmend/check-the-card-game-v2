import { setup, assign, emit, assertEvent, type ActorRefFrom, type SnapshotFrom, type StateFrom, fromCallback, fromPromise, raise } from 'xstate';
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
} from 'shared-types';
import { toast } from 'sonner';
import logger from '@/lib/logger';

// Constants
const MAX_RECONNECT_ATTEMPTS = parseInt(process.env.NEXT_PUBLIC_MAX_RECONNECT_ATTEMPTS || '3', 10);
const RECONNECT_INTERVAL_MS = parseInt(process.env.NEXT_PUBLIC_RECONNECT_INTERVAL_MS || '3000', 10);
const PEEK_ABILITY_DURATION_MS = 5000;

// #region ----- TYPE DEFINITIONS -----

type ServerToClientEvents =
  | { type: 'CLIENT_GAME_STATE_UPDATED'; gameState: ClientCheckGameState }
  | { type: 'NEW_GAME_LOG'; logMessage: RichGameLogMessage }
  | { type: 'NEW_CHAT_MESSAGE'; chatMessage: ChatMessage }
  | { type: 'INITIAL_PEEK_INFO'; hand: Card[] }
  | { type: 'ABILITY_PEEK_RESULT'; card: Card; playerId: PlayerId; cardIndex: number }
  | { type: 'ERROR_RECEIVED'; error: string }
  | { type: 'INITIAL_LOGS_RECEIVED'; logs: RichGameLogMessage[] };

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
      ack: (response: AttemptRejoinResponse) => void;
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

type EmittedEventToSocket = { type: 'EMIT_TO_SOCKET' } & SocketEmitEvent;

export type UIMachineInput = {
  gameId?: string;
  localPlayerId?: string;
  initialGameState?: ClientCheckGameState;
};

export type PeekedCardInfo = {
  playerId: PlayerId | null;
  cardIndex: number;
  card: Card;
  expireAt?: number;
  source: 'ability' | 'initial-peek';
};

export interface UIMachineContext {
  gameId?: string;
  currentGameState?: ClientCheckGameState;
  localPlayerId?: string;
  playerName?: string;
  currentAbilityContext?: ClientAbilityContext;
  selectedCardIndices: number[];
  visibleCards: PeekedCardInfo[];
  isSidePanelOpen: boolean;
  error: { message: string; details?: string; } | null;
  reconnectionAttempts: number;
  socket: any;
  hasPassedMatch: boolean;
  modal: { type: 'rejoin' | 'error', title: string, message: string } | null;
}

type RejoinPollOutput = {
  gameState: ClientCheckGameState;
  logs: RichGameLogMessage[];
};

export type UIMachineEvents =
  | ServerToClientEvents
  | { type: '_SESSION_ESTABLISHED'; response: CreateGameResponse | JoinGameResponse }
  | { type: 'CONNECTION_ERROR'; message: string }
  | { type: 'CREATE_GAME_REQUESTED'; playerName: string }
  | { type: 'JOIN_GAME_REQUESTED'; playerName: string; gameId: string }
  | { type: 'GAME_CREATED_SUCCESSFULLY'; response: CreateGameResponse }
  | { type: 'GAME_JOINED_SUCCESSFULLY'; response: JoinGameResponse }
  | { type: 'CONNECT' }
  | { type: 'DISCONNECT' }
  | { type: 'LEAVE_GAME' }
  | { type: 'SUBMIT_CHAT_MESSAGE'; message: string }
  | { type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY'; playerId: PlayerId; cardIndex: number }
  | { type: 'CONFIRM_ABILITY_ACTION' }
  | { type: 'SKIP_ABILITY_STAGE' }
  | { type: 'CANCEL_ABILITY' }
  | { type: 'TOGGLE_SIDE_PANEL' }
  | { type: 'RECOVERY_FAILED' }
  | { type: 'CLEANUP_EXPIRED_CARDS' }
  | { type: 'HYDRATE_GAME_STATE'; gameState: ClientCheckGameState }
  | { type: 'DISMISS_MODAL' }
  | { type: PlayerActionType.START_GAME }
  | { type: PlayerActionType.DECLARE_LOBBY_READY }
  | { type: PlayerActionType.REMOVE_PLAYER; payload: { playerId: string } }
  | { type: PlayerActionType.DRAW_FROM_DECK }
  | { type: PlayerActionType.DRAW_FROM_DISCARD }
  | { type: PlayerActionType.SWAP_AND_DISCARD; payload: { cardIndex: number } }
  | { type: PlayerActionType.DISCARD_DRAWN_CARD }
  | { type: PlayerActionType.ATTEMPT_MATCH; payload: { handCardIndex: number } }
  | { type: PlayerActionType.PASS_ON_MATCH_ATTEMPT }
  | { type: PlayerActionType.CALL_CHECK }
  | { type: PlayerActionType.DECLARE_READY_FOR_PEEK }
  | { type: PlayerActionType.PLAY_AGAIN };

// #endregion

export const uiMachine = setup({
  types: {
    context: {} as UIMachineContext,
    events: {} as UIMachineEvents,
    emitted: {} as EmittedEventToSocket | { type: 'NAVIGATE'; path: string },
    input: {} as UIMachineInput,
  },
  actors: {
    cardVisibilityCleanup: fromCallback(({ sendBack }) => {
      const interval = setInterval(() => { sendBack({ type: 'CLEANUP_EXPIRED_CARDS' }); }, 1000);
      return () => clearInterval(interval);
    }),
    rejoinAndPoll: fromPromise<RejoinPollOutput>(async ({ input }) => {
      const { gameId, playerId, socket } = input as { gameId: string; playerId: string, socket: any };
      let attempts = 0;
      while (attempts < MAX_RECONNECT_ATTEMPTS) {
        try {
          const response: AttemptRejoinResponse = await new Promise((resolve, reject) => {
            socket.emit(SocketEventName.ATTEMPT_REJOIN, { gameId, playerId }, (res: AttemptRejoinResponse) => {
              if (res.success) { resolve(res); }
              else { reject(new Error(res.message || 'Rejoin attempt failed')); }
            });
          });
          if (response.success && response.gameState) {
            return { gameState: response.gameState, logs: response.logs ?? [] };
          }
        } catch (error) {
          logger.warn({ error: (error as Error).message, attempt: attempts + 1 }, 'Rejoin attempt failed');
          attempts++;
          if (attempts >= MAX_RECONNECT_ATTEMPTS) { throw new Error('Failed to reconnect after multiple attempts.'); }
          await new Promise(resolve => setTimeout(resolve, RECONNECT_INTERVAL_MS));
        }
      }
      throw new Error('Rejoin polling loop exited unexpectedly.');
    }),
  },
  actions: {
    setCurrentGameState: assign({
      currentGameState: ({ event }) => {
        assertEvent(event, ['CLIENT_GAME_STATE_UPDATED', 'HYDRATE_GAME_STATE', '_SESSION_ESTABLISHED']);
    
        if (event.type === 'CLIENT_GAME_STATE_UPDATED' || event.type === 'HYDRATE_GAME_STATE') {
          return event.gameState;
        }
        
        if (event.type === '_SESSION_ESTABLISHED' && 'gameState' in event.response) {
          return event.response.gameState;
        }
    
        return undefined;
      },
    }),
    addGameLog: assign({
      currentGameState: ({ context, event }) => {
        assertEvent(event, 'NEW_GAME_LOG');
        if (!context.currentGameState) return undefined;
        return { ...context.currentGameState, log: [...context.currentGameState.log, event.logMessage] };
      }
    }),
    addChatMessage: assign({
      currentGameState: ({ context, event }) => {
        assertEvent(event, 'NEW_CHAT_MESSAGE');
        if (!context.currentGameState) return undefined;
        return { ...context.currentGameState, chat: [...context.currentGameState.chat, event.chatMessage] };
      },
    }),
    setInitialLogs: assign({
      currentGameState: ({ context, event }) => {
        assertEvent(event, 'INITIAL_LOGS_RECEIVED');
        if (!context.currentGameState) return undefined;
        return { ...context.currentGameState, log: event.logs };
      }
    }),
    setGameIdAndPlayerId: assign({
      gameId: ({ event }) => {
        assertEvent(event, '_SESSION_ESTABLISHED');
        return event.response.gameId!;
      },
      localPlayerId: ({ event }) => {
        assertEvent(event, '_SESSION_ESTABLISHED');
        return event.response.playerId!;
      },
    }),
    resetGameContext: assign({
        localPlayerId: undefined, gameId: undefined, currentGameState: undefined,
        currentAbilityContext: undefined, visibleCards: [], error: null, reconnectionAttempts: 0,
    }),
    persistSession: ({ event }) => {
      assertEvent(event, '_SESSION_ESTABLISHED');
    
      if (!event.response.success || !event.response.gameId || !event.response.playerId) {
        return;
      }
      
      const sessionData = {
        gameId: event.response.gameId,
        playerId: event.response.playerId
      };
      sessionStorage.setItem('playerSession', JSON.stringify(sessionData));
    
      // The 'gameState' property only exists on the CreateGameResponse, which is handled here.
      if ('gameState' in event.response && event.response.gameState) {
        sessionStorage.setItem('initialGameState', JSON.stringify(event.response.gameState));
      }
    },
    clearInitialGameStateFromSession: () => {
      if (typeof window !== 'undefined') {
        logger.info("Hydration successful. Clearing one-time initialGameState from sessionStorage.");
        sessionStorage.removeItem('initialGameState');
      }
    },
    clearSession: () => { sessionStorage.removeItem('playerSession'); sessionStorage.removeItem('initialGameState'); },
    emitCreateGame: emit(({ self, event }) => {
      assertEvent(event, 'CREATE_GAME_REQUESTED');
      const emittedEvent: EmittedEventToSocket = {
          type: 'EMIT_TO_SOCKET', eventName: SocketEventName.CREATE_GAME, payload: { name: event.playerName },
          ack: (response) => {
              if (response.success) { self.send({ type: 'GAME_CREATED_SUCCESSFULLY', response }); }
              else { toast.error('Failed to create game', { description: response.message }); }
          }
      };
      return emittedEvent;
    }),
    emitJoinGame: emit(({ self, event }) => {
      assertEvent(event, 'JOIN_GAME_REQUESTED');
      const emittedEvent: EmittedEventToSocket = {
          type: 'EMIT_TO_SOCKET', eventName: SocketEventName.JOIN_GAME, payload: [event.gameId, { name: event.playerName }],
          ack: (response) => {
              if (response.success) { self.send({ type: 'GAME_JOINED_SUCCESSFULLY', response }); }
              else { toast.error('Failed to join game', { description: response.message }); }
          }
      };
      return emittedEvent;
    }),
    emitAttemptRejoin: emit(({ context, self }) => {
      const emittedEvent: EmittedEventToSocket = {
          type: 'EMIT_TO_SOCKET', eventName: SocketEventName.ATTEMPT_REJOIN, payload: { gameId: context.gameId!, playerId: context.localPlayerId! },
          ack: (response) => {
              if (response.success && response.gameState) {
                  self.send({ type: 'CLIENT_GAME_STATE_UPDATED', gameState: response.gameState });
                  if (response.logs) { self.send({ type: 'INITIAL_LOGS_RECEIVED', logs: response.logs }); }
              } else { self.send({ type: 'RECOVERY_FAILED' }); }
          }
      };
      return emittedEvent;
    }),
    emitChatMessage: emit(({ context, event }) => {
      assertEvent(event, 'SUBMIT_CHAT_MESSAGE');
      const me = context.currentGameState?.players[context.localPlayerId!];
      const emittedEvent: EmittedEventToSocket = {
          type: 'EMIT_TO_SOCKET', eventName: SocketEventName.SEND_CHAT_MESSAGE,
          payload: { message: event.message, senderId: me!.id, senderName: me!.name, gameId: context.gameId! }
      };
      return emittedEvent;
    }),
    emitStartGame: emit({ type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.START_GAME } }),
    emitDeclareLobbyReady: emit({ type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.DECLARE_LOBBY_READY } }),
    emitRemovePlayer: emit(({ event }) => {
        assertEvent(event, PlayerActionType.REMOVE_PLAYER);
        const emittedEvent: EmittedEventToSocket = { type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.REMOVE_PLAYER, payload: event.payload } };
        return emittedEvent;
    }),
    emitDrawFromDeck: emit({ type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.DRAW_FROM_DECK } }),
    emitDrawFromDiscard: emit({ type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.DRAW_FROM_DISCARD } }),
    emitSwapAndDiscard: emit(({ event }) => {
        assertEvent(event, PlayerActionType.SWAP_AND_DISCARD);
        const emittedEvent: EmittedEventToSocket = { type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.SWAP_AND_DISCARD, payload: event.payload } };
        return emittedEvent;
    }),
    emitDiscardDrawnCard: emit({ type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.DISCARD_DRAWN_CARD } }),
    emitAttemptMatch: emit(({ event }) => {
        assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
        const emittedEvent: EmittedEventToSocket = { type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.ATTEMPT_MATCH, payload: event.payload } };
        return emittedEvent;
    }),
    emitPassOnMatch: emit({ type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.PASS_ON_MATCH_ATTEMPT } }),
    emitCallCheck: emit({ type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.CALL_CHECK } }),
    emitDeclareReadyForPeek: emit({ type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.DECLARE_READY_FOR_PEEK } }),
    emitPlayAgain: emit({ type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.PLAY_AGAIN } }),
    emitConfirmAbility: emit(({ context }) => {
        const ability = context.currentAbilityContext;
        if (!ability) throw new Error('Ability context missing');
        let payload: AbilityActionPayload;
        if (ability.stage === 'peeking') {
            payload = { action: 'peek', targets: ability.selectedPeekTargets };
        } else {
            payload = { action: 'swap', source: ability.selectedSwapTargets[0]!, target: ability.selectedSwapTargets[1]!, sourceCard: ability.sourceCard };
        }
        const emittedEvent: EmittedEventToSocket = { type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.USE_ABILITY, payload } };
        return emittedEvent;
    }),
    emitSkipAbilityStage: emit({ type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.USE_ABILITY, payload: { action: 'skip' } } }),
    showErrorToast: ({ event }) => { assertEvent(event, 'ERROR_RECEIVED'); toast.error(event.error); },
    toggleSidePanel: assign({ isSidePanelOpen: ({ context }) => !context.isSidePanelOpen }),
    addPeekedCardToContext: assign({
      visibleCards: ({ context, event }) => {
        assertEvent(event, 'ABILITY_PEEK_RESULT');
        const newCard: PeekedCardInfo = { playerId: event.playerId, cardIndex: event.cardIndex, card: event.card, source: 'ability', expireAt: Date.now() + PEEK_ABILITY_DURATION_MS };
        return [ ...context.visibleCards.filter(c => !(c.playerId === event.playerId && c.cardIndex === event.cardIndex)), newCard ];
      },
    }),
    setInitialPeekCards: assign({
      visibleCards: ({ context, event }) => {
        assertEvent(event, 'INITIAL_PEEK_INFO');
        if (event.hand.length < 4) return [];
        const bottomCardIndices = [2, 3];
        const peekDuration = 10000;
        return [event.hand[2], event.hand[3]].map((card, idx) => ({
            playerId: context.localPlayerId ?? null, cardIndex: bottomCardIndices[idx]!, card, source: 'initial-peek' as const, expireAt: Date.now() + peekDuration
        }));
      },
    }),
    clearTemporaryCardStates: assign({ visibleCards: [], selectedCardIndices: [] }),
    syncAbilityContext: assign({
      currentAbilityContext: ({ context }) => {
        const serverAbilityStack = context.currentGameState?.abilityStack ?? [];
        if (serverAbilityStack.length === 0 || serverAbilityStack.at(-1)!.playerId !== context.localPlayerId) return undefined;
        const topServerAbility = serverAbilityStack.at(-1)!;
        const currentClientAbility = context.currentAbilityContext;
        if (!currentClientAbility || currentClientAbility.type !== topServerAbility.type || currentClientAbility.stage !== topServerAbility.stage) {
          const { type, stage, playerId, sourceCard } = topServerAbility;
          return { type, stage, playerId, sourceCard,
            maxPeekTargets: type === 'king' ? 2 : (type === 'peek' ? 1 : 0),
            maxSwapTargets: type === 'swap' || type === 'king' ? 2 : 0,
            selectedPeekTargets: [], selectedSwapTargets: [], peekedCards: [],
          };
        }
        return currentClientAbility;
      },
    }),
    clearAbilityContext: assign({ currentAbilityContext: undefined }),
    setAbilityPeekTarget: assign({
      currentAbilityContext: ({ context, event }) => {
        assertEvent(event, 'PLAYER_SLOT_CLICKED_FOR_ABILITY');
        if (!context.currentAbilityContext || context.currentAbilityContext.stage !== 'peeking') return context.currentAbilityContext;
        const { playerId, cardIndex } = event;
        const { maxPeekTargets, selectedPeekTargets } = context.currentAbilityContext;
        const newTarget = { playerId, cardIndex };
        const isAlreadySelected = selectedPeekTargets.some(t => t.playerId === playerId && t.cardIndex === cardIndex);
        let newSelectedTargets: PeekTarget[];
        if (isAlreadySelected) {
          newSelectedTargets = selectedPeekTargets.filter(t => !(t.playerId === playerId && t.cardIndex === cardIndex));
        } else {
          newSelectedTargets = [...selectedPeekTargets, newTarget].slice(-maxPeekTargets);
        }
        return { ...context.currentAbilityContext, selectedPeekTargets: newSelectedTargets };
      },
    }),
    setAbilitySwapTarget: assign({
      currentAbilityContext: ({ context, event }) => {
        assertEvent(event, 'PLAYER_SLOT_CLICKED_FOR_ABILITY');
        if (!context.currentAbilityContext || context.currentAbilityContext.stage !== 'swapping') return context.currentAbilityContext;
        const { selectedSwapTargets } = context.currentAbilityContext;
        const newTarget = { playerId: event.playerId, cardIndex: event.cardIndex };
        const isAlreadySelected = selectedSwapTargets.some(t => t.playerId === event.playerId && t.cardIndex === event.cardIndex);
        let newSelectedTargets: SwapTarget[];
        if (isAlreadySelected) {
          newSelectedTargets = selectedSwapTargets.filter(t => !(t.playerId === event.playerId && t.cardIndex === event.cardIndex));
        } else {
          newSelectedTargets = [...selectedSwapTargets, newTarget].slice(-2);
        }
        return { ...context.currentAbilityContext, selectedSwapTargets: newSelectedTargets };
      }
    }),
    incrementReconnectionAttempts: assign({ reconnectionAttempts: ({ context }) => context.reconnectionAttempts + 1 }),
    resetReconnectionAttempts: assign({ reconnectionAttempts: 0 }),
    cleanupExpiredVisibleCards: assign({ visibleCards: ({ context }) => context.visibleCards.filter(vc => !vc.expireAt || vc.expireAt > Date.now()) }),
    dismissModal: assign({ modal: null }),
    redirectToHome: () => { if (typeof window !== 'undefined') { window.location.href = '/'; } },
  },
  guards: {
    isAbilityActionComplete: ({ context }) => {
        const ability = context.currentAbilityContext;
        if (!ability) return false;
        if (ability.stage === 'peeking') return ability.selectedPeekTargets.length === ability.maxPeekTargets;
        if (ability.stage === 'swapping') return ability.selectedSwapTargets.length === 2;
        return false;
      },
    canAttemptReconnection: ({ context }) => context.reconnectionAttempts < MAX_RECONNECT_ATTEMPTS,
  },
}).createMachine({
  id: 'ui',
  context: ({ input }) => ({
    localPlayerId: input.localPlayerId,
    gameId: input.gameId,
    currentGameState: input.initialGameState,
    currentAbilityContext: undefined,
    visibleCards: [],
    isSidePanelOpen: false,
    error: null,
    reconnectionAttempts: 0,
    socket: undefined,
    playerName: undefined,
    selectedCardIndices: [],
    hasPassedMatch: false,
    modal: null,
  }),
  initial: 'initializing',
  on: {
    _SESSION_ESTABLISHED: {
      target: '.inGame',
      actions: [
        'setGameIdAndPlayerId',
        'setCurrentGameState',
        'persistSession',
        emit(({ event }) => ({ type: 'NAVIGATE', path: `/game/${event.response.gameId}` })),
      ],
    },
    DISCONNECT: { target: '.inGame.disconnected' },
    ERROR_RECEIVED: { actions: 'showErrorToast' },
    CONNECTION_ERROR: { actions: 'showErrorToast' },
  },
  states: {
    initializing: {
      always: [
        { 
          target: 'inGame', 
          guard: ({ context }) => !!context.currentGameState, 
          description: "Has initial game state provided via input. Hydrate immediately.",
          actions: ['clearInitialGameStateFromSession']
        },
        { 
          target: 'inGame.promptToJoin', 
          guard: ({ context }) => !!context.gameId && !context.localPlayerId, 
          description: "Has a game ID from URL, but no player ID from session. Must prompt to join." 
        },
        { 
          target: 'inGame.reconnecting', 
          guard: ({ context }) => !!context.localPlayerId && !context.currentGameState 
        },
        { target: 'outOfGame' },
      ],
      on: { HYDRATE_GAME_STATE: { target: 'inGame', actions: 'setCurrentGameState' }, },
    },
    outOfGame: {
      id: 'outOfGame',
      on: {
        CREATE_GAME_REQUESTED: { actions: 'emitCreateGame' },
        JOIN_GAME_REQUESTED: { actions: 'emitJoinGame' },
        GAME_CREATED_SUCCESSFULLY: {
          actions: raise(({ event }) => ({
            type: '_SESSION_ESTABLISHED',
            response: event.response,
          })),
        },
        GAME_JOINED_SUCCESSFULLY: {
          actions: raise(({ event }) => ({
            type: '_SESSION_ESTABLISHED',
            response: event.response,
          })),
        },
      },
    },
    inGame: {
      id: 'inGame',
      initial: 'routing',
      on: {
        LEAVE_GAME: { target: '.leaving' },
        TOGGLE_SIDE_PANEL: { actions: 'toggleSidePanel' },
        CLIENT_GAME_STATE_UPDATED: { 
            target: '.routing', 
            actions: [
                assign({ hasPassedMatch: false }),
                'setCurrentGameState', 
                'syncAbilityContext'
            ] as const
        },
        HYDRATE_GAME_STATE: { target: '.routing', actions: ['setCurrentGameState', 'syncAbilityContext'] },
        NEW_GAME_LOG: { actions: 'addGameLog' },
        NEW_CHAT_MESSAGE: { actions: 'addChatMessage' },
        INITIAL_LOGS_RECEIVED: { actions: 'setInitialLogs' },
        SUBMIT_CHAT_MESSAGE: { actions: 'emitChatMessage' },
        INITIAL_PEEK_INFO: { actions: 'setInitialPeekCards' },
        ABILITY_PEEK_RESULT: { actions: 'addPeekedCardToContext' },
        START_GAME: { actions: 'emitStartGame' },
        DECLARE_LOBBY_READY: { actions: 'emitDeclareLobbyReady' },
        REMOVE_PLAYER: { actions: 'emitRemovePlayer' },
        DRAW_FROM_DECK: { actions: 'emitDrawFromDeck' },
        DRAW_FROM_DISCARD: { actions: 'emitDrawFromDiscard' },
        SWAP_AND_DISCARD: { actions: 'emitSwapAndDiscard' },
        DISCARD_DRAWN_CARD: { actions: 'emitDiscardDrawnCard' },
        ATTEMPT_MATCH: { actions: 'emitAttemptMatch' },
        PASS_ON_MATCH_ATTEMPT: { 
          actions: [
              'emitPassOnMatch',
              assign({ hasPassedMatch: true })
          ] as const 
        },
        CALL_CHECK: { actions: 'emitCallCheck' },
        DECLARE_READY_FOR_PEEK: { actions: 'emitDeclareReadyForPeek' },
        PLAY_AGAIN: { actions: 'emitPlayAgain' },
        DISMISS_MODAL: { actions: 'dismissModal' },
      },
      states: {
        routing: {
          always: [
            { target: 'lobby', guard: ({ context }) => context.currentGameState?.gameStage === GameStage.WAITING_FOR_PLAYERS },
            { target: 'initialPeek', guard: ({ context }) => context.currentGameState?.gameStage === GameStage.INITIAL_PEEK },
            { target: 'playing', guard: ({ context }) => context.currentGameState?.gameStage === GameStage.PLAYING },
            { target: 'finalTurns', guard: ({ context }) => context.currentGameState?.gameStage === GameStage.FINAL_TURNS },
            { target: 'scoring', guard: ({ context }) => context.currentGameState?.gameStage === GameStage.SCORING },
            { target: 'gameover', guard: ({ context }) => context.currentGameState?.gameStage === GameStage.GAMEOVER },
            { target: '#outOfGame', actions: () => logger.warn('Routing fallback: no matching game state, returning to outOfGame.') }
          ]
        },
        lobby: { tags: ['lobby'] },
        initialPeek: {
            tags: ['peeking'],
            invoke: { src: 'cardVisibilityCleanup' },
            on: { CLEANUP_EXPIRED_CARDS: { actions: 'cleanupExpiredVisibleCards' } },
        },
        playing: {
            tags: ['playing'],
            entry: 'clearTemporaryCardStates',
            invoke: { src: 'cardVisibilityCleanup' },
            always: [{ target: 'ability', guard: ({ context }) => !!context.currentAbilityContext?.playerId }],
            on: { CLEANUP_EXPIRED_CARDS: { actions: 'cleanupExpiredVisibleCards' } },
        },
        finalTurns: {
            tags: ['playing'],
            always: [{ target: 'ability', guard: ({ context }) => !!context.currentAbilityContext?.playerId }],
        },
        ability: {
            tags: ['ability'],
            initial: 'evaluating',
            states: {
                evaluating: {
                    always: [
                        { target: 'peeking', guard: ({ context }) => context.currentAbilityContext?.stage === 'peeking' },
                        { target: 'swapping', guard: ({ context }) => context.currentAbilityContext?.stage === 'swapping' },
                        { target: '#inGame.routing' }
                    ]
                },
                peeking: {
                    on: {
                        PLAYER_SLOT_CLICKED_FOR_ABILITY: { actions: 'setAbilityPeekTarget' },
                        CONFIRM_ABILITY_ACTION: { target: 'evaluating', guard: 'isAbilityActionComplete' as const, actions: 'emitConfirmAbility' },
                        SKIP_ABILITY_STAGE: { target: 'evaluating', actions: 'emitSkipAbilityStage' },
                    }
                },
                swapping: {
                    on: {
                        PLAYER_SLOT_CLICKED_FOR_ABILITY: { actions: 'setAbilitySwapTarget' },
                        CONFIRM_ABILITY_ACTION: { target: 'evaluating', guard: 'isAbilityActionComplete' as const, actions: 'emitConfirmAbility' },
                        SKIP_ABILITY_STAGE: { target: 'evaluating', actions: 'emitSkipAbilityStage' },
                    }
                }
            },
            on: { CANCEL_ABILITY: { target: 'playing', actions: 'clearAbilityContext' } },
        },
        scoring: { tags: ['scoring'] },
        gameover: { tags: ['gameover'] },
        leaving: { entry: ['resetGameContext', 'clearSession', 'redirectToHome'] },
        disconnected: {
          tags: ['recovering'],
          entry: 'incrementReconnectionAttempts',
          always: { target: 'reconnecting', guard: 'canAttemptReconnection' as const },
          on: { RECOVERY_FAILED: { target: 'recoveryFailed' } }
        },
        reconnecting: {
          tags: ['recovering'],
          invoke: {
            src: 'rejoinAndPoll',
            input: ({ context }) => ({ gameId: context.gameId!, playerId: context.localPlayerId!, socket: context.socket }),
            onDone: { target: 'routing', actions: assign({ currentGameState: ({ event }) => event.output.gameState, reconnectionAttempts: 0 }) },
            onError: { target: 'disconnected' },
          },
        },
        recoveryFailed: { entry: ['clearSession', 'redirectToHome'] },
        promptToJoin: {
          tags: ['prompting'],
          entry: assign({
            modal: {
              type: 'rejoin' as const,
              title: 'Join Game',
              message: 'You have been invited to a game. Please enter your name to join.'
            }
          }),
          on: {
            JOIN_GAME_REQUESTED: {
              target: 'routing', 
              actions: ['emitJoinGame', 'dismissModal']
            }
          }
        },
      },
    },
  },
});

export type UIMachineActorRef = ActorRefFrom<typeof uiMachine>;
export type UIMachineState = SnapshotFrom<typeof uiMachine>;
export type UIMachineSnapshot = StateFrom<typeof uiMachine>;