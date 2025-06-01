'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import CheckGameBoard from './components/CheckGameBoard';
import type { ClientCheckGameState, InitialPlayerSetupData } from 'shared-types'; // Assuming shared-types is aliased or path is correct
import GameLogComponent from './components/GameLogComponent';
import { FaBug } from 'react-icons/fa'; // Import the bug icon

// Define the server URL
const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8000';
const SESSION_STORAGE_KEY_GAME_ID = 'checkGame_gameId';
const SESSION_STORAGE_KEY_PLAYER_ID = 'checkGame_playerId';
const SESSION_STORAGE_KEY_PLAYER_NAME = 'checkGame_playerName';

const ADJECTIVES = [
  'Silent', 'Quick', 'Shadow', 'Crimson', 'Iron', 'Cosmic', 'Arctic', 'Mystic', 'Golden', 'Silver',
  'Brave', 'Calm', 'Daring', 'Eager', 'Fierce', 'Ghost', 'Hidden', 'Jade', 'Keen', 'Lone',
  'Noble', 'Proud', 'Red', 'Steel', 'Swift', 'True', 'Valiant', 'Wild', 'Young', 'Zephyr'
];
const NOUNS = [
  'Wolf', 'Phoenix', 'Specter', 'Blade', 'Comet', 'Fox', 'Puma', 'Dragon', 'Hawk', 'Serpent',
  'Arrow', 'Bear', 'Crown', 'Dice', 'Eagle', 'Fang', 'Griffin', 'Hound', 'Joker', 'Knight',
  'Lion', 'Moon', 'Night', 'Oak', 'Quill', 'Raven', 'Star', 'Thorn', 'Unicorn', 'Viper'
];

export default function HomePage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<ClientCheckGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null); // This will be the player's unique ID in the game
  const [playerName, setPlayerName] = useState<string>("");
  const [inputGameId, setInputGameId] = useState<string>("");
  const [log, setLog] = useState<{ message: string; timestamp: string }[]>([]);
  const [isAttemptingRejoin, setIsAttemptingRejoin] = useState<boolean>(true); // Start true to check storage
  const [copiedGameId, setCopiedGameId] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false); // New state for debug panel

  // Helper to add a log entry
  const addLog = useCallback((msg: string) => {
    setLog((prev) => {
      const next = [...prev, { message: msg, timestamp: new Date().toLocaleTimeString() }];
      return next.length > 100 ? next.slice(-100) : next;
    });
  }, []);

  const toggleDebugPanel = useCallback(() => {
    setShowDebugPanel(prev => !prev);
  }, []);

  // Effect for initializing socket and attempting to load session from localStorage
  useEffect(() => {
    const storedGameId = localStorage.getItem(SESSION_STORAGE_KEY_GAME_ID);
    const storedPlayerId = localStorage.getItem(SESSION_STORAGE_KEY_PLAYER_ID);
    const storedPlayerName = localStorage.getItem(SESSION_STORAGE_KEY_PLAYER_NAME);

    if (storedGameId && storedPlayerId) {
      setGameId(storedGameId);
      setPlayerId(storedPlayerId);
      addLog(`Found previous session: Game ${storedGameId.slice(-4)}, Player ${storedPlayerId.slice(-4)}`);
    } else {
      setIsAttemptingRejoin(false); // No session found, proceed to join/create UI
    }
    if (storedPlayerName) {
        setPlayerName(storedPlayerName);
    }

    const newSocket = io(SERVER_URL);
    setSocket(newSocket);
    return () => {
      newSocket.disconnect();
    };
  }, [addLog]); // addLog added to dependencies

  // Effect for setting up listeners AND attempting rejoin
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log('Connected to server:', socket.id);
      setError(null);
      // If we have a stored gameId and playerId, attempt to rejoin AFTER connecting
      const storedGameId = localStorage.getItem(SESSION_STORAGE_KEY_GAME_ID);
      const storedPlayerId = localStorage.getItem(SESSION_STORAGE_KEY_PLAYER_ID);
      if (storedGameId && storedPlayerId && isAttemptingRejoin) { // isAttemptingRejoin flag ensures we only do this once initially
        addLog(`Attempting to rejoin game ${storedGameId.slice(-4)} as player ${storedPlayerId.slice(-4)}...`);
        socket.emit('attemptRejoin', { gameId: storedGameId, playerId: storedPlayerId }, 
          (response: { success: boolean; gameState?: ClientCheckGameState; message?: string }) => {
            if (response.success && response.gameState) {
              setGameState(response.gameState);
              setGameId(storedGameId); // Already set, but confirm
              setPlayerId(storedPlayerId); // Already set, but confirm
              setError(null);
              addLog('Successfully rejoined game.');
            } else {
              addLog(`Rejoin failed: ${response.message || 'Could not rejoin previous game.'}`);
              localStorage.removeItem(SESSION_STORAGE_KEY_GAME_ID);
              localStorage.removeItem(SESSION_STORAGE_KEY_PLAYER_ID);
              // Don't remove player name, they might want to use it again
              setGameId(null); // Clear state so user sees join/create form
              setPlayerId(null);
              setGameState(null);
            }
            setIsAttemptingRejoin(false); // Rejoin attempt finished
          }
        );
      } else {
        setIsAttemptingRejoin(false); // No stored session or not attempting rejoin now
      }
    };

    const handleDisconnect = () => { console.log('Disconnected'); setError('Disconnected'); addLog("Disconnected from server."); };
    const handleConnectError = (err: Error) => { console.error('Connection error:', err); setError(`Connection error: ${err.message}`); addLog(`Connection error: ${err.message}`); setIsAttemptingRejoin(false); };
    const handleGameStateUpdate = (data: { gameId: string; gameState: ClientCheckGameState }) => {
      setGameState(currentGameState => {
        if (data.gameState.currentPhase && data.gameState.currentPhase !== currentGameState?.currentPhase) {
          addLog(`Phase: ${data.gameState.currentPhase}`);
        }
        return data.gameState;
      });
      setGameId(data.gameId); // Server is authoritative for gameId on update
      // If server sends viewingPlayerId, ensure our playerId matches it
      if (data.gameState.viewingPlayerId && playerId !== data.gameState.viewingPlayerId) {
        setPlayerId(data.gameState.viewingPlayerId);
        localStorage.setItem(SESSION_STORAGE_KEY_PLAYER_ID, data.gameState.viewingPlayerId);
        addLog(`Player ID updated by server to: ${data.gameState.viewingPlayerId.slice(-4)}`);
      }
    };
    const handlePlayerJoined = (data: { gameId: string, newPlayerInfo: InitialPlayerSetupData, updatedTurnOrder: string[] }) => {
      addLog(`Player joined: ${data.newPlayerInfo.name || data.newPlayerInfo.id.slice(-4)}`);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('gameStateUpdate', handleGameStateUpdate);
    socket.on('playerJoined', handlePlayerJoined);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('gameStateUpdate', handleGameStateUpdate);
      socket.off('playerJoined', handlePlayerJoined);
    };
  }, [socket, addLog, playerId, isAttemptingRejoin]); // isAttemptingRejoin and playerId added

  const handleCreateGame = () => {
    if (!socket) { setError("Socket not connected."); return; }
    const newPlayerId = `player_${socket.id}_${Math.random().toString(36).substring(2, 7)}`;
    
    let finalPlayerName = playerName.trim();
    if (!finalPlayerName) {
      const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
      const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
      finalPlayerName = `${adj}${noun}`;
    }

    const playerSetup: InitialPlayerSetupData = { id: newPlayerId, name: finalPlayerName };
    
    socket.emit('createGame', playerSetup, (response: { success: boolean; gameId?: string; playerId?: string; gameState?: ClientCheckGameState; message?: string }) => {
      if (response.success && response.gameId && response.playerId && response.gameState) {
        setGameId(response.gameId);
        setPlayerId(response.playerId);
        setGameState(response.gameState);
        localStorage.setItem(SESSION_STORAGE_KEY_GAME_ID, response.gameId);
        localStorage.setItem(SESSION_STORAGE_KEY_PLAYER_ID, response.playerId);
        localStorage.setItem(SESSION_STORAGE_KEY_PLAYER_NAME, finalPlayerName); // Store the final name
        setError(null);
        addLog(`Game ${response.gameId.slice(-4)} created. You are ${finalPlayerName} (Player ${response.playerId.slice(-4)}).`);
      } else {
        setError(response.message || "Failed to create game.");
      }
    });
  };

  const handleJoinGame = () => {
    if (!socket || !inputGameId) { setError(!socket ? "Socket not connected." : "Please enter a Game ID."); return; }
    const newPlayerId = `player_${socket.id}_${Math.random().toString(36).substring(2, 7)}`;
    
    let finalPlayerName = playerName.trim();
    if (!finalPlayerName) {
      const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
      const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
      finalPlayerName = `${adj}${noun}`;
    }

    const playerSetup: InitialPlayerSetupData = { id: newPlayerId, name: finalPlayerName };

    socket.emit('joinGame', inputGameId, playerSetup, (response: { success: boolean; gameId?: string; playerId?: string; gameState?: ClientCheckGameState; message?: string }) => {
      if (response.success && response.gameId && response.playerId && response.gameState) {
        setGameId(response.gameId);
        setPlayerId(response.playerId);
        setGameState(response.gameState);
        localStorage.setItem(SESSION_STORAGE_KEY_GAME_ID, response.gameId);
        localStorage.setItem(SESSION_STORAGE_KEY_PLAYER_ID, response.playerId);
        localStorage.setItem(SESSION_STORAGE_KEY_PLAYER_NAME, finalPlayerName); // Store the final name
        setError(null);
        addLog(`Joined Game ${response.gameId.slice(-4)}. You are ${finalPlayerName} (Player ${response.playerId.slice(-4)}).`);
      } else {
        setError(response.message || "Failed to join game.");
      }
    });
  };
  
  // Handler for actions sent from CheckGameBoard
  const sendPlayerAction = (type: string, payload?: any) => {
    if (!socket || !gameId || !playerId) {
      setError('Cannot send action: connection or game details missing.');
      return;
    }
    socket.emit('playerAction', { gameId, playerId, type, payload }, (response: {success: boolean, gameState?: ClientCheckGameState, message?: string}) => {
        if (response.success && response.gameState) {
            // Server broadcasts gameStateUpdate, so direct setGameState here might be redundant or cause quick double update.
            // However, server message might be useful.
            if (response.message && type === 'attemptMatch') {
              addLog(`Match Attempt: ${response.message}`); // Log server messages for match attempts
            } else if (response.message) {
              addLog(`Server: ${response.message}`); // Log other server messages
            }
        } else {
            setError(response.message || `Action ${type} failed.`);
            addLog(`Action ${type} failed: ${response.message || 'Unknown error'}`);
        }
    });
  };

  const handleCopyGameId = () => {
    if (gameId) {
      navigator.clipboard.writeText(gameId).then(() => {
        setCopiedGameId(true);
        setTimeout(() => setCopiedGameId(false), 2000); // Hide message after 2 seconds
      }).catch(err => {
        console.error('Failed to copy game ID: ', err);
        addLog("Error copying Game ID to clipboard.");
      });
    }
  };

  if (error && !gameState) { // Show full screen error only if not in a game already
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative shadow-lg max-w-md w-full">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline ml-2">{error}</span>
          <button 
            onClick={() => setError(null)} 
            className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-500 hover:text-red-700 font-bold"
          >
            X
          </button>
        </div>
      </div>
    );
  }

  // If still attempting rejoin and no game state yet, show loading. Avoids flash of join/create form.
  if (isAttemptingRejoin && !gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-3xl font-bold mb-8">Check! The Card Game</h1>
        <p className="text-gray-600">Attempting to rejoin previous game...</p>
      </div>
    );
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
          {/* Display general error messages here if any, related to form submission */} 
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </div>
      </div>
    );
  }

  // If gameState, gameId, and playerId are available, render the game board
  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 select-none">
      {/* Header */}
      <header className="bg-white dark:bg-neutral-800 shadow-md p-2.5 sm:p-3 flex items-center justify-between w-full flex-shrink-0">
        <div className="flex items-center">
          <h1 className="text-xl sm:text-2xl font-bold text-sky-600 dark:text-sky-400 mr-3 sm:mr-4">Check!</h1>
          {gameId && (
            <div className="flex items-center bg-gray-100 dark:bg-neutral-700 p-1.5 rounded-md">
              <span className="text-[0.65rem] sm:text-xs text-gray-500 dark:text-neutral-400 mr-1.5 uppercase">Game:</span>
              <span className="text-xs sm:text-sm font-mono font-semibold tracking-wider text-gray-700 dark:text-neutral-200">{gameId.slice(-6)}</span>
              <button 
                onClick={handleCopyGameId}
                title="Copy Game ID"
                className="ml-2 p-1 bg-gray-200 dark:bg-neutral-600 hover:bg-gray-300 dark:hover:bg-neutral-500 rounded transition-colors relative"
              >
                {/* SVG Icon for copy */}
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                {copiedGameId && <span className="absolute -top-6 -right-1 text-[0.6rem] bg-sky-500 text-white px-1 py-0.5 rounded-sm shadow-md">Copied!</span>}
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3">
          {playerName && <span className="text-xs sm:text-sm text-gray-500 dark:text-neutral-400 hidden sm:inline truncate max-w-[100px] sm:max-w-[150px]" title={playerName}>{playerName}</span>}
          <div className="flex items-center">
            <span className="text-[0.65rem] sm:text-xs text-gray-400 dark:text-neutral-500 mr-1 uppercase">P:</span>
            <span className="text-xs sm:text-sm font-mono text-gray-500 dark:text-neutral-400">{playerId.slice(-4)}</span>
          </div>
          {/* Debug Toggle Button */}
          <button 
            onClick={toggleDebugPanel}
            title="Toggle Debug Panel"
            className={`p-1.5 rounded transition-colors flex items-center justify-center 
              ${showDebugPanel 
                ? 'bg-sky-500 text-white hover:bg-sky-600' 
                : 'bg-gray-200 dark:bg-neutral-600 hover:bg-gray-300 dark:hover:bg-neutral-500 text-gray-700 dark:text-neutral-300'}
            `}
          >
            <FaBug size={16} />
          </button>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-grow flex flex-col items-center overflow-auto p-1 sm:p-2 bg-gray-100 dark:bg-neutral-900">
        <CheckGameBoard 
          gameState={gameState} 
          playerId={playerId} 
          onPlayerAction={sendPlayerAction} 
          gameId={gameId}
          showDebugPanel={showDebugPanel} /* Pass new prop */ 
        />
      </main>
      <GameLogComponent log={log} />
    </div>
  );
}
