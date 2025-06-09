import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createActor, ActorRefFrom } from 'xstate';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';

// Load environment variables from .env file
dotenv.config();

import { gameMachine } from './game-machine.js';
import {
    generatePlayerView
} from './state-redactor.js';
import {
    InitialPlayerSetupData,
    CheckGameState as ServerCheckGameState,
    ClientCheckGameState,
    RichGameLogMessage,
    ChatMessage,
    AbilityArgs as BaseAbilityArgs,
    SocketEventName,
    PlayerActionType,
    GameMachineContext,
    GameMachineEvent,
    GameMachineInput,
    GameMachineEmittedEvents,
    RequestCardDetailsPayload,
    RespondCardDetailsPayload
} from 'shared-types';

console.log('Server starting with Socket.IO...');

// For XState machine instances
type GameMachineActorRef = ActorRefFrom<typeof gameMachine>;
const activeGameMachines = new Map<string, GameMachineActorRef>();

// Helper to get a socket instance from a player ID
const getSocketForPlayer = (playerId: string): Socket | undefined => {
    const sessionEntry = Object.entries(socketSessionMap).find(
        ([, sessionData]) => sessionData.playerId === playerId
    );

    if (sessionEntry) {
        const [socketId] = sessionEntry;
        return io.sockets.sockets.get(socketId);
    }
    
    return undefined;
};

// Helper function for logging - DEFINED AT TOP LEVEL
const getPlayerNameForLog = (playerId: string, context: GameMachineContext): string => {
    return context.players[playerId]?.name || 'P-' + playerId.slice(-4);
};

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
console.log(`[Server] CORS origin set to: ${CORS_ORIGIN}`);

const httpServer = http.createServer();
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"]
  }
});

const GAME_ID_REGEX = /^[a-zA-Z0-9_-]{6}$/;
const NUM_RECENT_LOGS_ON_JOIN_REJOIN = 20;

const escapeHTML = (str: string) =>
  str.replace(/[&<>'"]/g, (match) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[match] || match));

interface BasicResponse {
  success: boolean;
  message?: string;
}

interface CreateGameResponse extends BasicResponse {
  gameId?: string;
  playerId?: string;
  gameState?: ClientCheckGameState;
}

interface JoinGameResponse extends BasicResponse {
  gameId?: string;
  playerId?: string;
  gameState?: ClientCheckGameState;
}

interface AttemptRejoinResponse extends BasicResponse {
  gameState?: ClientCheckGameState;
}

interface PlayerActionResponse extends BasicResponse {
  gameState?: ClientCheckGameState;
  peekJustStarted?: boolean;
  peekTargets?: Array<{ playerID: string; cardIndex: number }>;
}

interface ExtendedAbilityArgs extends BaseAbilityArgs {
  skipAbility?: boolean;
  skipType?: 'peek' | 'swap' | 'full';
}

interface ValidTarget {
  playerID: string;
  cardIndex: number;
}

const isValidTargetArray = (targets: any): targets is ValidTarget[] => {
  return Array.isArray(targets) && targets.every(
    target => typeof target === 'object' && target !== null &&
              typeof target.playerID === 'string' &&
              typeof target.cardIndex === 'number'
  );
};

const isExtendedAbilityArgs = (args: any): args is ExtendedAbilityArgs => {
  if (typeof args !== 'object' || args === null) return false;
  if ('skipAbility' in args && typeof args.skipAbility !== 'boolean') return false;
  if ('skipType' in args && (typeof args.skipType !== 'string' || !['peek', 'swap', 'full'].includes(args.skipType))) return false;
  if ('peekTargets' in args && args.peekTargets !== undefined && !isValidTargetArray(args.peekTargets)) return false;
  if ('swapTargets' in args && args.swapTargets !== undefined && !isValidTargetArray(args.swapTargets)) return false;
  return true;
};

const socketSessionMap = new Map<string, { gameId: string; playerId: string }>();

io.on('connection', (socket: Socket) => {
  console.log(`[Server] New connection: ${socket.id}`);

  const registerSocketSession = (gameId: string, playerId: string) => {
    socketSessionMap.set(socket.id, { gameId, playerId });
    (socket as any).data = { gameId, playerId };
    console.log(`[Server] Session registered for socket ${socket.id}: game ${gameId}, player ${playerId}`);
  };

  const getSocketSession = () => {
    return socketSessionMap.get(socket.id);
  };

  const clearSocketSession = () => {
    const session = socketSessionMap.get(socket.id);
    if (session) {
      console.log(`[Server] Clearing session for socket ${socket.id}: game ${session.gameId}, player ${session.playerId}`);
      socketSessionMap.delete(socket.id);
      delete (socket as any).data.gameId;
      delete (socket as any).data.playerId;
    }
  };

  const broadcastGameStateCustom = (gameId: string, fullGameState: GameMachineContext | null, specificSocketIdToExclude?: string) => {
    if (!fullGameState) {
        console.warn(`[Server-BroadcastFn] No game state to broadcast for game ${gameId}`);
        return;
    }
    const socketsInRoom = io.sockets.adapter.rooms.get(gameId);
    if (!socketsInRoom) {
        console.warn(`[Server-BroadcastFn] No sockets found in room ${gameId} to broadcast to.`);
        return;
    }

    let sentToCount = 0;
    socketsInRoom.forEach(socketIdInRoom => {
        if (specificSocketIdToExclude && socketIdInRoom === specificSocketIdToExclude) {
            return; 
        }
        const targetSocket = io.sockets.sockets.get(socketIdInRoom);
        const gamePlayerIdForSocket = (targetSocket as any)?.data?.playerId || 
                                      Object.keys(fullGameState.players).find(pId => fullGameState.players[pId].socketId === socketIdInRoom);

        if (gamePlayerIdForSocket) {
            const playerSpecificView = generatePlayerView(fullGameState, gamePlayerIdForSocket);
            io.to(socketIdInRoom).emit(SocketEventName.GAME_STATE_UPDATE, { gameId, gameState: playerSpecificView });
            sentToCount++;
        } else {
            console.warn(`[Server-BroadcastFn] Could not find player for socketId ${socketIdInRoom} in game ${gameId}`);
        }
    });
    if (sentToCount > 0) {
      console.log(`[Server-BroadcastFn] Game state update broadcasted for game ${gameId} to ${sentToCount} players (excluding: ${specificSocketIdToExclude ? 'yes' : 'no'}).`);
    }
  };

  const broadcastLogEntryCustom = (gameId: string, logEntry: RichGameLogMessage) => {
    const machine = activeGameMachines.get(gameId);
    if (!machine) {
      console.warn(`[Server-LogBroadcast] Game machine for ${gameId} not found for broadcasting log.`);
      return;
    } else {
      io.to(gameId).emit(SocketEventName.SERVER_LOG_ENTRY, { gameId, logEntry });
    }
  };
  
  socket.on(SocketEventName.SEND_CHAT_MESSAGE, (chatMessage: ChatMessage, callback: (ack: {success: boolean, messageId?: string, error?: string}) => void) => {
    try {
      const session = getSocketSession();
      if (!session || !session.gameId) {
        if (callback) callback({success: false, error: 'User not in a game session.'});
        return;
      }
      if (chatMessage.senderId !== session.playerId) {
        if (callback) callback({success: false, error: 'Sender ID mismatch.'});
        return;
      }
      if (!chatMessage.message || typeof chatMessage.message !== 'string' || chatMessage.message.trim().length === 0) {
        if (callback) callback({success: false, error: 'Message is empty.'});
        return;
      }
      if (chatMessage.message.length > 256) { 
        if (callback) callback({success: false, error: 'Message exceeds maximum length.'});
        return;
      }

      const processedMessage: ChatMessage = {
        ...chatMessage,
        message: escapeHTML(chatMessage.message.trim()),
        timestamp: new Date().toISOString(), 
        id: chatMessage.id || `servermsg_${Date.now()}_${Math.random().toString(36).substring(2,7)}` 
      };
  
      io.to(session.gameId).emit(SocketEventName.CHAT_MESSAGE, processedMessage);
      if (callback) callback({ success: true, messageId: processedMessage.id });
    } catch (e: any) {
      console.error(`[Server-Chat] Error: ${e.message}`, e);
      if (callback) callback({success: false, error: `Server error: ${e.message || 'Unknown error'}`});
    }
  });
  
  socket.on(SocketEventName.CREATE_GAME, (playerSetupData: InitialPlayerSetupData, callback: (response: CreateGameResponse) => void) => {
    try {
      // Use nanoid to generate a unique, URL-friendly game ID
      const gameId = nanoid(6);
      console.log(`[Server] Game ID ${gameId} generated for new game.`);

      // 1. Create the game machine actor
      const gameActor = createActor(gameMachine, {
        input: {
          gameId: gameId,
          // Pass any other initial context if needed
        },
      });

      let createGameCallbackCalled = false;

      // 2. Subscribe to actor changes to broadcast updates
      const snapshotSubscription = gameActor.subscribe({
        next: (snapshot) => {
          if (!snapshot) return;

          // Handle emitted events from the machine
          for (const emitted of (snapshot as any).emitted || []) {
            switch (emitted.type) {
              case 'BROADCAST_GAME_STATE':
                // The machine's context is the source of truth.
                broadcastGameStateCustom(gameId, snapshot.context);
                break;
              
              case 'EMIT_LOG_PUBLIC':
                io.to(emitted.gameId).emit(SocketEventName.SERVER_LOG_ENTRY, emitted.publicLogData);
                break;
                
              case 'EMIT_LOG_PRIVATE':
                const playerSocketPrivate = getSocketForPlayer(emitted.playerId);
                if (playerSocketPrivate) {
                  playerSocketPrivate.emit(SocketEventName.SERVER_LOG_ENTRY, emitted.privateLogData);
                }
                break;

              case 'SEND_EVENT_TO_PLAYER':
                const playerSocketEvent = getSocketForPlayer(emitted.payload.playerId);
                if (playerSocketEvent) {
                  playerSocketEvent.emit(emitted.payload.eventName, emitted.payload.eventData);
                }
                break;
                
              default:
                // For any other specific emitted events if necessary
                break;
            }
          }

          // On the very first state emission, send the initial state back to the creator
          if (callback && !createGameCallbackCalled) {
            const clientGameState = generatePlayerView(snapshot.context, playerSetupData.id);
            callback({ success: true, gameId, playerId: playerSetupData.id, gameState: clientGameState });
            createGameCallbackCalled = true;
            console.log(`[Server] Game ${gameId} created for ${playerSetupData.id}. Initial state sent via CREATE_GAME callback.`);
          }
          
          // No longer need manual broadcast here, handled by BROADCAST_GAME_STATE emission.
        },
        error: (error: unknown) => {
          console.error(`[Server] Game machine actor for ${gameId} reported an error:`, error);
          if (callback && !createGameCallbackCalled) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown machine error';
            callback({ success: false, message: `Machine error on game creation: ${errorMessage}` });
            createGameCallbackCalled = true;
          }
        },
        complete: () => {
          console.log(`[Server] Game machine actor for ${gameId} has completed. Cleaning up.`);
          activeGameMachines.delete(gameId);
          snapshotSubscription.unsubscribe();
        }
      });

      // 3. Start the actor and store it
      gameActor.start();
      activeGameMachines.set(gameId, gameActor);
      console.log(`[Server] Game actor created and started for game ${gameId}.`);

      // 4. Join the socket to the game room and register the session
      socket.join(gameId);
      registerSocketSession(gameId, playerSetupData.id);

      // 5. Send the initial event to the machine to add the creator as a player
      const joinEvent: GameMachineEvent = {
        type: 'PLAYER_JOIN_REQUEST',
        playerSetupData: { ...playerSetupData, socketId: socket.id }
      };
      gameActor.send(joinEvent);

    } catch (e: any) {
      console.error(`[Server] Error in CREATE_GAME:`, e);
      if (callback) {
        callback({ success: false, message: e.message || 'An unexpected error occurred.' });
      }
    }
  });
  
  socket.on(SocketEventName.JOIN_GAME, (gameIdToJoin: string, playerSetupData: InitialPlayerSetupData, callback: (response: JoinGameResponse) => void) => {
    try {
      if (!GAME_ID_REGEX.test(gameIdToJoin)) {
        if (callback) callback({ success: false, message: "Invalid Game ID format." });
        return;
      }
      playerSetupData.socketId = socket.id;
      console.log(`[Server] JoinGame: ${playerSetupData.name || playerSetupData.id} (Socket: ${socket.id}) to game ${gameIdToJoin}`);

      const gameActor = activeGameMachines.get(gameIdToJoin);

      if (!gameActor) {
        if (callback) callback({ success: false, message: `Game ${gameIdToJoin} not found or no longer active.` });
        return;
      }

      const currentSnapshot = gameActor.getSnapshot();
      if (currentSnapshot.context.players[playerSetupData.id]) {
        console.warn(`[Server-JoinGame] Player ${playerSetupData.id} attempting to join game ${gameIdToJoin} but already present in machine context.`);
        socket.join(gameIdToJoin);
        registerSocketSession(gameIdToJoin, playerSetupData.id);
        const clientGameState = generatePlayerView(currentSnapshot.context, playerSetupData.id);
        if (callback) callback({ success: true, gameId: gameIdToJoin, playerId: playerSetupData.id, gameState: clientGameState });
        if (currentSnapshot.context.logHistory && currentSnapshot.context.logHistory.length > 0) {
            socket.emit(SocketEventName.INITIAL_LOGS, { logs: currentSnapshot.context.logHistory.slice(-NUM_RECENT_LOGS_ON_JOIN_REJOIN) });
        }
        return;
      }

      const joinEvent: GameMachineEvent = {
        type: 'PLAYER_JOIN_REQUEST',
        playerSetupData
      };
      gameActor.send(joinEvent);

      socket.join(gameIdToJoin);
      registerSocketSession(gameIdToJoin, playerSetupData.id);

      if (callback) callback({ success: true, gameId: gameIdToJoin, playerId: playerSetupData.id });
      console.log(`[Server] Player ${playerSetupData.id} join request for ${gameIdToJoin} sent to machine.`);

      // ADDED: Send recent logs for a fresh successful join
      const freshJoinSnapshot = gameActor.getSnapshot();
      if (freshJoinSnapshot.context.logHistory && freshJoinSnapshot.context.logHistory.length > 0) {
        socket.emit(SocketEventName.INITIAL_LOGS, { logs: freshJoinSnapshot.context.logHistory.slice(-NUM_RECENT_LOGS_ON_JOIN_REJOIN) });
        console.log(`[Server-JoinGame] Sent initial logs to newly joined player ${playerSetupData.id} in game ${gameIdToJoin}.`);
      }

    } catch (e: any) {
      console.error(`[Server-JoinGame] Error: ${e.message}`, e);
      if (callback) callback({ success: false, message: `Server error: ${e.message || 'Unknown error'}` });
    }
  });
  
  socket.on(SocketEventName.ATTEMPT_REJOIN, async (data: { gameId: string; playerId: string }, callback: (response: AttemptRejoinResponse) => void) => {
    try {
      if (!GAME_ID_REGEX.test(data.gameId)) {
        if (callback) callback({ success: false, message: "Invalid Game ID format." });
        return;
      }
      console.log(`[Server] AttemptRejoin: ${data.playerId} to game ${data.gameId} (New Socket: ${socket.id})`);

      const gameActor = activeGameMachines.get(data.gameId);
      if (!gameActor) {
        if (callback) callback({ success: false, message: `Game ${data.gameId} not found or inactive for rejoin.` });
        return;
      }

      const currentSnapshot = gameActor.getSnapshot();
      const playerInMachine = currentSnapshot.context.players[data.playerId];

      if (!playerInMachine) {
        if (callback) callback({ success: false, message: `Player ${data.playerId} not found in game ${data.gameId}.` });
        return;
      }

      if (playerInMachine.isConnected && playerInMachine.socketId === socket.id) {
        console.warn(`[Server-Rejoin] Player ${data.playerId} already connected with this socket ${socket.id}.`);
      } else {
        gameActor.send({
          type: 'PLAYER_RECONNECTED',
          playerId: data.playerId,
          newSocketId: socket.id
        });
      }

      const postRejoinSnapshot = gameActor.getSnapshot();
      const clientGameState = generatePlayerView(postRejoinSnapshot.context, data.playerId);

      socket.join(data.gameId);
      registerSocketSession(data.gameId, data.playerId);

      if (postRejoinSnapshot.context.logHistory && postRejoinSnapshot.context.logHistory.length > 0) {
        socket.emit(SocketEventName.INITIAL_LOGS, { logs: postRejoinSnapshot.context.logHistory.slice(-NUM_RECENT_LOGS_ON_JOIN_REJOIN) });
      }

      if (callback) callback({ success: true, gameState: clientGameState });
      console.log(`[Server] Player ${data.playerId} reconnected to ${data.gameId}. State and logs sent.`);

    } catch (e: any) {
      console.error(`[Server-Rejoin] Error: ${e.message}`, e);
      if (callback) callback({ success: false, message: `Server error: ${e.message || 'Unknown error'}` });
    }
  });
  
  socket.on(SocketEventName.PLAYER_ACTION, async (action: { gameId: string; playerId: string; type: string; payload?: any }, callback: (response: PlayerActionResponse) => void) => {
    try {
      const { gameId, playerId, type, payload } = action;
      console.log(`[Server] PlayerAction: ${type} from ${playerId} (${socket.id}) in ${gameId}. Payload:`, payload);

      const session = getSocketSession();
      if (!session || session.gameId !== gameId || session.playerId !== playerId) {
          if (callback) callback({ success: false, message: "Session validation failed. Action rejected." });
          return; 
      }

      const gameActor = activeGameMachines.get(gameId);
      if (!gameActor) {
        if (callback) callback({ success: false, message: `Game ${gameId} not found or inactive.` });
        return;
      }

      let machineEvent: GameMachineEvent | null = null;
      let actionProcessedByMachine = true; // Assume true, set to false if we fall back to old handlers

      switch (type as PlayerActionType) {
        case PlayerActionType.DRAW_FROM_DECK: 
          machineEvent = { type: PlayerActionType.DRAW_FROM_DECK, playerId };
          break;
        case PlayerActionType.DRAW_FROM_DISCARD: 
          machineEvent = { type: PlayerActionType.DRAW_FROM_DISCARD, playerId };
          break;
        case PlayerActionType.SWAP_AND_DISCARD: 
          if (typeof payload?.handIndex === 'number') {
            machineEvent = { type: PlayerActionType.SWAP_AND_DISCARD, playerId, handIndex: payload.handIndex };
          } else {
            if (callback) callback({ success: false, message: "Invalid payload: handIndex must be a number." });
            return;
          }
          break;
        case PlayerActionType.DISCARD_DRAWN_CARD: 
          machineEvent = { type: PlayerActionType.DISCARD_DRAWN_CARD, playerId };
          break;
        case PlayerActionType.ATTEMPT_MATCH: 
          if (typeof payload?.handIndex === 'number') {
            machineEvent = { type: PlayerActionType.ATTEMPT_MATCH, playerId, handIndex: payload.handIndex };
          } else {
            if (callback) callback({ success: false, message: "Invalid payload: handIndex must be a number for attemptMatch." });
            return;
          }
          break;
        case PlayerActionType.PASS_ON_MATCH_ATTEMPT: 
          machineEvent = { type: PlayerActionType.PASS_ON_MATCH_ATTEMPT, playerId };
          break;
        case PlayerActionType.CALL_CHECK: 
          machineEvent = { type: PlayerActionType.CALL_CHECK, playerId };
          break;
        case PlayerActionType.DECLARE_READY_FOR_PEEK: 
          machineEvent = { type: PlayerActionType.DECLARE_READY_FOR_PEEK, playerId };
          break;
        case PlayerActionType.REQUEST_PEEK_REVEAL:
          if (payload && payload.peekTargets && isValidTargetArray(payload.peekTargets)) {
            machineEvent = { type: PlayerActionType.REQUEST_PEEK_REVEAL, playerId, peekTargets: payload.peekTargets };
          } else {
            if (callback) callback({ success: false, message: 'Invalid or missing peekTargets for requestPeekReveal.' });
            return;
          }
          break;
        case PlayerActionType.RESOLVE_SPECIAL_ABILITY: 
          if (payload && payload.hasOwnProperty('args') && isExtendedAbilityArgs(payload.args)) {
            machineEvent = { type: PlayerActionType.RESOLVE_SPECIAL_ABILITY, playerId, abilityResolutionArgs: payload.args };
          } else {
            if (callback) callback({ success: false, message: "Invalid payload: args missing or malformed for resolveSpecialAbility." });
            return;
          }
          break;
        default:
          actionProcessedByMachine = false; // Mark that this action isn't (yet) handled by the machine path
          console.error(`[Server] Unknown action type received for machine: '${type}'. Player: ${playerId}, Game: ${gameId}`);
          // Fall through to old handler logic for now if desired, or send error
          if (callback) callback({ success: false, message: `Unknown action type: '${type}'` });
          return;
      }

      if (machineEvent) {
        gameActor.send(machineEvent);
        // The machine will emit events that trigger broadcasts or specific messages.
        // The callback here should be a simple ack, as game state updates are now reactive.
        if (callback) callback({ success: true, message: `Action ${type} received and sent to game logic.` });
        console.log(`[Server] Action ${type} by ${playerId} sent to machine.`);
      } else if (!actionProcessedByMachine) {
        // This case should ideally not be reached if all actions are mapped
        console.error(`[Server] Machine event was null for action ${type}, though not marked as unprocessed.`);
        if (callback) callback({ success: false, message: 'Internal server error processing action.' });
      }
    } catch (e: any) {
      console.error(`[Server-PlayerAction] Error: ${e.message}`, e);
      if (typeof callback === 'function') {
          callback({ success: false, message: `Server error: ${e.message || 'Unknown error'}` });
      } else {
          console.error(`[Server-PlayerAction] Callback was not a function for error handling. Socket: ${socket.id}, Action Type: ${action.type}`);
      }
    }
  });

  socket.on(SocketEventName.REQUEST_CARD_DETAILS_FOR_ABILITY, async (payload: RequestCardDetailsPayload, callback?: (response: BasicResponse & { cardDetails?: RespondCardDetailsPayload }) => void) => {
    try {
      const session = getSocketSession();
      if (!session || !session.gameId || session.gameId !== payload.gameId) {
        console.warn(`[Server-${SocketEventName.REQUEST_CARD_DETAILS_FOR_ABILITY}] Invalid session for socket ${socket.id} or gameId mismatch. Session: ${JSON.stringify(session)}, Payload: ${JSON.stringify(payload)}`);
        if (callback) callback({ success: false, message: 'Invalid session or game ID mismatch.' });
        return;
      }

      const gameActor = activeGameMachines.get(payload.gameId);
      if (!gameActor) {
        console.warn(`[Server-${SocketEventName.REQUEST_CARD_DETAILS_FOR_ABILITY}] Game not found for id: ${payload.gameId}`);
        if (callback) callback({ success: false, message: 'Game not found.' });
        return;
      }

      const currentFullState = gameActor.getSnapshot().context as GameMachineContext;
      
      const targetPlayerState = currentFullState.players[payload.targetPlayerId];
      if (!targetPlayerState || payload.cardIndex < 0 || payload.cardIndex >= targetPlayerState.hand.length) {
        console.warn(`[Server-${SocketEventName.REQUEST_CARD_DETAILS_FOR_ABILITY}] Target player ${payload.targetPlayerId} or card index ${payload.cardIndex} invalid in game ${payload.gameId}.`);
        if (callback) callback({ success: false, message: 'Target player or card index invalid.' });
        return;
      }

      const cardToReveal = targetPlayerState.hand[payload.cardIndex];

      // Further validation could be added here to check if the requesting player (session.playerId)
      // is legitimately in an ability state that allows peeking/interacting with this card.
      // For now, trust client state is reflecting server-allowed pending abilities.

      const responsePayload: RespondCardDetailsPayload = {
        card: cardToReveal,
        playerId: payload.targetPlayerId,
        cardIndex: payload.cardIndex
      };

      socket.emit(SocketEventName.RESPOND_CARD_DETAILS_FOR_ABILITY, responsePayload);
      console.log(`[Server-${SocketEventName.REQUEST_CARD_DETAILS_FOR_ABILITY}] Responded to ${session.playerId} in game ${payload.gameId} with card details for P:${payload.targetPlayerId}[${payload.cardIndex}].`);
      if (callback) callback({ success: true, cardDetails: responsePayload });

    } catch (error: any) {
      console.error(`[Server] Error handling ${SocketEventName.REQUEST_CARD_DETAILS_FOR_ABILITY} for game ${payload?.gameId}:`, error);
      if (callback) callback({ success: false, message: error.message || 'Internal server error while requesting card details.' });
    }
  });

  socket.on('disconnect', (reason: string) => {
    try {
      const session = getSocketSession();
      console.log(`[Server] Socket ${socket.id} disconnected. Reason: ${reason}`);
      if (session && session.gameId && session.playerId) {
        console.log(`[Server] Player ${session.playerId} in game ${session.gameId} disconnected event processing.`);
        
        const gameActor = activeGameMachines.get(session.gameId);
        if (gameActor) {
          console.log(`[Server] Sending PLAYER_DISCONNECTED event to machine for ${session.playerId} in ${session.gameId}`);
          gameActor.send({ 
            type: 'PLAYER_DISCONNECTED', 
            playerId: session.playerId 
          });
        } else {
          console.warn(`[Server-Disconnect] Game machine for ${session.gameId} not found. Cannot send PLAYER_DISCONNECTED event.`);
        }
      } else {
        console.log(`[Server-Disconnect] No active game session found for socket ${socket.id}.`);
      }
      clearSocketSession();
    } catch (e: any) {
      console.error(`[Server-Disconnect] Error: ${e.message}`, e);
    }
  });
});

const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});