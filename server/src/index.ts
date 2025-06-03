import 'module-alias/register';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import {
    initializeNewGame,
    addPlayerToGame,
    handleDrawFromDeck,
    handleDrawFromDiscard,
    handleSwapAndDiscard,
    handleDiscardDrawnCard,
    handleAttemptMatch,
    handlePassMatch,
    handleCallCheck,
    generatePlayerView,
    handleDeclareReadyForPeek,
    handleResolveSpecialAbility,
    setTriggerBroadcastFunction,
    markPlayerAsDisconnected,
    attemptRejoin as attemptRejoinGame,
    handleRequestPeekReveal,
    setTriggerLogBroadcastFunction,
    getGameRoom,
} from './game-manager';
import {
    InitialPlayerSetupData,
    CheckGameState as ServerCheckGameState,
    ClientCheckGameState,
    RichGameLogMessage,
    ChatMessage,
    AbilityArgs as BaseAbilityArgs,
    SocketEventName,
    PlayerActionType
} from 'shared-types';

console.log('Server starting with Socket.IO...');

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
  str.replace(/[&<>'"]/g, (match) => ({ // Removed / from regex as it's not typically escaped in HTML content unless in specific contexts like script tags.
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
    (socket as any).data = { gameId, playerId }; // Also store on socket.data for easier access in some contexts
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

  const broadcastGameStateCustom = (gameId: string, fullGameState: ServerCheckGameState | null, specificSocketIdToExclude?: string) => {
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
        // Try to get playerId from socket.data first, then from the game state as a fallback
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
  setTriggerBroadcastFunction(broadcastGameStateCustom);

  const broadcastLogEntryCustom = (gameId: string, logEntry: RichGameLogMessage) => {
    const gameRoomForLog = getGameRoom(gameId); 
    if (!gameRoomForLog) {
      console.warn(`[Server-LogBroadcast] Game room ${gameId} not found for broadcasting log.`);
      return;
    }

    if (logEntry.isPublic === false && logEntry.recipientPlayerId) {
      const recipientPlayerState = gameRoomForLog.gameState.players[logEntry.recipientPlayerId];
      if (recipientPlayerState && recipientPlayerState.socketId) {
        io.to(recipientPlayerState.socketId).emit(SocketEventName.SERVER_LOG_ENTRY, { gameId, logEntry });
      } else {
        console.warn(`[Server-LogBroadcast] Private log for ${logEntry.recipientPlayerId} in game ${gameId} could not be sent: socketId missing or player not found.`);
      }
    } else if (logEntry.privateVersionRecipientId) {
      const socketsInRoom = io.sockets.adapter.rooms.get(gameId);
      if (socketsInRoom) {
        socketsInRoom.forEach(socketIdInRoom => {
          const recipientPlayerState = gameRoomForLog.gameState.players[logEntry.privateVersionRecipientId!];
          if (recipientPlayerState && recipientPlayerState.socketId === socketIdInRoom) {
          } else {
            io.to(socketIdInRoom).emit(SocketEventName.SERVER_LOG_ENTRY, { gameId, logEntry });
          }
        });
      }
    } else {
      io.to(gameId).emit(SocketEventName.SERVER_LOG_ENTRY, { gameId, logEntry });
    }
  };
  setTriggerLogBroadcastFunction(broadcastLogEntryCustom);
  
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
      
      const newlyCreatedGameRoom = initializeNewGame(gameId, [playerSetupData]);
      
      if (newlyCreatedGameRoom) {
        socket.join(gameId);
        registerSocketSession(gameId, playerSetupData.id);
        const clientGameState = generatePlayerView(newlyCreatedGameRoom.gameState, playerSetupData.id);
        
        if (newlyCreatedGameRoom.gameState.logHistory && newlyCreatedGameRoom.gameState.logHistory.length > 0) {
          socket.emit(SocketEventName.INITIAL_LOGS, { logs: newlyCreatedGameRoom.gameState.logHistory.slice(-NUM_RECENT_LOGS_ON_JOIN_REJOIN) });
        }
        
        callback({ success: true, gameId, playerId: playerSetupData.id, gameState: clientGameState });
        console.log(`[Server] Game ${gameId} created for ${playerSetupData.id}.`);
      } else {
        callback({ success: false, message: 'Failed to initialize game. Invalid parameters or server error.' });
      }
    } catch (e: any) {
      console.error(`[Server-CreateGame] Error: ${e.message}`, e);
      callback({ success: false, message: `Server error: ${e.message || 'Unknown error'}` });
    }
  });
  
  socket.on(SocketEventName.JOIN_GAME, (gameIdToJoin: string, playerSetupData: InitialPlayerSetupData, callback: (response: JoinGameResponse) => void) => {
    try {
      if (!GAME_ID_REGEX.test(gameIdToJoin)) {
        callback({ success: false, message: "Invalid Game ID format." });
        return;
      }
      playerSetupData.socketId = socket.id; 
      console.log(`[Server] JoinGame: ${playerSetupData.name || playerSetupData.id} (Socket: ${socket.id}) to game ${gameIdToJoin}`);

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
    } catch (e: any) {
      console.error(`[Server-JoinGame] Error: ${e.message}`, e);
      callback({ success: false, message: `Server error: ${e.message || 'Unknown error'}` });
    }
  });
  
  socket.on(SocketEventName.ATTEMPT_REJOIN, async (data: { gameId: string; playerId: string }, callback: (response: AttemptRejoinResponse) => void) => {
    try {
      if (!GAME_ID_REGEX.test(data.gameId)) {
        callback({ success: false, message: "Invalid Game ID format." });
        return;
      }
      console.log(`[Server] AttemptRejoin: ${data.playerId} to game ${data.gameId} (New Socket: ${socket.id})`);
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
        // If server explicitly denies, we can emit this for client UI handling
        socket.emit(SocketEventName.REJOIN_DENIED, { message: result.message }); 
        callback({ success: false, message: result.message });
      }
    } catch (e: any) {
      console.error(`[Server-Rejoin] Error: ${e.message}`, e);
      callback({ success: false, message: `Server error: ${e.message || 'Unknown error'}` });
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

      let result: { 
        success: boolean; 
        message?: string; 
        updatedGameState?: ServerCheckGameState; 
        updatedPlayerSpecificGameState?: ClientCheckGameState;
        peekJustStarted?: boolean;
        peekTargets?: Array<{ playerID: string; cardIndex: number }>;
      } | null = null;

      switch (type as PlayerActionType) { // Cast type to PlayerActionType
        case PlayerActionType.DRAW_FROM_DECK: 
          result = handleDrawFromDeck(gameId, playerId); 
          break;
        case PlayerActionType.DRAW_FROM_DISCARD: 
          result = handleDrawFromDiscard(gameId, playerId); 
          break;
        case PlayerActionType.SWAP_AND_DISCARD: 
          result = typeof payload?.handIndex === 'number' 
            ? handleSwapAndDiscard(gameId, playerId, payload.handIndex) 
            : { success: false, message: "Invalid payload: handIndex must be a number." }; 
          break;
        case PlayerActionType.DISCARD_DRAWN_CARD: 
          result = handleDiscardDrawnCard(gameId, playerId); 
          break;
        case PlayerActionType.ATTEMPT_MATCH: 
          result = typeof payload?.handIndex === 'number' 
            ? handleAttemptMatch(gameId, playerId, payload.handIndex) 
            : { success: false, message: "Invalid payload: handIndex must be a number for attemptMatch." }; 
          break;
        case PlayerActionType.PASS_MATCH: 
          result = handlePassMatch(gameId, playerId); 
          break;
        case PlayerActionType.CALL_CHECK: 
          result = handleCallCheck(gameId, playerId); 
          break;
        case PlayerActionType.DECLARE_READY_FOR_PEEK: 
          result = handleDeclareReadyForPeek(gameId, playerId); 
          break;
        case PlayerActionType.REQUEST_PEEK_REVEAL:
          if (payload && payload.peekTargets && isValidTargetArray(payload.peekTargets)) {
            result = handleRequestPeekReveal(gameId, playerId, payload.peekTargets);
            if (result.success && result.updatedPlayerSpecificGameState) {
                if (callback) callback({ 
                    success: true, 
                    message: result.message, 
                    gameState: result.updatedPlayerSpecificGameState, 
                    peekTargets: result.peekTargets, // Echo back validated targets
                    peekJustStarted: result.peekJustStarted
                });
                // This direct emit might be redundant if the callback already triggers UI update with gameState.
                socket.emit(SocketEventName.GAME_STATE_UPDATE, { gameId, gameState: result.updatedPlayerSpecificGameState });
                console.log(`[Server] Sent player-specific peek reveal state to ${playerId} (${socket.id}) via direct emit and callback.`);
                return; 
            }
          } else {
            result = { success: false, message: 'Invalid or missing peekTargets for requestPeekReveal.' };
          }
          break;
        case PlayerActionType.RESOLVE_SPECIAL_ABILITY: 
          if (payload && typeof payload === 'object' && payload.hasOwnProperty('args') && isExtendedAbilityArgs(payload.args)) {
              result = handleResolveSpecialAbility(gameId, playerId, payload.args);
          } else {
              result = { success: false, message: "Invalid payload: args missing or malformed for resolveSpecialAbility." };
          }
          break;
        default:
          console.error(`[Server] Unknown action type received: '${type}'. Player: ${playerId}, Game: ${gameId}`);
          result = { success: false, message: `Unknown action type: '${type}'` };
      }

      if (result && result.success) {
        let responsePayload: PlayerActionResponse = { 
            success: true, 
            message: result.message, 
            peekTargets: result.peekTargets, 
            peekJustStarted: result.peekJustStarted 
        };
        if (result.updatedPlayerSpecificGameState) { 
            responsePayload.gameState = result.updatedPlayerSpecificGameState;
        } else if (result.updatedGameState) { 
            responsePayload.gameState = generatePlayerView(result.updatedGameState, playerId);
        }
        if (callback) callback(responsePayload);
        console.log(`[Server] Action ${type} by ${playerId} successful. Response sent to client.`);
      } else if (result) {
        if (callback) callback({ success: false, message: result.message });
        console.warn(`[Server] Action ${type} by ${playerId} failed: ${result.message}`);
      } else {
        if (callback) callback({ success: false, message: 'Action resulted in null or undefined result.' });
        console.error(`[Server] Action ${type} by ${playerId} resulted in null result from handler.`);
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
      if (session) {
        console.log(`[Server] Player ${session.playerId} in game ${session.gameId} will be marked as disconnected.`);
        markPlayerAsDisconnected(session.gameId, session.playerId);
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