import 'module-alias/register';
// import path from 'path'; // No longer needed here
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
    AbilityArgs,
    handleResolveSpecialAbility,
    setTriggerBroadcastFunction,
    markPlayerAsDisconnected,
    attemptRejoin as attemptRejoinGame,
    handleRequestPeekReveal,
    setTriggerLogBroadcastFunction,
    getGameRoom,
} from './game-manager';
import { InitialPlayerSetupData, CheckGameState as ServerCheckGameState, ClientCheckGameState, RichGameLogMessage, ChatMessage } from 'shared-types';

console.log('Server starting with Socket.IO...');

const httpServer = http.createServer();
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Define the broadcast function that game-manager will use
const broadcastGameStateUpdate = async (gameId: string, fullGameState: ServerCheckGameState) => {
  const socketsInRoom = await io.in(gameId).allSockets();
  if (socketsInRoom.size === 0) {
    console.log(`[Server-BroadcastFn] No sockets in room ${gameId} to broadcast to.`);
    return;
  }
  console.log(`[Server-BroadcastFn] Broadcasting to ${socketsInRoom.size} socket(s) in room ${gameId}.`);
  socketsInRoom.forEach(socketIdInRoom => {
    const targetSocket = io.sockets.sockets.get(socketIdInRoom) as Socket & { data: { playerId?: string } };
    const gamePlayerIdForSocket = targetSocket?.data?.playerId;

    if (gamePlayerIdForSocket) {
      const playerSpecificView = generatePlayerView(fullGameState, gamePlayerIdForSocket);
      io.to(socketIdInRoom).emit('gameStateUpdate', { gameId, gameState: playerSpecificView });
      // console.log(`[Server-BroadcastFn] Sent gameStateUpdate to ${gamePlayerIdForSocket} (${socketIdInRoom}) in game ${gameId}`);
    } else {
      console.warn(`[Server-BroadcastFn] Could not find game player ID for socket ${socketIdInRoom} in game ${gameId}. Cannot send tailored state.`);
    }
  });
  console.log(`[Server-BroadcastFn] Broadcast complete for game ${gameId}.`);
};

// Pass the broadcast function to the game-manager
setTriggerBroadcastFunction(broadcastGameStateUpdate);

// New function to broadcast a single log entry
const broadcastLogEntry = async (gameId: string, logEntry: RichGameLogMessage) => {
  const isPublicLog = logEntry.isPublic !== false;

  if (isPublicLog) {
    if (logEntry.privateVersionRecipientId) {
      // This public log has a private version for a specific recipient.
      // Send this public log to everyone EXCEPT that recipient.
      const recipientPlayerId = logEntry.privateVersionRecipientId;
      const gameRoom = getGameRoom(gameId);
      const recipientSocketId = gameRoom?.gameState.players[recipientPlayerId]?.socketId;

      const socketsInRoom = await io.in(gameId).allSockets();
      socketsInRoom.forEach(socketIdInRoom => {
        if (socketIdInRoom !== recipientSocketId) {
          io.to(socketIdInRoom).emit('serverLogEntry', { gameId, logEntry });
        }
      });
      // Optional: console.log(`[Server-LogBroadcast-PublicConditional] Sent to room ${gameId} (excluding ${recipientPlayerId}): ${logEntry.actorName || 'System'} - ${logEntry.message}`);
    } else {
      // Standard public log, no specific private version for anyone. Send to all.
      io.to(gameId).emit('serverLogEntry', { gameId, logEntry });
      // Optional: console.log(`[Server-LogBroadcast-PublicGlobal] Sent to room ${gameId}: ${logEntry.actorName || 'System'} - ${logEntry.message}`);
    }
  } else if (logEntry.recipientPlayerId) {
    // This is a private log. Send only to the recipient.
    const gameRoom = getGameRoom(gameId);
    if (gameRoom && gameRoom.gameState.players[logEntry.recipientPlayerId]) {
      const recipientSocketId = gameRoom.gameState.players[logEntry.recipientPlayerId].socketId;
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('serverLogEntry', { gameId, logEntry });
        // Optional: console.log(`[Server-LogBroadcast-Private] Sent to player ${logEntry.recipientPlayerId} (socket ${recipientSocketId}): ${logEntry.message}`);
      } else {
        console.warn(`[Server-LogBroadcast-Private] Could not send private log to player ${logEntry.recipientPlayerId} in game ${gameId}: Socket ID not found.`);
      }
    } else {
      console.warn(`[Server-LogBroadcast-Private] Could not send private log to player ${logEntry.recipientPlayerId} in game ${gameId}: Player or game room not found.`);
    }
  } else {
    console.warn(`[Server-LogBroadcast] Log entry for game ${gameId} was marked private but no recipientPlayerId was provided. Broadcasting publicly as a fallback:`, logEntry);
    io.to(gameId).emit('serverLogEntry', { gameId, logEntry });
  }
};

// Pass the log broadcast function to the game-manager
setTriggerLogBroadcastFunction(broadcastLogEntry);

// Store a mapping of socket.id to gameId and playerId for easier disconnect handling
// This is a simple in-memory store; for production, a more robust solution (e.g., Redis) might be needed
interface SocketSessionInfo {
    gameId: string;
    playerId: string;
}
const socketSessionMap = new Map<string, SocketSessionInfo>();

const NUM_RECENT_LOGS_ON_JOIN = 20;

const GAME_ID_REGEX = /^game_[a-zA-Z0-9]{6}$/;

// Helper function to escape HTML characters
const escapeHTML = (text: string): string => {
  return text.replace(/[&<>"'`]/g, (match) => {
    switch (match) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      case '`': return '&#x60;';
      default: return match;
    }
  });
};

io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  // Helper to store game player ID on socket AND in map
  const registerSocketSession = (gameId: string, gamePlayerId: string) => {
    (socket as any).data.playerId = gamePlayerId;
    (socket as any).data.gameId = gameId; // Store gameId on socket as well
    socketSessionMap.set(socket.id, { gameId, playerId: gamePlayerId });
    console.log(`[Server] Registered session for socket ${socket.id}: game ${gameId}, player ${gamePlayerId}`);
  };

  const getSocketSession = (): SocketSessionInfo | undefined => {
    return socketSessionMap.get(socket.id);
  };

  const clearSocketSession = () => {
    const session = socketSessionMap.get(socket.id);
    if (session) {
        console.log(`[Server] Clearing session for socket ${socket.id}: game ${session.gameId}, player ${session.playerId}`);
    }
    socketSessionMap.delete(socket.id);
    // Also clear from socket.data if it was set
    delete (socket as any).data.playerId;
    delete (socket as any).data.gameId;
  };

  // Handler for receiving and broadcasting chat messages
  socket.on('sendChatMessage', (chatMessage: ChatMessage, callback: (ack: {success: boolean, messageId?: string, error?: string}) => void) => {
    const session = getSocketSession();
    if (!session || !session.gameId) {
      console.warn(`[Server-Chat] Received chat message from socket ${socket.id} but no game session found.`);
      if (callback) callback({ success: false, error: 'User not in a game session.' });
      return;
    }

    const messageContent = chatMessage.message ? chatMessage.message.trim() : '';
    if (messageContent.length === 0) {
      if (callback) callback({ success: false, error: 'Chat message cannot be empty.' });
      return;
    }
    if (messageContent.length > 500) {
        if (callback) callback({ success: false, error: 'Chat message too long.' });
        return;
    }

    const processedMessage: ChatMessage = {
      ...chatMessage,
      message: escapeHTML(messageContent), // Escape HTML in message content
      id: chatMessage.id || `servermsg_${session.gameId}_${Date.now()}`,
      senderId: session.playerId,
      senderName: getGameRoom(session.gameId)?.gameState.players[session.playerId]?.name || chatMessage.senderName || 'Unknown',
      timestamp: new Date().toISOString(),
      gameId: session.gameId,
      type: 'room',
    };

    io.to(session.gameId).emit('chatMessage', processedMessage);
    if (callback) callback({ success: true, messageId: processedMessage.id });
  });

  socket.on('createGame', (playerSetupData: InitialPlayerSetupData, callback: (response: { success: boolean; gameId?: string; playerId?: string; gameState?: ClientCheckGameState; message?: string }) => void) => {
    try {
      const gameId = `game_${Math.random().toString(36).substring(2, 8)}`;
      playerSetupData.socketId = socket.id;
      const gameRoom = initializeNewGame(gameId, [playerSetupData]);

      if (gameRoom) {
        socket.join(gameId);
        registerSocketSession(gameId, playerSetupData.id);
        const clientGameState = generatePlayerView(gameRoom.gameState, playerSetupData.id);
        
        // Send initial logs to the creator
        const welcomeMessage: RichGameLogMessage = {
          message: `Welcome, ${playerSetupData.name || playerSetupData.id.slice(-4)}! You've created Game ${gameId.slice(-6)}.`,
          type: 'system',
          timestamp: new Date().toISOString(),
          logId: `log_welcome_${socket.id}_${Date.now()}`
        };
        const recentLogs = gameRoom.gameState.logHistory?.slice(-NUM_RECENT_LOGS_ON_JOIN) || [];
        const initialLogPayload = [welcomeMessage, ...recentLogs.filter(log => log.message !== welcomeMessage.message)];
        
        socket.emit('initialLogs', { logs: initialLogPayload });
        
        callback({ success: true, gameId, playerId: playerSetupData.id, gameState: clientGameState });
      } else {
        callback({ success: false, message: "Failed to create game (null gameRoom)." });
      }
    } catch (error: any) {
      console.error(`[Server-CreateGame] Error during game creation: ${error.message}`, error);
      if (callback) callback({ success: false, message: `Server error: ${error.message || 'Failed to create game.'}` });
    }
  });

  socket.on('joinGame', (gameIdToJoin: string, playerSetupData: InitialPlayerSetupData, callback: (response: { success: boolean; gameId?: string; playerId?: string; gameState?: ClientCheckGameState; message?: string }) => void) => {
    try {
      if (!GAME_ID_REGEX.test(gameIdToJoin)) {
        console.warn(`[Server-JoinGame] Invalid gameId format received: ${gameIdToJoin}`);
        if (callback) callback({ success: false, message: "Invalid Game ID format." });
        return;
      }
      playerSetupData.socketId = socket.id;
      const result = addPlayerToGame(gameIdToJoin, playerSetupData, socket.id);

      if (result.success && result.gameRoom && result.newPlayerState) {
        socket.join(gameIdToJoin);
        registerSocketSession(gameIdToJoin, playerSetupData.id);
        const clientGameState = generatePlayerView(result.gameRoom.gameState, playerSetupData.id);

        // Send initial logs to the joiner
        const welcomeMessage: RichGameLogMessage = {
          message: `Welcome, ${playerSetupData.name || playerSetupData.id.slice(-4)}! You've joined Game ${gameIdToJoin.slice(-6)}.`,
          type: 'system',
          timestamp: new Date().toISOString(),
          logId: `log_welcome_${socket.id}_${Date.now()}`
        };
        const recentLogs = result.gameRoom.gameState.logHistory?.slice(-NUM_RECENT_LOGS_ON_JOIN) || [];
        const initialLogPayload = [welcomeMessage, ...recentLogs.filter(log => log.message !== welcomeMessage.message)];
        
        socket.emit('initialLogs', { logs: initialLogPayload });

        callback({ success: true, gameId: gameIdToJoin, playerId: playerSetupData.id, gameState: clientGameState });
      } else {
        callback({ success: false, message: result.message || "Failed to join game." });
      }
    } catch (error: any) {
      console.error(`[Server-JoinGame] Error during game join: ${error.message}`, error);
      if (callback) callback({ success: false, message: `Server error: ${error.message || 'Failed to join game.'}` });
    }
  });

  socket.on('attemptRejoin', async (data: { gameId: string; playerId: string }, callback: (response: { success: boolean; gameState?: ClientCheckGameState; message?: string }) => void) => {
    try {
      if (!GAME_ID_REGEX.test(data.gameId)) {
        console.warn(`[Server-AttemptRejoin] Invalid gameId format received: ${data.gameId}`);
        if (callback) callback({ success: false, message: "Invalid Game ID format for rejoin." });
        return;
      }
      console.log(`[Server] Received attemptRejoin from ${socket.id} for game ${data.gameId}, player ${data.playerId}`);
      const result = attemptRejoinGame(data.gameId, data.playerId, socket.id);

      if (result.success && result.gameState) {
        socket.join(data.gameId);
        registerSocketSession(data.gameId, data.playerId);
        console.log(`[Server] Player ${socket.id} (as ${data.playerId}) successfully rejoined game ${data.gameId}.`);
        
        // Send initial logs if present in the result
        if (result.initialLogsForRejoiner) {
          socket.emit('initialLogs', { logs: result.initialLogsForRejoiner });
        }
        
        // Send the latest game state to the rejoining player directly
        callback({ success: true, gameState: generatePlayerView(result.gameState, data.playerId) });
        
        // Broadcast updated game state to all players in the room (including the rejoining one again)
        // This ensures everyone has the latest, including potentially updated isConnected status.
        broadcastGameStateUpdate(data.gameId, result.gameState);

      } else {
        console.warn(`[Server] Player ${socket.id} failed to rejoin game ${data.gameId}. Reason: ${result.message}`);
        callback({ success: false, message: result.message });
      }
    } catch (error: any) {
      console.error(`[Server-AttemptRejoin] Error during rejoin attempt: ${error.message}`, error);
      if (callback) callback({ success: false, message: `Server error: ${error.message || 'Failed to rejoin.'}` });
    }
  });

  socket.on('playerAction', async (action: { gameId: string; playerId: string; type: string; payload?: any }, callback: (response: { success: boolean; gameState?: ClientCheckGameState; message?: string; peekJustStarted?: boolean; peekTargets?: any /* Consider more specific type for peekTargets based on usage */ }) => void) => {
    try {
      const { gameId, playerId, type, payload } = action;
      console.log(`[Server] Received playerAction: ${type} from ${playerId} (${socket.id}) in game ${gameId} with payload:`, payload);

      const session = getSocketSession();
      if (!session || session.gameId !== gameId || session.playerId !== playerId) {
          console.warn(`[Server] Action from socket ${socket.id} for player ${playerId}/game ${gameId} rejected due to session mismatch or no session. Current session:`, session);
          if (callback) callback({ success: false, message: "Session validation failed. Action rejected." });
          return; // Reject the action
      }

      // Specific handling for requestPeekReveal
      if (type === 'requestPeekReveal') {
          console.log(`[Server] Handling specific action: ${type} from ${playerId} in ${gameId}`);
          let peekCallbackResult: { success: boolean; message?: string; gameState?: ClientCheckGameState; peekTargets?: any };
          if (payload && Array.isArray(payload.peekTargets)) {
              const peekRevealResult = handleRequestPeekReveal(gameId, playerId, payload.peekTargets);
              if (peekRevealResult.success && peekRevealResult.updatedPlayerSpecificGameState) {
                  // Send the player-specific state directly to the requesting socket
                  socket.emit('gameStateUpdate', { gameId, gameState: peekRevealResult.updatedPlayerSpecificGameState });
                  console.log(`[Server] Sent player-specific peek reveal state to ${playerId} (${socket.id})`);
                  // The callback also receives this specific state
                  peekCallbackResult = { success: true, gameState: peekRevealResult.updatedPlayerSpecificGameState, message: peekRevealResult.message };
              } else {
                  peekCallbackResult = { success: false, message: peekRevealResult.message || "Failed to process peek reveal." };
              }
          } else {
              peekCallbackResult = { success: false, message: "Invalid payload: peekTargets must be an array for requestPeekReveal." };
          }
          if (callback) callback(peekCallbackResult);
          return; // Action fully handled, including callback. No further broadcast needed for this action.
      }

      // For all other actions:
      let result: { success: boolean; message?: string; updatedGameState?: ServerCheckGameState; [key: string]: any; }; // Allow extra fields like peekJustStarted
      let shouldBroadcastGeneral = true; 

      switch (type) {
        case 'drawFromDeck': result = handleDrawFromDeck(gameId, playerId); break;
        case 'drawFromDiscard': result = handleDrawFromDiscard(gameId, playerId); break;
        case 'swapAndDiscard': 
          result = typeof payload?.handIndex === 'number' 
            ? handleSwapAndDiscard(gameId, playerId, payload.handIndex) 
            : { success: false, message: "Invalid payload: handIndex must be a number." }; 
          break;
        case 'discardDrawnCard': result = handleDiscardDrawnCard(gameId, playerId); break;
        case 'attemptMatch': 
          result = typeof payload?.handIndex === 'number' 
            ? handleAttemptMatch(gameId, playerId, payload.handIndex) 
            : { success: false, message: "Invalid payload: handIndex must be a number for attemptMatch." }; 
          break;
        case 'passMatch': result = handlePassMatch(gameId, playerId); break;
        case 'callCheck': result = handleCallCheck(gameId, playerId); break;
        case 'resolveSpecialAbility': 
          if (payload && typeof payload === 'object' && 'args' in payload) {
              result = handleResolveSpecialAbility(gameId, playerId, payload.args as AbilityArgs);
          } else {
              console.error(`[Server] Invalid payload structure for resolveSpecialAbility:`, payload);
              result = { success: false, message: "Invalid payload structure for resolveSpecialAbility." };
          }
          break;
        case 'declareReadyForPeek': 
          result = handleDeclareReadyForPeek(gameId, playerId); 
          // The immediate broadcast of result.updatedGameState (if peek starts or player just readies)
          // will be handled by the generic logic below. The second broadcast (peek ends)
          // is triggered internally by game-manager via the setTriggerBroadcastFunction.
          break;
        default:
          console.warn(`[Server] Unknown action type: ${type}`);
          result = { success: false, message: "Unknown action type." }; 
          shouldBroadcastGeneral = false; // Don't broadcast for unknown action
          break;
      }

      if (result.success && result.updatedGameState && shouldBroadcastGeneral) {
        // Use the broadcastGameStateUpdate function for the immediate response
        broadcastGameStateUpdate(gameId, result.updatedGameState);
        
        console.log(`[Server] Action ${type} successful for ${playerId} in ${gameId}. Player-specific states broadcasted by general handler.`);
        const initiatorPlayerView = generatePlayerView(result.updatedGameState, playerId);
        // Ensure peekJustStarted is included in the callback if present in the result
        if (callback) callback({ success: true, gameState: initiatorPlayerView, message: result.message, peekJustStarted: result.peekJustStarted }); 
      } else if (result.success && !result.updatedGameState && shouldBroadcastGeneral) {
          // Action was successful but didn't result in a state change that needs immediate broadcast by this general handler
          console.log(`[Server] Action ${type} successful for ${playerId} in ${gameId}, but no immediate state update from this action to broadcast generally (may be handled internally or no state change).`);
          if (callback) callback({ success: true, message: result.message });
      } else if (result.success && result.updatedGameState && !shouldBroadcastGeneral) {
          // This case is for actions that update server state but explicitly skip general broadcast
          // (e.g. handleDeclareReadyForPeek when peek hasn't started yet, or if an action handles its own specific broadcast like requestPeekReveal would if not handled separately above)
          console.log(`[Server] Action ${type} successful for ${playerId}, general broadcast skipped by shouldBroadcastGeneral=false. Informing initiator.`);
          const initiatorPlayerView = generatePlayerView(result.updatedGameState, playerId);
          if (callback) callback({ success: true, gameState: initiatorPlayerView, message: result.message, peekJustStarted: result.peekJustStarted });
      } else if (!result.success) {
        console.warn(`[Server] Action ${type} failed for ${playerId} in ${gameId}. Reason: ${result.message}`);
        if (callback) callback({ success: false, message: result.message });
      }
    } catch (error: any) {
      console.error(`[Server-PlayerAction] Error during player action (${action.type}): ${error.message}`, error);
      if (callback) callback({ success: false, message: `Server error during action: ${error.message || 'Unknown error.'}` });
    }
  });

  socket.on('disconnect', async () => {
    try {
      const session = getSocketSession();
      console.log(`User disconnected: ${socket.id}`);

      if (session) {
        const { gameId, playerId } = session;
        console.log(`[Server] Player ${playerId} (socket ${socket.id}) disconnected from game ${gameId}.`);
        
        const result = markPlayerAsDisconnected(gameId, playerId);
        clearSocketSession(); // Remove from map

        if (result.success && result.updatedGameState) {
          console.log(`[Server] Player ${playerId} marked as disconnected in game ${gameId}. Broadcasting update.`);
          broadcastGameStateUpdate(gameId, result.updatedGameState);
          
          // Additional logic: e.g., if game should end or pause if too few players connected.
          // For now, just marking as disconnected.
        } else if (result.playerWasFound === false) {
            console.warn(`[Server] Attempted to mark player ${playerId} as disconnected from game ${gameId}, but player was not found in game state. Game room might have ended or player was already removed.`);
        } else {
            console.warn(`[Server] Failed to mark player ${playerId} as disconnected in game-manager for game ${gameId}, or game not found.`);
        }
      } else {
        console.log(`[Server] Socket ${socket.id} disconnected but had no active game session in map.`);
      }
    } catch (error: any) {
      console.error(`[Server-Disconnect] Error during disconnect: ${error.message}`, error);
      // Cannot send callback to client as they are disconnected
    }
  });
});

const PORT = parseInt(process.env.PORT || '8000', 10);

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on http://localhost:${PORT}`);
});
