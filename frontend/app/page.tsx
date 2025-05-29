'use client';

import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import CheckGameBoard from './components/CheckGameBoard';
import type { ClientCheckGameState, InitialPlayerSetupData } from 'shared-types'; // Assuming shared-types is aliased or path is correct

// Define the server URL
const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8000';

export default function HomePage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<ClientCheckGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null); // This will be the player's unique ID in the game
  const [playerName, setPlayerName] = useState<string>("");
  const [inputGameId, setInputGameId] = useState<string>("");

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server:', newSocket.id);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setError('Disconnected from server. Please try refreshing.');
      // setGameState(null); // Optionally clear game state on disconnect
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
      setError(`Failed to connect to server: ${err.message}. Ensure server is running.`);
      setGameState(null);
    });

    // Listener for game state updates from the server
    newSocket.on('gameStateUpdate', (data: { gameId: string; gameState: ClientCheckGameState }) => {
      console.log('Received gameStateUpdate:', data);
      setGameState(data.gameState);
      setGameId(data.gameId); // Ensure gameId is also updated/set
      // If viewingPlayerId is part of gameState, set it if not already set, or verify
      if (data.gameState.viewingPlayerId && !playerId) {
        setPlayerId(data.gameState.viewingPlayerId);
      }
    });
    
    newSocket.on('playerJoined', (data: { gameId: string, newPlayerInfo: InitialPlayerSetupData, updatedTurnOrder: string[] }) => {
        console.log('Player joined notification:', data);
        // The gameStateUpdate that follows a join should provide the full new state.
        // This event can be used for UI notifications like "Player X has joined the game!"
        // If needed, you could update parts of the local state here, but often relying on gameStateUpdate is cleaner.
        alert(`${data.newPlayerInfo.name || data.newPlayerInfo.id} has joined the game!`);
    });

    // Cleanup on component unmount
    return () => {
      newSocket.off('gameStateUpdate');
      newSocket.off('playerJoined');
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.off('connect_error');
      newSocket.disconnect();
    };
  }, []); // Empty dependency array means this effect runs once on mount and cleanup on unmount

  const handleCreateGame = () => {
    if (!socket) {
      setError("Socket not connected.");
      return;
    }
    const tempPlayerId = `player_${socket.id}_${Math.random().toString(36).substring(2, 7)}`;
    const playerSetup: InitialPlayerSetupData = { id: tempPlayerId, name: playerName || tempPlayerId };
    setPlayerId(tempPlayerId); // Set our player ID immediately

    socket.emit('createGame', playerSetup, (response: { success: boolean; gameId?: string; gameState?: ClientCheckGameState; message?: string }) => {
      if (response.success && response.gameId && response.gameState) {
        setGameId(response.gameId);
        setGameState(response.gameState);
        setError(null);
        console.log('Game created successfully:', response.gameId, response.gameState);
      } else {
        setError(response.message || "Failed to create game.");
        console.error("Create game failed:", response.message);
        setPlayerId(null); // Clear optimistic player ID if creation failed
      }
    });
  };

  const handleJoinGame = () => {
    if (!socket || !inputGameId) {
      setError(!socket ? "Socket not connected." : "Please enter a Game ID to join.");
      return;
    }
    const tempPlayerId = `player_${socket.id}_${Math.random().toString(36).substring(2, 7)}`;
    const playerSetup: InitialPlayerSetupData = { id: tempPlayerId, name: playerName || tempPlayerId };
    setPlayerId(tempPlayerId); // Set our player ID immediately

    socket.emit('joinGame', inputGameId, playerSetup, (response: { success: boolean; gameId?: string; gameState?: ClientCheckGameState; message?: string }) => {
      if (response.success && response.gameId && response.gameState) {
        setGameId(response.gameId);
        setGameState(response.gameState);
        setError(null);
        console.log('Joined game successfully:', response.gameId, response.gameState);
      } else {
        setError(response.message || "Failed to join game.");
        console.error("Join game failed:", response.message);
        setPlayerId(null); // Clear optimistic player ID if join failed
      }
    });
  };
  
  // Handler for actions sent from CheckGameBoard
  const sendPlayerAction = (type: string, payload?: any) => {
    if (!socket || !gameId || !playerId) {
      console.error('Cannot send action: socket, gameId, or playerId missing', {socket, gameId, playerId});
      setError('Cannot send action: connection or game details missing.');
      return;
    }
    socket.emit('playerAction', { gameId, playerId, type, payload }, (response: {success: boolean, gameState?: ClientCheckGameState, message?: string}) => {
        if (response.success && response.gameState) {
            // The server will broadcast gameStateUpdate to all clients, including this one.
            // So, we might not strictly need to setGameState from this callback if 'gameStateUpdate' listener is robust.
            // However, it can be useful for immediate feedback or if server broadcast is delayed.
            // For now, rely on the broadcast via 'gameStateUpdate' listener.
            console.log(`Action ${type} acknowledged by server.`, response);
        } else {
            console.error(`Action ${type} failed:`, response.message);
            setError(response.message || `Action ${type} failed.`);
        }
    });
  };

  if (error) {
    return <div className="text-red-500 text-center p-8">Error: {error}</div>;
  }

  if (!gameState || !gameId || !playerId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-3xl font-bold mb-8">Check! The Card Game</h1>
        <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
          <input 
            type="text" 
            placeholder="Enter your name (optional)" 
            value={playerName} 
            onChange={(e) => setPlayerName(e.target.value)} 
            className="border p-2 w-full mb-4 rounded"
          />
          <button onClick={handleCreateGame} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full mb-4">
            Create New Game
          </button>
          <div className="my-4 text-center">OR</div>
          <input 
            type="text" 
            placeholder="Enter Game ID to Join" 
            value={inputGameId} 
            onChange={(e) => setInputGameId(e.target.value)} 
            className="border p-2 w-full mb-2 rounded"
          />
          <button onClick={handleJoinGame} className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full">
            Join Game
          </button>
        </div>
        {gameId && !gameState && <p className="mt-4 text-gray-600">Joining game {gameId}...</p>}
      </div>
    );
  }

  // If gameState, gameId, and playerId are available, render the game board
  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <h1 className="text-2xl font-bold mb-4">Game ID: {gameId} - Player: {playerName || playerId}</h1>
      <CheckGameBoard 
        gameState={gameState} 
        playerId={playerId} 
        onPlayerAction={sendPlayerAction} 
      />
    </main>
  );
}
