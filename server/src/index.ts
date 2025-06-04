import 'module-alias/register';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createActor, ActorRefFrom } from 'xstate';
import { gameMachine } from './game-machine';
import {
    generatePlayerView,
} from './game-manager';
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
    GameMachineEmittedEvents
} from '../../shared-types/src/index';

console.log('Server starting with Socket.IO...');

// For XState machine instances - MOVED TO TOP LEVEL
type GameMachineActorRef = ActorRefFrom<typeof gameMachine>;
const activeGameMachines = new Map<string, GameMachineActorRef>();

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

const GAME_ID_REGEX = /^game_[a-zA-Z0-9]{6}$/;
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
      const gameId = `game_${Math.random().toString(36).substring(2, 8)}`;
      playerSetupData.socketId = socket.id; 

      console.log(`[Server] CreateGame: ${playerSetupData.name || playerSetupData.id} (Socket: ${socket.id}) for game ${gameId}`);
      
      const gameActorInput: GameMachineInput = { gameId };
      const gameActor = createActor(gameMachine, {
        input: gameActorInput,
      }).start();

      activeGameMachines.set(gameId, gameActor);

      let createGameCallbackCalled = false;

      const snapshotSubscription = gameActor.subscribe({
        next: (snapshot) => {
          if (!snapshot || createGameCallbackCalled) return;

          if (snapshot.context && snapshot.context.players && snapshot.context.players[playerSetupData.id]) {
            const clientGameState = generatePlayerView(snapshot.context as any, playerSetupData.id);
            
            if (callback && !createGameCallbackCalled) {
              callback({ success: true, gameId, playerId: playerSetupData.id, gameState: clientGameState });
              createGameCallbackCalled = true;
              console.log(`[Server] Game ${gameId} created for ${playerSetupData.id}. Initial state sent via CREATE_GAME callback.`);
              
              if (snapshot.context.logHistory && snapshot.context.logHistory.length > 0) {
                socket.emit(SocketEventName.INITIAL_LOGS, { logs: snapshot.context.logHistory.slice(-NUM_RECENT_LOGS_ON_JOIN_REJOIN) });
              }
              
              snapshotSubscription.unsubscribe();
            }
          }
        },
        error: (error: unknown) => {
          console.error(`[Server] Game machine actor for ${gameId} reported an error in snapshot subscription:`, error);
          if (callback && !createGameCallbackCalled) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown machine error';
            callback({ success: false, message: `Machine error: ${errorMessage}` });
            createGameCallbackCalled = true;
          }
        },
        complete: () => {
          console.log(`[Server] Game machine actor for ${gameId} has completed (snapshot subscription).`);
        }
      });

      const system = gameActor.system;
      if (system) {
        (system as any).on('xstate.emitted', (emittedPayload: any) => {
          if (emittedPayload.id === gameActor.id) {
            const actualEmittedEvent = emittedPayload.event as GameMachineEmittedEvents;
            const currentSnapshot = gameActor.getSnapshot();

            if (actualEmittedEvent.type === 'BROADCAST_GAME_STATE') {
              broadcastGameStateCustom(actualEmittedEvent.gameId || currentSnapshot.context.gameId, currentSnapshot.context);
            } else if (actualEmittedEvent.type === 'EMIT_LOG_PUBLIC' && actualEmittedEvent.publicLogData) {
              const logGameId = actualEmittedEvent.gameId || currentSnapshot.context.gameId;
              const richLogEntry: RichGameLogMessage = {
                ...actualEmittedEvent.publicLogData,
                logId: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                timestamp: new Date().toISOString(),
                isPublic: true,
              };
              if (actualEmittedEvent.publicLogData.actorId) {
                richLogEntry.actorName = getPlayerNameForLog(actualEmittedEvent.publicLogData.actorId, currentSnapshot.context);
              }
              broadcastLogEntryCustom(logGameId, richLogEntry);

            } else if (actualEmittedEvent.type === 'EMIT_LOG_PRIVATE' && actualEmittedEvent.privateLogData && actualEmittedEvent.recipientPlayerId) {
              const logGameId = actualEmittedEvent.gameId || currentSnapshot.context.gameId;
              const richLogEntry: RichGameLogMessage = {
                ...actualEmittedEvent.privateLogData,
                logId: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                timestamp: new Date().toISOString(),
                isPublic: false,
                recipientPlayerId: actualEmittedEvent.recipientPlayerId,
              };
              if (actualEmittedEvent.privateLogData.actorId) {
                richLogEntry.actorName = getPlayerNameForLog(actualEmittedEvent.privateLogData.actorId, currentSnapshot.context);
              }
              broadcastLogEntryCustom(logGameId, richLogEntry);
            
            } else if (actualEmittedEvent.type === 'EMIT_ERROR_TO_CLIENT') {
                const targetPlayer = currentSnapshot.context.players[actualEmittedEvent.playerId || ''];
                if (targetPlayer && targetPlayer.socketId) {
                    io.to(targetPlayer.socketId).emit('serverError', {
                        message: actualEmittedEvent.message,
                        details: actualEmittedEvent.errorDetails
                    });
                } else if (!actualEmittedEvent.playerId) {
                     console.error(`[Server] Machine emitted global error for game ${actualEmittedEvent.gameId}: ${actualEmittedEvent.message}`, actualEmittedEvent.errorDetails);
                }
            }
            else if (actualEmittedEvent.type === 'BROADCAST_PLAYER_SPECIFIC_STATE') {
                const targetPlayerState = currentSnapshot.context.players[actualEmittedEvent.playerId];
                if (targetPlayerState && targetPlayerState.socketId) {
                    const playerSpecificView = generatePlayerView(currentSnapshot.context as any, actualEmittedEvent.playerId);
                    io.to(targetPlayerState.socketId).emit(SocketEventName.GAME_STATE_UPDATE, { gameId: actualEmittedEvent.gameId, gameState: playerSpecificView });
                }
            }
          }
        });
        
        gameActor.subscribe({
            complete: () => {
                console.log(`[Server] Game machine actor for ${gameId} has completed. Cleaning up.`);
                activeGameMachines.delete(gameId);
            }
         });
      }

      socket.join(gameId);
      registerSocketSession(gameId, playerSetupData.id);

      const joinEvent: GameMachineEvent = {
        type: 'PLAYER_JOIN_REQUEST',
        playerSetupData
      };
      gameActor.send(joinEvent);

    } catch (e: any) {
      console.error(`[Server-CreateGame] Error: ${e.message}`, e);
      if (callback) callback({ success: false, message: `Server error: ${e.message || 'Unknown error'}` });
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

      // Ensure the player is not already in the game via the machine's context (idempotency)
      const currentSnapshot = gameActor.getSnapshot();
      if (currentSnapshot.context.players[playerSetupData.id]) {
        // Player is already in the game according to the machine.
        // This could be a rejoin attempt via JOIN_GAME, or a double-join.
        // For now, treat as success and let them get state via normal broadcast.
        // Or, if rejoining, they should use ATTEMPT_REJOIN.
        console.warn(`[Server-JoinGame] Player ${playerSetupData.id} attempting to join game ${gameIdToJoin} but already present in machine context.`);
        socket.join(gameIdToJoin); // Ensure they are in the socket room
        registerSocketSession(gameIdToJoin, playerSetupData.id);
        // Optionally, send current state if desired, or let next broadcast handle it.
        // For now, just ack and let regular broadcasts handle state.
        const clientGameState = generatePlayerView(currentSnapshot.context, playerSetupData.id);
        if (callback) callback({ success: true, gameId: gameIdToJoin, playerId: playerSetupData.id, gameState: clientGameState }); 
        // Send recent logs
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

      // Simplified callback: Acknowledges the join request.
      // The player will receive game state and logs via emitted events from the machine
      // (BROADCAST_GAME_STATE and EMIT_LOG_PUBLIC/PRIVATE caught by the system listener).
      // If an EMIT_INITIAL_CLIENT_STATE specific to this joiner is implemented in the machine,
      // the system listener would handle sending them their state.
      // For now, we send a simple success, and they will get logs + state via general broadcasts.

      if (callback) callback({ success: true, gameId: gameIdToJoin, playerId: playerSetupData.id });
      console.log(`[Server] Player ${playerSetupData.id} join request for ${gameIdToJoin} sent to machine.`);

      // Old logic (to be removed once JOIN_GAME is fully tested with machine flows)
      /*
      const joinResult = addPlayerToGame(gameIdToJoin, playerSetupData, socket.id);

      if (joinResult.success && joinResult.gameRoom && joinResult.gameRoom.gameState && playerSetupData.id) {
        socket.join(gameIdToJoin);
        registerSocketSession(gameIdToJoin, playerSetupData.id);
        const clientGameState = generatePlayerView(joinResult.gameRoom.gameState, playerSetupData.id);

        const gameLogs = getGameRoom(gameIdToJoin)?.gameState.logHistory;
        if (gameLogs && gameLogs.length > 0) {
          socket.emit(SocketEventName.INITIAL_LOGS, { logs: gameLogs.slice(-20) });
        }

        callback({ success: true, gameId: gameIdToJoin, playerId: playerSetupData.id, gameState: clientGameState });
      } else {
        callback({ success: false, message: joinResult.message || 'Failed to join game.' });
      }
      */
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

      // If player is already marked as connected with the current socket, it might be a redundant call
      if (playerInMachine.isConnected && playerInMachine.socketId === socket.id) {
        console.warn(`[Server-Rejoin] Player ${data.playerId} already connected with this socket ${socket.id}.`);
        // Proceed to send state and logs as if it were a fresh rejoin success.
      } else {
        // Send reconnected event to the machine
        gameActor.send({ 
          type: 'PLAYER_RECONNECTED', 
          playerId: data.playerId, 
          newSocketId: socket.id 
        });
      }
      
      // It might take a moment for the machine to process the PLAYER_RECONNECTED event.
      // For an immediate response with the most up-to-date state after rejoining,
      // we could subscribe to a specific emitted event or wait for a snapshot change.
      // For now, we'll get a fresh snapshot. This might not capture the absolute latest if machine processing is slow,
      // but should be sufficient for most cases. Subsequent broadcasts will catch up.
      const postRejoinSnapshot = gameActor.getSnapshot();
      const clientGameState = generatePlayerView(postRejoinSnapshot.context, data.playerId);

      socket.join(data.gameId);
      registerSocketSession(data.gameId, data.playerId);

      if (postRejoinSnapshot.context.logHistory && postRejoinSnapshot.context.logHistory.length > 0) {
        socket.emit(SocketEventName.INITIAL_LOGS, { logs: postRejoinSnapshot.context.logHistory.slice(-NUM_RECENT_LOGS_ON_JOIN_REJOIN) });
      }
      
      if (callback) callback({ success: true, gameState: clientGameState });
      console.log(`[Server] Player ${data.playerId} reconnected to ${data.gameId}. State and logs sent.`);

      // Old logic (to be removed)
      /*
      const result = await attemptRejoinGame(data.gameId, data.playerId, socket.id);

      if (result.success && result.gameState) {
        socket.join(data.gameId);
        registerSocketSession(data.gameId, data.playerId);
        const clientGameState = generatePlayerView(result.gameState, data.playerId);
        
        if (result.initialLogsForRejoiner) {
          socket.emit(SocketEventName.INITIAL_LOGS, { logs: result.initialLogsForRejoiner });
        }
        
        callback({ success: true, gameState: clientGameState });
        console.log(`[Server] Player ${data.playerId} rejoined ${data.gameId}.`);
      } else {
        socket.emit(SocketEventName.REJOIN_DENIED, { message: result.message }); 
        callback({ success: false, message: result.message });
      }
      */
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
        case PlayerActionType.PASS_MATCH: 
          machineEvent = { type: PlayerActionType.PASS_MATCH, playerId };
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
        
        // Old logic (to be removed)
        // markPlayerAsDisconnected(session.gameId, session.playerId);
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