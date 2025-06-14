import { setup, assign, emit, assertEvent, type ActorRefFrom, type SnapshotFrom, type StateFrom, fromCallback, fromPromise, raise, enqueueActions } from 'xstate';
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
  CardRank,
} from 'shared-types';
import { toast } from 'sonner';
import logger from '@/lib/logger';
import { createGameActor, joinGameActor, rejoinActor } from '@/lib/actors';

// Constants
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
      eventName: SocketEventName.SEND_CHAT_MESSAGE;
      payload: { message: string; senderId: string; senderName: string; gameId: string };
    }
  | {
      eventName: SocketEventName.PLAYER_ACTION;
      payload: { type: PlayerActionType | string; payload?: any };
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
  hasPassedMatch: boolean;
  modal: { type: 'rejoin' | 'error', title: string, message: string } | null;
}

export type UIMachineEvents =
  | ServerToClientEvents
  | { type: '_SESSION_ESTABLISHED'; response: CreateGameResponse | JoinGameResponse }
  | { type: 'CREATE_GAME_REQUESTED'; playerName: string }
  | { type: 'JOIN_GAME_REQUESTED'; playerName: string; gameId: string }
  | { type: 'LEAVE_GAME' }
  | { type: 'SUBMIT_CHAT_MESSAGE'; message: string }
  | { type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY'; playerId: PlayerId; cardIndex: number }
  | { type: 'CONFIRM_ABILITY_ACTION' }
  | { type: 'SKIP_ABILITY_STAGE' }
  | { type: 'CANCEL_ABILITY' }
  | { type: 'TOGGLE_SIDE_PANEL' }
  | { type: 'CLEANUP_EXPIRED_CARDS' }
  | { type: 'DISMISS_MODAL' }
  | { type: 'RECOVERY_FAILED' }
  | { type: 'CONNECTION_ERROR'; message: string }
  | { type: 'CONNECT' }
  | { type: 'DISCONNECT' }
  | { type: PlayerActionType.START_GAME }
  | { type: PlayerActionType.DECLARE_LOBBY_READY }
  | { type: PlayerActionType.REMOVE_PLAYER; payload: { playerIdToRemove: string } }
  | { type: PlayerActionType.DRAW_FROM_DECK }
  | { type: PlayerActionType.DRAW_FROM_DISCARD }
  | { type: PlayerActionType.SWAP_AND_DISCARD; payload: { handCardIndex: number } }
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
    createGame: createGameActor,
    joinGame: joinGameActor,
    rejoinAndPoll: rejoinActor,
  },
  actions: {
    setCurrentGameState: assign({
      currentGameState: ({ event }) => {
        assertEvent(event, ['CLIENT_GAME_STATE_UPDATED', '_SESSION_ESTABLISHED']);
        if (event.type === 'CLIENT_GAME_STATE_UPDATED') return event.gameState;
        if (event.type === '_SESSION_ESTABLISHED' && 'gameState' in event.response) return event.response.gameState;
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
      gameId: ({ event }) => { assertEvent(event, '_SESSION_ESTABLISHED'); return event.response.gameId!; },
      localPlayerId: ({ event }) => { assertEvent(event, '_SESSION_ESTABLISHED'); return event.response.playerId!; },
    }),
    resetGameContext: assign({
        localPlayerId: undefined, gameId: undefined, currentGameState: undefined,
        currentAbilityContext: undefined, visibleCards: [], error: null, reconnectionAttempts: 0,
    }),
    persistSession: ({ event }) => {
      assertEvent(event, '_SESSION_ESTABLISHED');
      if (!event.response.success || !event.response.gameId || !event.response.playerId) return;
      const sessionData = { gameId: event.response.gameId, playerId: event.response.playerId };
      sessionStorage.setItem('playerSession', JSON.stringify(sessionData));
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
    clearSession: () => { 
      sessionStorage.removeItem('playerSession'); 
      sessionStorage.removeItem('initialGameState'); 
    },
    emitChatMessage: emit(({ context, event }) => {
      assertEvent(event, 'SUBMIT_CHAT_MESSAGE');
      const me = context.currentGameState?.players[context.localPlayerId!];
      return {
        type: 'EMIT_TO_SOCKET',
        eventName: SocketEventName.PLAYER_ACTION,
        payload: {
          type: PlayerActionType.SEND_CHAT_MESSAGE,
          payload: {
            message: event.message,
            senderId: me!.id,
            senderName: me!.name,
            gameId: context.gameId!,
          },
        },
      } as const;
    }),
    emitPlayerAction: emit(({ event }) => {
      const { type, ...rest } = event as any;
      return {
        type: 'EMIT_TO_SOCKET',
        eventName: SocketEventName.PLAYER_ACTION,
        payload: { type, ...rest }
      } as const;
    }),
    emitConfirmAbility: emit(({ context }) => {
      const ability = context.currentAbilityContext;
      if (!ability) throw new Error('Ability context missing');
      let payload: AbilityActionPayload;
      if (ability.stage === 'peeking') {
        payload = { action: 'peek', targets: ability.selectedPeekTargets };
      } else {
        payload = { action: 'swap', source: ability.selectedSwapTargets[0]!, target: ability.selectedSwapTargets[1]!, sourceCard: ability.sourceCard };
      }
      return { type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.USE_ABILITY, payload } } as const;
    }),
    emitSkipAbilityStage: emit({ type: 'EMIT_TO_SOCKET', eventName: SocketEventName.PLAYER_ACTION, payload: { type: PlayerActionType.USE_ABILITY, payload: { action: 'skip' } } } as const),
    showErrorToast: ({ event }) => { 
      assertEvent(event, 'ERROR_RECEIVED'); 
      toast.error(event.error); 
    },
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
        const localPlayerId = context.localPlayerId;
        const handSize = context.currentGameState?.players[localPlayerId!]?.hand.length ?? 0;
        if (!localPlayerId || event.hand.length === 0) return [];
        const peekDuration = 10000;
        return event.hand.map((card, idx) => ({
            playerId: localPlayerId, 
            cardIndex: (handSize - event.hand.length) + idx, 
            card, 
            source: 'initial-peek' as const, 
            expireAt: Date.now() + peekDuration
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
    setAbilityPeekTarget: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, 'PLAYER_SLOT_CLICKED_FOR_ABILITY');
      const ability = context.currentAbilityContext;

      if (!ability || ability.stage !== 'peeking') {
        return;
      }

      const { playerId, cardIndex } = event;
      const { maxPeekTargets, selectedPeekTargets } = ability;
      const newTarget = { playerId, cardIndex };
      const isAlreadySelected = selectedPeekTargets.some(t => t.playerId === playerId && t.cardIndex === cardIndex);
      
      let newSelectedTargets: PeekTarget[];
      if (isAlreadySelected) {
        newSelectedTargets = selectedPeekTargets.filter(t => !(t.playerId === playerId && t.cardIndex === cardIndex));
      } else {
        newSelectedTargets = [...selectedPeekTargets, newTarget].slice(-maxPeekTargets);
      }
      
      enqueue.assign({
        currentAbilityContext: { ...ability, selectedPeekTargets: newSelectedTargets }
      });
    }),
    setAbilitySwapTarget: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, 'PLAYER_SLOT_CLICKED_FOR_ABILITY');
      const ability = context.currentAbilityContext;

      if (!ability || ability.stage !== 'swapping') {
        return;
      }
      
      const { selectedSwapTargets } = ability;
      const newTarget = { playerId: event.playerId, cardIndex: event.cardIndex };
      const isAlreadySelected = selectedSwapTargets.some(t => t.playerId === event.playerId && t.cardIndex === event.cardIndex);
      
      let newSelectedTargets: SwapTarget[];
      if (isAlreadySelected) {
        newSelectedTargets = selectedSwapTargets.filter(t => !(t.playerId === event.playerId && t.cardIndex === event.cardIndex));
      } else {
        newSelectedTargets = [...selectedSwapTargets, newTarget].slice(-2);
      }
      
      enqueue.assign({
        currentAbilityContext: { ...ability, selectedSwapTargets: newSelectedTargets }
      });
    }),
    incrementReconnectionAttempts: assign({ reconnectionAttempts: ({ context }) => context.reconnectionAttempts + 1 }),
    resetReconnectionAttempts: assign({ reconnectionAttempts: 0 }),
    cleanupExpiredVisibleCards: assign({ visibleCards: ({ context }) => context.visibleCards.filter(vc => !vc.expireAt || vc.expireAt > Date.now()) }),
    dismissModal: assign({ modal: null }),
    redirectToHome: () => { if (typeof window !== 'undefined') { window.location.href = '/'; } },
    logInitializing: ({ context }) => {
      logger.info(
        {
          machine: 'uiMachine',
          state: 'initializing',
          context: {
            gameId: context.gameId,
            localPlayerId: context.localPlayerId,
            hasGameState: !!context.currentGameState,
          },
        },
        'Machine entered initializing state'
      );
    },
    logToOutOfGame: () => logger.info({ machine: 'uiMachine', transition: 'to outOfGame' }, 'Routing to out-of-game'),
    logToInGame: () => logger.info({ machine: 'uiMachine', transition: 'to inGame' }, 'Routing to in-game (hydrated)'),
    logToPromptToJoin: () => logger.info({ machine: 'uiMachine', transition: 'to promptToJoin' }, 'Routing to promptToJoin'),
    logToReconnecting: () => logger.info({ machine: 'uiMachine', transition: 'to reconnecting' }, 'Routing to reconnecting'),
    logJoiningGame: () => logger.info({ machine: 'uiMachine', event: 'JOIN_GAME_REQUESTED' }, 'Invoking joinGame actor'),
    logSessionEstablished: () => logger.info({ machine: 'uiMachine', event: '_SESSION_ESTABLISHED' }, 'Session established'),
    log_ENTER_LOBBY: () => logger.info({ machine: 'ui', view: 'Lobby' }, 'UI state entered Lobby'),
    log_ENTER_INITIAL_PEEK: () => logger.info({ machine: 'ui', view: 'Initial Peek' }, 'UI state entered Initial Peek'),
    log_ENTER_GAME_BOARD: () => logger.info({ machine: 'ui', view: 'Game Board' }, 'UI state entered main gameplay'),
    log_ENTER_SCORING: () => logger.info({ machine: 'ui', view: 'Scoring' }, 'UI state entered Scoring'),
    log_ENTER_GAMEOVER: () => logger.info({ machine: 'ui', view: 'Game Over' }, 'UI state entered Game Over'),
  },
  guards: {
    isAbilityActionComplete: ({ context }) => {
        const ability = context.currentAbilityContext;
        if (!ability) return false;
        if (ability.stage === 'peeking') return ability.selectedPeekTargets.length === ability.maxPeekTargets;
        if (ability.stage === 'swapping') return ability.selectedSwapTargets.length === 2;
        return false;
      },
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
    hasPassedMatch: false,
    modal: null,
    selectedCardIndices: [],
  }),
  initial: 'initializing',
  on: {
    _SESSION_ESTABLISHED: {
      target: '.inGame',
      actions: [
        'dismissModal',
        'setGameIdAndPlayerId',
        'setCurrentGameState',
        'persistSession',
        emit(({ event }) => ({ type: 'NAVIGATE', path: `/game/${event.response.gameId}` })),
      ],
    },
    ERROR_RECEIVED: { actions: 'showErrorToast' },
  },
  states: {
    initializing: {
      entry: 'logInitializing',
      always: [
        { 
          target: 'inGame', 
          guard: ({ context }) => !!context.currentGameState, 
          description: "Has initial game state provided via input. Hydrate immediately.",
          actions: ['clearInitialGameStateFromSession', 'logToInGame']
        },
        { 
          target: 'inGame.promptToJoin', 
          guard: ({ context }) => !!context.gameId && !context.localPlayerId, 
          description: "Has a game ID from URL, but no player ID from session.",
          actions: 'logToPromptToJoin'
        },
        { 
          target: 'inGame.reconnecting', 
          guard: ({ context }) => !!context.localPlayerId && !context.currentGameState,
          actions: 'logToReconnecting'
        },
        { target: 'outOfGame', actions: 'logToOutOfGame' },
      ]
    },
    outOfGame: {
      id: 'outOfGame',
      initial: 'idle',
      states: {
        idle: { tags: ['idle'] },
        creatingGame: {
          tags: ['loading'],
          invoke: {
            src: 'createGame',
            input: ({ event }) => {
              assertEvent(event, 'CREATE_GAME_REQUESTED');
              return { name: event.playerName };
            },
            onDone: {
              target: 'idle',
              actions: raise(({ event }) => ({ type: '_SESSION_ESTABLISHED', response: event.output })),
            },
            onError: {
              target: 'idle',
              actions: ({ event }) => toast.error('Failed to create game', { description: (event.error as Error).message }),
            },
          },
        },
        joiningGame: {
          tags: ['loading'],
          invoke: {
            src: 'joinGame',
            input: ({event}) => {
              assertEvent(event, 'JOIN_GAME_REQUESTED');
              return { gameId: event.gameId, name: event.playerName };
            },
            onDone: {
              target: 'idle',
              actions: ['logSessionEstablished', raise(({ event }) => ({ type: '_SESSION_ESTABLISHED', response: event.output }))],
            },
            onError: {
              target: 'idle',
              actions: ({ event }) => toast.error('Failed to join game', { description: (event.error as Error).message }),
            },
          },
        },
      },
      on: {
        CREATE_GAME_REQUESTED: { target: '.creatingGame' },
        JOIN_GAME_REQUESTED: { target: '.joiningGame' },
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
            ]
        },
        INITIAL_LOGS_RECEIVED: { actions: 'setInitialLogs' },
        NEW_GAME_LOG: { actions: 'addGameLog' },
        NEW_CHAT_MESSAGE: { actions: 'addChatMessage' },
        SUBMIT_CHAT_MESSAGE: { actions: 'emitChatMessage' },
        INITIAL_PEEK_INFO: { actions: 'setInitialPeekCards' },
        ABILITY_PEEK_RESULT: { actions: 'addPeekedCardToContext' },
        START_GAME: { actions: 'emitPlayerAction' },
        DECLARE_LOBBY_READY: { actions: 'emitPlayerAction' },
        REMOVE_PLAYER: { actions: 'emitPlayerAction' },
        DRAW_FROM_DECK: { actions: 'emitPlayerAction' },
        DRAW_FROM_DISCARD: { actions: 'emitPlayerAction' },
        SWAP_AND_DISCARD: { actions: 'emitPlayerAction' },
        DISCARD_DRAWN_CARD: { actions: 'emitPlayerAction' },
        ATTEMPT_MATCH: { actions: 'emitPlayerAction' },
        PASS_ON_MATCH_ATTEMPT: { 
          actions: [
              'emitPlayerAction',
              assign({ hasPassedMatch: true })
          ] 
        },
        CALL_CHECK: { actions: 'emitPlayerAction' },
        DECLARE_READY_FOR_PEEK: { actions: 'emitPlayerAction' },
        PLAY_AGAIN: { actions: 'emitPlayerAction' },
        DISMISS_MODAL: { actions: 'dismissModal' },
        CONFIRM_ABILITY_ACTION: { actions: 'emitConfirmAbility' },
        SKIP_ABILITY_STAGE: { actions: 'emitSkipAbilityStage' },
        CANCEL_ABILITY: { actions: 'clearAbilityContext' },
        DISCONNECT: { target: '.disconnected' },
      },
      states: {
        routing: {
          always: [
            { target: 'lobby', guard: ({ context }) => context.currentGameState?.gameStage === GameStage.WAITING_FOR_PLAYERS },
            { target: 'dealing', guard: ({ context }) => context.currentGameState?.gameStage === GameStage.DEALING },
            { target: 'initialPeek', guard: ({ context }) => context.currentGameState?.gameStage === GameStage.INITIAL_PEEK },
            { target: 'playing', guard: ({ context }) => context.currentGameState?.gameStage === GameStage.PLAYING },
            { target: 'finalTurns', guard: ({ context }) => context.currentGameState?.gameStage === GameStage.FINAL_TURNS },
            { target: 'scoring', guard: ({ context }) => context.currentGameState?.gameStage === GameStage.SCORING },
            { target: 'gameover', guard: ({ context }) => context.currentGameState?.gameStage === GameStage.GAMEOVER },
            { target: '#outOfGame', actions: () => logger.warn('Routing fallback: no matching game state, returning to outOfGame.') }
          ]
        },
        lobby: { entry: 'log_ENTER_LOBBY', tags: ['lobby', 'playing'] },
        initialPeek: {
            entry: 'log_ENTER_INITIAL_PEEK',
            tags: ['peeking', 'playing'],
            invoke: { src: 'cardVisibilityCleanup' },
            on: { CLEANUP_EXPIRED_CARDS: { actions: 'cleanupExpiredVisibleCards' } },
        },
        dealing: {
          tags: ['playing'],
        },
        playing: {
            tags: ['playing'],
            entry: 'log_ENTER_GAME_BOARD',
            invoke: { src: 'cardVisibilityCleanup' },
            always: [{ target: 'ability', guard: ({ context }) => !!context.currentAbilityContext?.playerId }],
            on: { CLEANUP_EXPIRED_CARDS: { actions: 'cleanupExpiredVisibleCards' } },
        },
        finalTurns: {
            tags: ['playing'],
            always: [{ target: 'ability', guard: ({ context }) => !!context.currentAbilityContext?.playerId }],
        },
        ability: {
            tags: ['ability', 'playing'],
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
                        CONFIRM_ABILITY_ACTION: { target: 'evaluating', guard: 'isAbilityActionComplete', actions: 'emitConfirmAbility' },
                        SKIP_ABILITY_STAGE: { target: 'evaluating', actions: 'emitSkipAbilityStage' },
                    }
                },
                swapping: {
                    on: {
                        PLAYER_SLOT_CLICKED_FOR_ABILITY: { actions: 'setAbilitySwapTarget' },
                        CONFIRM_ABILITY_ACTION: { target: 'evaluating', guard: 'isAbilityActionComplete', actions: 'emitConfirmAbility' },
                        SKIP_ABILITY_STAGE: { target: 'evaluating', actions: 'emitSkipAbilityStage' },
                    }
                }
            },
            on: { CANCEL_ABILITY: { target: 'playing', actions: 'clearAbilityContext' } },
        },
        scoring: { entry: 'log_ENTER_SCORING', tags: ['scoring', 'playing'] },
        gameover: { entry: 'log_ENTER_GAMEOVER', tags: ['gameover', 'playing'] },
        leaving: { entry: ['resetGameContext', 'clearSession', 'redirectToHome'] },
        disconnected: {
          tags: ['recovering'],
          entry: 'incrementReconnectionAttempts',
          on: {
            CONNECT: { target: 'reconnecting' },
          },
        },
        reconnecting: {
          tags: ['recovering', 'loading'],
          invoke: {
            src: 'rejoinAndPoll',
            input: ({ context }) => ({
              gameId: context.gameId!,
              playerId: context.localPlayerId!,
            }),
            onDone: {
              target: 'routing',
              actions: [
                assign({ 
                    currentGameState: ({ event }) => event.output.gameState, 
                    reconnectionAttempts: 0 
                }),
                enqueueActions(({ event, enqueue }) => {
                  if (event.output.logs && event.output.logs.length > 0) {
                    enqueue.raise({
                      type: 'INITIAL_LOGS_RECEIVED',
                      logs: event.output.logs,
                    });
                  }
                }),
              ],
            },
            onError: {
              target: 'disconnected',
            },
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
              target: 'joiningGame',
              actions: 'logJoiningGame'
            }
          }
        },
        joiningGame: {
          tags: ['loading'],
          invoke: {
            src: 'joinGame',
            input: ({ event }) => {
              assertEvent(event, 'JOIN_GAME_REQUESTED');
              return { gameId: event.gameId, name: event.playerName };
            },
            onDone: {
              actions: ['logSessionEstablished', raise(({ event }) => ({ type: '_SESSION_ESTABLISHED', response: event.output }))],
            },
            onError: {
              target: 'promptToJoin',
              actions: ({ event }) => toast.error('Failed to join game', { description: (event.error as Error).message }),
            },
          },
        },
      },
    },
  },
});

export type UIMachineActorRef = ActorRefFrom<typeof uiMachine>;
export type UIMachineState = SnapshotFrom<typeof uiMachine>;
export type UIMachineSnapshot = StateFrom<typeof uiMachine>;