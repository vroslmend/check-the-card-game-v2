import moduleAlias from 'module-alias';
import path from 'path';
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
    handleAcknowledgePeek,
    AbilityArgs,
    handleResolveSpecialAbility
} from './game-manager';
import { InitialPlayerSetupData, CheckGameState as ServerCheckGameState, ClientCheckGameState } from 'shared-types';

// Correct path for runtime: from server/dist to shared-types/dist/index.js
const sharedTypesPath = path.resolve(__dirname, '../../shared-types/dist/index.js');

moduleAlias.addAlias('shared-types', sharedTypesPath);
// Ensure this is done before any other imports that might use the alias

console.log('Server starting with Socket.IO...');

const httpServer = http.createServer();
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

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

    let result: { success: boolean; message?: string; updatedGameState?: ServerCheckGameState };

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
      case 'declareReadyForPeek': result = handleDeclareReadyForPeek(gameId, playerId); break;
      case 'acknowledgePeek': result = handleAcknowledgePeek(gameId, playerId); break;
      default:
        console.warn(`[Server] Unknown action type: ${type}`);
        result = { success: false, message: "Unknown action type." }; break;
    }

    if (result.success && result.updatedGameState) {
      const fullGameState = result.updatedGameState;
      const socketsInRoom = await io.in(gameId).allSockets();
      
      socketsInRoom.forEach(socketIdInRoom => {
        const targetSocket = io.sockets.sockets.get(socketIdInRoom) as Socket & { data: { playerId?: string } };
        const gamePlayerIdForSocket = targetSocket?.data?.playerId;

        if (gamePlayerIdForSocket) {
          const playerSpecificView = generatePlayerView(fullGameState, gamePlayerIdForSocket);
          io.to(socketIdInRoom).emit('gameStateUpdate', { gameId, gameState: playerSpecificView });
        } else {
          console.warn(`[Server] Could not find game player ID for socket ${socketIdInRoom} in game ${gameId}. Cannot send tailored state.`);
        }
      });
      
      console.log(`[Server] Action ${type} successful for ${playerId} in ${gameId}. Player-specific states broadcasted.`);
      const initiatorPlayerView = generatePlayerView(fullGameState, playerId);
      if (callback) callback({ success: true, gameState: initiatorPlayerView }); 
    } else {
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
