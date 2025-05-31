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
    setTriggerBroadcastFunction
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

io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  // Helper to store game player ID on socket
  const setSocketPlayerId = (gamePlayerId: string) => {
    (socket as any).data.playerId = gamePlayerId;
  };

  const getSocketPlayerId = (): string | undefined => {
    return (socket as any).data.playerId;
  };

  socket.on('createGame', (playerSetupData: InitialPlayerSetupData, callback) => {
    const gameId = `game_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[Server] Received createGame request from ${socket.id} for game ${gameId} with player data:`, playerSetupData);
    
    setSocketPlayerId(playerSetupData.id); // Store game playerId on socket
    const gameRoom = initializeNewGame(gameId, [playerSetupData]);

    if (gameRoom && gameRoom.gameState) {
      socket.join(gameId);
      console.log(`[Server] Player ${socket.id} (P1: ${playerSetupData.id}) created and joined room ${gameId}`);
      const playerSpecificView = generatePlayerView(gameRoom.gameState, playerSetupData.id);
      callback({ success: true, gameId, gameState: playerSpecificView });
    } else {
      console.error(`[Server] Failed to create game ${gameId}`);
      callback({ success: false, message: "Failed to create game." });
    }
  });

  socket.on('joinGame', async (gameId: string, playerSetupData: InitialPlayerSetupData, callback) => {
    console.log(`[Server] Received joinGame request from ${socket.id} for game ${gameId} with player data:`, playerSetupData);
    setSocketPlayerId(playerSetupData.id); // Store game playerId on socket
    const result = addPlayerToGame(gameId, playerSetupData);

    if (result.success && result.gameRoom && result.gameRoom.gameState) {
      socket.join(gameId);
      const fullGameState = result.gameRoom.gameState;
      console.log(`[Server] Player ${socket.id} (as ${playerSetupData.id}) joined room ${gameId}.`);

      // Notify existing players and send them updated views
      const socketsInRoom = await io.in(gameId).allSockets();
      socketsInRoom.forEach(socketIdInRoom => {
        const targetSocket = io.sockets.sockets.get(socketIdInRoom) as Socket & { data: { playerId?: string } };
        const gamePlayerIdForSocket = targetSocket?.data?.playerId;
        if (gamePlayerIdForSocket) {
          if (socketIdInRoom !== socket.id && result.message !== "Player already in game." && result.newPlayerState) {
            // Notify OTHERS about the new player
            targetSocket.emit('playerJoined', { 
              gameId,
              newPlayerInfo: { id: playerSetupData.id, name: playerSetupData.name },
              updatedTurnOrder: fullGameState.turnOrder 
            });
          }
          // Send full state update to everyone in the room including the new joiner
          const playerSpecificView = generatePlayerView(fullGameState, gamePlayerIdForSocket);
          targetSocket.emit('gameStateUpdate', { gameId, gameState: playerSpecificView });
          console.log(`[Server] Sent gameStateUpdate to ${gamePlayerIdForSocket} (${socketIdInRoom}) in game ${gameId}`);
        } else {
           console.warn(`[Server] Could not map socket ${socketIdInRoom} to playerID for gameStateUpdate after join in game ${gameId}.`);
        }
      });
      
      // Callback to the joining player with their specific view
      const playerSpecificView = generatePlayerView(fullGameState, playerSetupData.id);
      callback({ success: true, gameId, gameState: playerSpecificView, message: result.message });
    } else {
      console.warn(`[Server] Player ${socket.id} failed to join room ${gameId}. Reason: ${result.message}`);
      callback({ success: false, message: result.message || "Failed to join game." });
    }
  });

  socket.on('playerAction', async (action: { gameId: string; playerId: string; type: string; payload?: any }, callback) => {
    const { gameId, playerId, type, payload } = action;
    console.log(`[Server] Received playerAction: ${type} from ${playerId} (${socket.id}) in game ${gameId} with payload:`, payload);

    // Ensure socket has playerId mapping, especially if it's the first action after a reconnect without re-join
    if (!getSocketPlayerId()) {
        console.log(`[Server] Setting socket.data.playerId to ${playerId} from action.`);
        setSocketPlayerId(playerId);
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
      case 'resolveSpecialAbility': result = handleResolveSpecialAbility(gameId, playerId, payload as AbilityArgs); break;
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

  socket.on('disconnect', () => {
    const disconnectedPlayerId = getSocketPlayerId();
    console.log(`User disconnected: ${socket.id}, Player ID: ${disconnectedPlayerId}`);
    // Here you could add logic to notify other players in any games this player was in,
    // or to handle game state changes (e.g., pause game, remove player if rules allow).
    // For example: find games player was in, emit 'playerDisconnected' event to those rooms.
  });

  // More game-specific event handlers will be added here
});

const PORT = parseInt(process.env.PORT || '8000', 10);

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on http://localhost:${PORT}`);
});
