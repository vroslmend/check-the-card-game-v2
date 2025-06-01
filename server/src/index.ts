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
    attemptRejoin as attemptRejoinGame
} from './game-manager';
import { InitialPlayerSetupData, CheckGameState as ServerCheckGameState, ClientCheckGameState } from 'shared-types';

console.log('Server starting with Socket.IO...');

const httpServer = http.createServer();
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "http://localhost:3000",
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

// Store a mapping of socket.id to gameId and playerId for easier disconnect handling
// This is a simple in-memory store; for production, a more robust solution (e.g., Redis) might be needed
interface SocketSessionInfo {
    gameId: string;
    playerId: string;
}
const socketSessionMap = new Map<string, SocketSessionInfo>();

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

  socket.on('createGame', (playerSetupData: InitialPlayerSetupData, callback) => {
    const gameId = `game_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[Server] Received createGame request from ${socket.id} for game ${gameId} with player data:`, playerSetupData);
    
    // Add socket.id to playerSetupData for game-manager
    const fullPlayerSetupData = { ...playerSetupData, socketId: socket.id };
    
    const gameRoom = initializeNewGame(gameId, [fullPlayerSetupData]);

    if (gameRoom && gameRoom.gameState) {
      socket.join(gameId);
      registerSocketSession(gameId, fullPlayerSetupData.id); // Use fullPlayerSetupData.id as playerId
      console.log(`[Server] Player ${socket.id} (P1: ${fullPlayerSetupData.id}) created and joined room ${gameId}`);
      const playerSpecificView = generatePlayerView(gameRoom.gameState, fullPlayerSetupData.id);
      callback({ success: true, gameId, playerId: fullPlayerSetupData.id, gameState: playerSpecificView }); // Return playerId
    } else {
      console.error(`[Server] Failed to create game ${gameId}`);
      callback({ success: false, message: "Failed to create game." });
    }
  });

  socket.on('joinGame', async (gameId: string, playerSetupData: InitialPlayerSetupData, callback) => {
    console.log(`[Server] Received joinGame request from ${socket.id} for game ${gameId} with player data:`, playerSetupData);
    
    // Pass socket.id to addPlayerToGame
    const result = addPlayerToGame(gameId, playerSetupData, socket.id);

    if (result.success && result.gameRoom && result.gameRoom.gameState && result.newPlayerState) {
      socket.join(gameId);
      registerSocketSession(gameId, playerSetupData.id); // Use playerSetupData.id as playerId
      const fullGameState = result.gameRoom.gameState;
      console.log(`[Server] Player ${socket.id} (as ${playerSetupData.id}) joined room ${gameId}.`);

      broadcastGameStateUpdate(gameId, fullGameState); // Broadcast to all, including new player and existing ones
      
      // Callback to the joining player is now implicitly handled by broadcastGameStateUpdate
      // if the client expects a direct callback with state, we can still provide it.
      // The client page.tsx seems to process gameStateUpdate for all setup.
      console.log(`[Server] Game state broadcasted after player ${playerSetupData.id} joined.`);
      callback({ success: true, gameId, playerId: playerSetupData.id, gameState: generatePlayerView(fullGameState, playerSetupData.id), message: result.message }); // Return playerId
    } else {
      console.warn(`[Server] Player ${socket.id} failed to join room ${gameId}. Reason: ${result.message}`);
      callback({ success: false, message: result.message || "Failed to join game." });
    }
  });

  socket.on('attemptRejoin', (data: { gameId: string; playerId: string }, callback) => {
    const { gameId, playerId } = data;
    console.log(`[Server] Received attemptRejoin from socket ${socket.id} for game ${gameId}, player ${playerId}`);

    const result = attemptRejoinGame(gameId, playerId, socket.id);

    if (result.success && result.gameState) {
      socket.join(gameId);
      registerSocketSession(gameId, playerId); // Re-register with new socket ID if needed
      
      broadcastGameStateUpdate(gameId, result.gameState); // Broadcast updated state (e.g. player now connected)
      
      console.log(`[Server] Player ${playerId} (${socket.id}) successfully rejoined game ${gameId}.`);
      // Client expects specific view in callback
      const playerSpecificView = generatePlayerView(result.gameState, playerId);
      callback({ success: true, gameState: playerSpecificView, message: result.message });
    } else {
      console.warn(`[Server] Player ${playerId} (${socket.id}) failed to rejoin game ${gameId}. Reason: ${result.message}`);
      callback({ success: false, message: result.message || "Failed to rejoin." });
    }
  });

  socket.on('playerAction', async (action: { gameId: string; playerId: string; type: string; payload?: any }, callback) => {
    const { gameId, playerId, type, payload } = action;
    console.log(`[Server] Received playerAction: ${type} from ${playerId} (${socket.id}) in game ${gameId} with payload:`, payload);

    // Ensure socket has session mapping. If not, it might be a stray action or needs rejoin.
    const session = getSocketSession();
    if (!session || session.gameId !== gameId || session.playerId !== playerId) {
        console.warn(`[Server] Action from socket ${socket.id} for player ${playerId}/game ${gameId} but no matching session or session mismatch. Current session:`, session);
        // Depending on strictness, could reject action or try to recover.
        // For now, we proceed but log warning. Client should ideally rejoin first.
        // Let's ensure socket.data is set as a fallback, though registerSocketSession should be the primary way.
         (socket as any).data.playerId = playerId;
         (socket as any).data.gameId = gameId;
    }

    let result: { success: boolean; message?: string; updatedGameState?: ServerCheckGameState; [key: string]: any; }; // Allow extra fields like peekJustStarted
    let shouldBroadcastGeneral = true; // Default to true for most actions that return updatedGameState

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
      if (callback) callback({ success: true, gameState: initiatorPlayerView, message: result.message }); 
    } else if (result.success && !result.updatedGameState && shouldBroadcastGeneral) {
        // Action was successful but didn't result in a state change that needs immediate broadcast by this general handler
        console.log(`[Server] Action ${type} successful for ${playerId} in ${gameId}, but no immediate state update from this action to broadcast generally (may be handled internally or no state change).`);
        if (callback) callback({ success: true, message: result.message });
    }
    else if (!result.success) {
      console.warn(`[Server] Action ${type} failed for ${playerId} in ${gameId}. Reason: ${result.message}`);
      if (callback) callback({ success: false, message: result.message });
    }
  });

  socket.on('disconnect', async () => {
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
  });

  // More game-specific event handlers will be added here
});

const PORT = parseInt(process.env.PORT || '8000', 10);

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on http://localhost:${PORT}`);
});
