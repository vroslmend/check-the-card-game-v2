import { setup, assign, emit, assertEvent, type ActorRefFrom, type SnapshotFrom, fromPromise } from 'xstate';
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
  abilityContext: ClientAbilityContext | null;
  peekedCard: { card: Card; playerId: PlayerId; cardIndex: number } | null;
  initialPeekCards: Card[] | null;
  chatMessages: ChatMessage[];
  gameLog: RichGameLogMessage[];
  isSidePanelOpen: boolean;
  error: {
    message: string;
    details?: string;
  } | null;
};

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
  | { type: 'PLAY_CARD'; cardIndex: number }
  | { type: 'DRAW_CARD' }
  | { type: 'PLAYER_ACTION'; payload: { type: PlayerActionType; payload?: any } }
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
    setGameIdAndPlayerId: assign(({ event }) => {
      assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
      return {
        gameId: event.response.gameId,
        localPlayerId: event.response.playerId,
      };
    }),
    setInitialGameState: assign(({ event }) => {
        assertEvent(event, ['GAME_CREATED_SUCCESSFULLY', 'GAME_JOINED_SUCCESSFULLY']);
  
        if (event.type === 'GAME_JOINED_SUCCESSFULLY' && event.response.gameState) {
          return { currentGameState: event.response.gameState };
        }
  
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
          matchingOpportunity: null,
          checkDetails: null,
          gameover: null,
          lastRoundLoserId: null,
          log: [],
          chat: [],
        };
        return { currentGameState: defaultGameState };
      }),
    resetGameContext: assign({
        localPlayerId: null,
        gameId: null,
        currentGameState: null,
        abilityContext: null,
        peekedCard: null,
        initialPeekCards: null,
        chatMessages: [],
        gameLog: [],
        error: null,
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
    emitPlayCard: emit(({ event }) => {
      assertEvent(event, 'PLAY_CARD');
      return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.PLAYER_ACTION,
        payload: {
          type: PlayerActionType.SWAP_AND_DISCARD,
          payload: { handCardIndex: event.cardIndex },
        },
      };
    }),
    emitDrawCard: emit(({ context }) => ({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.PLAYER_ACTION,
      payload: { type: PlayerActionType.DRAW_FROM_DECK, playerId: context.localPlayerId },
    })),
    emitPlayerAction: emit(({ event }) => {
      assertEvent(event, 'PLAYER_ACTION');
      return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.PLAYER_ACTION,
        payload: event.payload,
      };
    }),
    emitSendMessage: emit(({ event }) => {
      assertEvent(event, 'SUBMIT_CHAT_MESSAGE');
      const { type, ...payload } = event;
      return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.SEND_CHAT_MESSAGE,
        payload,
      };
    }),
    emitUseAbility: emit(({ context }) => {
      const { abilityContext } = context;
      if (!abilityContext) {
        // This case should be prevented by the guard on the transition,
        // but this check satisfies TypeScript and provides a fallback.
        console.error("Attempted to use ability without a valid context.");
        return {
          type: 'EMIT_TO_SOCKET' as const,
          eventName: SocketEventName.ERROR_MESSAGE,
          payload: { message: 'Client error: ability context missing.' },
        };
      }

      let payload: AbilityActionPayload;

      if (abilityContext.stage === 'peeking') {
        payload = {
          action: 'peek',
          targets: abilityContext.selectedPeekTargets,
        };
      } else { // 'swapping' stage
        payload = {
          action: 'swap',
          source: abilityContext.selectedSwapTargets[0]!,
          target: abilityContext.selectedSwapTargets[1]!,
        };
      }

      return {
        type: 'EMIT_TO_SOCKET' as const,
        eventName: SocketEventName.PLAYER_ACTION,
        payload: {
          type: PlayerActionType.USE_ABILITY,
          playerId: context.localPlayerId,
          payload,
        },
      };
    }),
    emitSkipAbility: emit(({ context }) => ({
      type: 'EMIT_TO_SOCKET' as const,
      eventName: SocketEventName.PLAYER_ACTION,
      payload: {
        type: PlayerActionType.USE_ABILITY,
        playerId: context.localPlayerId,
        payload: { action: 'skip' } satisfies SkipAbilityPayload,
      }
    })),
    // #endregion

    // #region ----- UI Actions -----
    showErrorToast: ({ event }) => {
        assertEvent(event, 'ERROR_RECEIVED');
        toast.error(event.error);
    },
    toggleSidePanel: assign({
        isSidePanelOpen: ({ context }) => !context.isSidePanelOpen,
    }),
    addPeekedCardToContext: assign({
        abilityContext: ({ context, event }) => {
          assertEvent(event, 'ABILITY_PEEK_RESULT');
          if (!context.abilityContext) return null;
          const newPeekedCards = [...(context.abilityContext.peekedCards || []), {
            playerId: event.playerId,
            cardIndex: event.cardIndex,
            card: event.card,
          }];
          return { ...context.abilityContext, peekedCards: newPeekedCards };
        },
    }),
    setInitialPeekCards: assign({
      initialPeekCards: ({ event }) => {
        assertEvent(event, 'INITIAL_PEEK_INFO');
        return event.hand;
      },
    }),
    clearTemporaryCardStates: assign({
      peekedCard: null,
      initialPeekCards: null,
    }),
    // #endregion

    // #region ----- ABILITY CONTEXT -----
    syncAbilityContext: assign({
      abilityContext: ({ context }) => {
        const serverAbility = context.currentGameState?.activeAbility;
        const clientAbility = context.abilityContext;

        // If server has no ability, or it's not for the local player, clear the context.
        if (!serverAbility || serverAbility.playerId !== context.localPlayerId) {
          return null;
        }

        // If the server ability is different from client, or client has none, re-initialize.
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

        // If the stage has changed, update it and reset selections for the new stage.
        if (clientAbility.stage !== serverAbility.stage) {
          return {
            ...clientAbility,
            stage: serverAbility.stage,
            selectedPeekTargets: [],
            selectedSwapTargets: [],
            // Do not clear peekedCards, they are needed for the swap stage.
          };
        }

        // Otherwise, keep the client context as is to preserve selections.
        return clientAbility;
      },
    }),
    updateAbilityContext: assign({
      abilityContext: ({ context, event }) => {
        assertEvent(event, 'PLAYER_SLOT_CLICKED_FOR_ABILITY');
        const { abilityContext } = context;
        if (!abilityContext) return null;

        const { playerId, cardIndex } = event;
        const newTarget = { playerId, cardIndex: cardIndex! };

        if (abilityContext.stage === 'peeking') {
          const currentTargets = abilityContext.selectedPeekTargets;
          // Avoid adding duplicates
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
      abilityContext: null,
    }),
    // #endregion

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
  },
}).createMachine({
  id: 'ui',
  context: ({ input }) => ({
    localPlayerId: input.localPlayerId ?? null,
    gameId: input.gameId ?? null,
    currentGameState: input.initialGameState ?? null,
    abilityContext: null,
    peekedCard: null,
    initialPeekCards: null,
    chatMessages: input.initialGameState?.chat ?? [],
    gameLog: input.initialGameState?.log ?? [],
    isSidePanelOpen: false,
    error: null,
  }),
  initial: 'initializing',
  on: {
    RECONNECT: '#ui.inGame.rejoining',
    ERROR_RECEIVED: { actions: 'showErrorToast' },
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
        DISCONNECT: '.disconnected',
        LEAVE_GAME: { target: '.leaving' },
        TOGGLE_SIDE_PANEL: { actions: 'toggleSidePanel' },
        CLIENT_GAME_STATE_UPDATED: {
          actions: ['setCurrentGameState', 'syncAbilityContext'],
        },
        INITIAL_PEEK_INFO: { actions: 'setInitialPeekCards' },
        ABILITY_PEEK_RESULT: { actions: 'addPeekedCardToContext' },
        NEW_GAME_LOG: { actions: 'addGameLog' },
        INITIAL_LOGS_RECEIVED: { actions: 'setInitialLogs' },
        SUBMIT_CHAT_MESSAGE: { actions: ['addChatMessage', 'emitSendMessage'] },
        DECLARE_READY_FOR_PEEK_CLICKED: { actions: 'emitDeclareReadyForPeek' },
      },
      states: {
        lobby: {
          on: {
            START_GAME: { actions: 'emitStartGame' },
            PLAYER_READY: { actions: 'emitPlayerReady' },
            CLIENT_GAME_STATE_UPDATED: [ // Re-check transition after any update
              {
                target: 'playing',
                guard: ({ event }) => event.gameState.gameStage !== GameStage.WAITING_FOR_PLAYERS,
                actions: ['setCurrentGameState', 'clearTemporaryCardStates'],
              },
              {
                actions: 'setCurrentGameState', // otherwise, just update the state
              },
            ],
          },
        },
        playing: {
            initial: 'idle',
            on: {
                PLAY_CARD: { actions: 'emitPlayCard' },
                DRAW_CARD: { actions: 'emitDrawCard' },
                PLAYER_ACTION: { actions: 'emitPlayerAction' },
            },
            states: {
                idle: {
                    always: {
                        target: 'ability',
                        guard: ({ context }) => !!context.abilityContext,
                    },
                },
                ability: {
                    always: {
                        target: 'idle',
                        guard: ({ context }) => !context.abilityContext,
                    },
                    on: {
                        PLAYER_SLOT_CLICKED_FOR_ABILITY: { actions: 'updateAbilityContext' },
                        CONFIRM_ABILITY_ACTION: {
                            actions: ['emitUseAbility'],
                            guard: 'isAbilityActionComplete',
                        },
                        SKIP_ABILITY_STAGE: {
                            actions: ['emitSkipAbility'],
                        },
                        CANCEL_ABILITY: {
                            target: 'idle',
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
          on: { CONNECT: 'rejoining' },
        },
        rejoining: {
          tags: ['loading'],
          entry: 'emitRejoinGame',
          on: {
            CLIENT_GAME_STATE_UPDATED: {
              target: 'playing', // Go back to playing state on successful rejoin
              actions: ['setCurrentGameState', 'syncAbilityContext'],
            },
          },
        },
      },
    },
  },
});

export type UIMachineActorRef = ActorRefFrom<typeof uiMachine>;
export type UIMachineState = SnapshotFrom<typeof uiMachine>;