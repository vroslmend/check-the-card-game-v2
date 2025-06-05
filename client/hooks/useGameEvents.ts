'use client';

import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../store';
import { SocketEventName } from 'shared-types'; // Updated path alias
import type {
  ClientCheckGameState,
  RichGameLogMessage,
  ChatMessage,
} from 'shared-types'; // Updated path alias

interface UseGameEventsParams {
  socket: Socket | null;
}

export const useGameEvents = ({ socket }: UseGameEventsParams) => {
  const setGameState = useGameStore((state) => state.setGameState);
  const addLogMessage = useGameStore((state) => state.addLogMessage);
  const addChatMessage = useGameStore((state) => state.addChatMessage);

  useEffect(() => {
    if (!socket) return;

    const handleGameStateUpdate = (newState: ClientCheckGameState) => {
      console.log('Received game state update:', newState);
      setGameState(newState);
    };

    const handleServerLogEntry = (logMessage: RichGameLogMessage) => {
      console.log('Received server log entry:', logMessage);
      addLogMessage(logMessage);
    };

    const handleInitialLogs = (initialLogs: RichGameLogMessage[]) => {
      console.log('Received initial logs:', initialLogs);
      // Assuming gameStore can handle an array or use a loop
      // For simplicity, if setGameState handles logHistory, this might be redundant
      // Or, we can have a dedicated action in the store, e.g., setInitialLogs
      initialLogs.forEach(addLogMessage);
    };

    const handleChatMessageFromServer = (chatMsg: ChatMessage) => {
      console.log('Received chat message:', chatMsg);
      addChatMessage(chatMsg);
    };

    const handlePlayerJoined = (data: { playerId: string; playerName?: string, gameState: ClientCheckGameState }) => {
      console.log('Player joined:', data.playerId, data.playerName);
      // Game state update will likely cover player list changes.
      // Optionally, add a specific log message here.
      addLogMessage({
        message: `${data.playerName || data.playerId} joined the game.`,
        type: 'system',
        timestamp: new Date().toISOString(), // Client-side timestamp for this event
        logId: `player-joined-${data.playerId}-${Date.now()}`
      });
      setGameState(data.gameState); // Update game state which includes the new player
    };

    const handleRejoinDenied = (data: { message: string }) => {
      console.warn('Rejoin denied:', data.message);
      // Display this message to the user, perhaps via a toast or a modal
      // For now, logging it and adding to game log
      addLogMessage({
        message: `Rejoin denied: ${data.message}`,
        type: 'error',
        timestamp: new Date().toISOString(),
        logId: `rejoin-denied-${Date.now()}`
      });
    };

    // Register event listeners using SocketEventName
    socket.on(SocketEventName.GAME_STATE_UPDATE, handleGameStateUpdate);
    socket.on(SocketEventName.SERVER_LOG_ENTRY, handleServerLogEntry);
    socket.on(SocketEventName.INITIAL_LOGS, handleInitialLogs);
    socket.on(SocketEventName.CHAT_MESSAGE, handleChatMessageFromServer);
    socket.on(SocketEventName.PLAYER_JOINED, handlePlayerJoined);
    socket.on(SocketEventName.REJOIN_DENIED, handleRejoinDenied);

    // Clean up listeners
    return () => {
      socket.off(SocketEventName.GAME_STATE_UPDATE, handleGameStateUpdate);
      socket.off(SocketEventName.SERVER_LOG_ENTRY, handleServerLogEntry);
      socket.off(SocketEventName.INITIAL_LOGS, handleInitialLogs);
      socket.off(SocketEventName.CHAT_MESSAGE, handleChatMessageFromServer);
      socket.off(SocketEventName.PLAYER_JOINED, handlePlayerJoined);
      socket.off(SocketEventName.REJOIN_DENIED, handleRejoinDenied);
    };
  }, [socket, setGameState, addLogMessage, addChatMessage]);
}; 