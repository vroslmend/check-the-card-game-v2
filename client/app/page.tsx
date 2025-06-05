'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/context/SocketContext';
import { useGameStore } from '@/store/gameStore';
import { SocketEventName, ClientCheckGameState, InitialPlayerSetupData } from 'shared-types';
import { v4 as uuidv4 } from 'uuid'; // For generating unique player IDs

// Response types for callbacks, matching server/index.ts structure
interface CreateGameResponse {
  success: boolean;
  message?: string;
  gameId?: string;
  playerId?: string;
  gameState?: ClientCheckGameState;
}

interface JoinGameResponse {
  success: boolean;
  message?: string;
  gameId?: string; // gameId is part of the response for join as well
  playerId?: string;
  gameState?: ClientCheckGameState; // gameState might be sent if rejoining or player already known
}

export default function HomePage() {
  const router = useRouter();
  const { socket, emitEvent, isConnected } = useSocket();
  const { setLocalPlayerId, setGameState, localPlayerId: storePlayerId, currentGameState: storeGameState } = useGameStore();

  const [playerName, setPlayerName] = useState('');
  const [gameIdToJoin, setGameIdToJoin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already in a game (e.g., after a refresh on game page and then navigating back),
  // potentially redirect to the game page.
  useEffect(() => {
    if (storePlayerId && storeGameState && storeGameState.gameId) {
      // router.push(`/game/${storeGameState.gameId}`);
      // Decided against auto-redirect for now to allow explicit create/join actions.
      // User might want to start a new game or join a different one.
      console.log('Player is already in a game in store:', storeGameState.gameId, storePlayerId);
    }
  }, [storePlayerId, storeGameState, router]);

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      setError('Player name is required.');
      return;
    }
    if (!isConnected || !socket) {
      setError('Not connected to the server.');
      return;
    }
    setIsLoading(true);
    setError(null);

    const newPlayerId = uuidv4();
    const playerSetupData: InitialPlayerSetupData = { id: newPlayerId, name: playerName.trim() };

    emitEvent(
      SocketEventName.CREATE_GAME,
      playerSetupData,
      (response: CreateGameResponse) => {
        setIsLoading(false);
        if (response.success && response.gameId && response.playerId && response.gameState) {
          setLocalPlayerId(response.playerId);
          setGameState(response.gameState);
          router.push(`/game/${response.gameId}`);
        } else {
          setError(response.message || 'Failed to create game.');
        }
      }
    );
  };

  const handleJoinGame = async () => {
    if (!playerName.trim()) {
      setError('Player name is required.');
      return;
    }
    if (!gameIdToJoin.trim()) {
      setError('Game ID is required to join.');
      return;
    }
    if (!isConnected || !socket) {
      setError('Not connected to the server.');
      return;
    }
    setIsLoading(true);
    setError(null);

    const newPlayerId = uuidv4();
    const playerSetupData: InitialPlayerSetupData = { id: newPlayerId, name: playerName.trim() };

    emitEvent(
      SocketEventName.JOIN_GAME,
      gameIdToJoin.trim(),
      playerSetupData,
      (response: JoinGameResponse) => {
        setIsLoading(false);
        if (response.success && response.gameId && response.playerId) {
          setLocalPlayerId(response.playerId);
          if (response.gameState) { // Game state might not always be sent on join, depends on server logic
            setGameState(response.gameState);
          }
          router.push(`/game/${response.gameId}`);
        } else {
          setError(response.message || 'Failed to join game.');
        }
      }
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-[family-name:var(--font-geist-sans)]">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-xl">
        <h1 className="text-3xl font-bold text-center text-indigo-400">Check! The Card Game</h1>
        
        <p className="text-sm text-center text-gray-400">
          Connection Status: {isConnected ? <span className='text-green-400'>Connected</span> : <span className='text-red-400'>Disconnected</span>}
        </p>

        {error && (
          <p className="text-sm text-center text-red-400 bg-red-900 p-3 rounded-md">Error: {error}</p>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="playerName" className="block text-sm font-medium text-gray-300">
              Player Name
            </label>
            <input
              type="text"
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="space-y-6 pt-4 border-t border-gray-700">
          <h2 className="text-xl font-semibold text-center text-indigo-300">Create a New Game</h2>
          <button
            onClick={handleCreateGame}
            disabled={isLoading || !isConnected}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating...' : 'Create Game'}
          </button>
        </div>

        <div className="space-y-6 pt-4 border-t border-gray-700">
          <h2 className="text-xl font-semibold text-center text-indigo-300">Join an Existing Game</h2>
          <div>
            <label htmlFor="gameIdToJoin" className="block text-sm font-medium text-gray-300">
              Game ID
            </label>
            <input
              type="text"
              id="gameIdToJoin"
              value={gameIdToJoin}
              onChange={(e) => setGameIdToJoin(e.target.value)}
              placeholder="Enter Game ID"
              className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleJoinGame}
            disabled={isLoading || !isConnected}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Joining...' : 'Join Game'}
          </button>
        </div>

      </div>
      <footer className="mt-8 text-center">
        <p className="text-xs text-gray-500">
          Powered by Next.js, XState, Zustand, Socket.IO & Tailwind CSS
        </p>
      </footer>
    </div>
  );
}
