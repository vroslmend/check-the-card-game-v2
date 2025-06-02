'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react'; // Changed from framer-motion
import CheckGameBoard from './components/CheckGameBoard';
import type { ClientCheckGameState, InitialPlayerSetupData } from 'shared-types'; // Assuming shared-types is aliased or path is correct
import GameLogComponent from './components/GameLogComponent';
import { FaBug } from 'react-icons/fa'; // Import the bug icon
import { FiX } from 'react-icons/fi'; // Added import for FiX

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
  const [isAttemptingRejoin, setIsAttemptingRejoin] = useState<boolean>(true); // Start true
  const [rejoinStatusMessage, setRejoinStatusMessage] = useState<string>("Attempting to rejoin previous game..."); // More detailed status
  const [copiedGameId, setCopiedGameId] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false); // New state for debug panel
  const [turnSegmentTrigger, setTurnSegmentTrigger] = useState<number>(0); // For progress bar reset
  const [visibilityTrigger, setVisibilityTrigger] = useState<number>(0); // For tab focus reset

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

  const handleReturnToLobby = useCallback(() => {
    setGameState(null);
    setGameId(null);
    setPlayerId(null);
    setInputGameId("");
    setError(null); // Clear general lobby errors
    setRejoinStatusMessage(""); // Clear rejoin status
    localStorage.removeItem(SESSION_STORAGE_KEY_GAME_ID);
    localStorage.removeItem(SESSION_STORAGE_KEY_PLAYER_ID);
    addLog("Returned to lobby. Game session cleared.");
    setIsAttemptingRejoin(false); // Explicitly stop any rejoin attempts
  }, [addLog]);

  // Effect for initializing socket and attempting to load session from localStorage
  useEffect(() => {
    const storedGameId = localStorage.getItem(SESSION_STORAGE_KEY_GAME_ID);
    const storedPlayerId = localStorage.getItem(SESSION_STORAGE_KEY_PLAYER_ID);
    const storedPlayerName = localStorage.getItem(SESSION_STORAGE_KEY_PLAYER_NAME);

    if (storedGameId && storedPlayerId) {
      setGameId(storedGameId);
      setPlayerId(storedPlayerId);
      setRejoinStatusMessage(`Found previous session: Game ${storedGameId.slice(-4)}. Attempting to reconnect...`);
      addLog(`Found previous session: Game ${storedGameId.slice(-4)}, Player ${storedPlayerId.slice(-4)}`);
    } else {
      setIsAttemptingRejoin(false); 
      setRejoinStatusMessage("");
    }
    if (storedPlayerName) {
      setPlayerName(storedPlayerName);
    }

    const newSocket = io(SERVER_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 3000, // Start with 3s
      reconnectionDelayMax: 10000, // Max delay 10s
      timeout: 20000, // Connection timeout for initial connection
    });
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  }, [addLog]);

  // Effect for setting up listeners AND attempting rejoin
  useEffect(() => {
    if (!socket) return;

    let rejoinAttemptedOnConnect = false; // Flag to ensure rejoin is emitted only once per connection sequence during a rejoin phase

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Page.tsx] Tab became visible, incrementing visibilityTrigger.');
        setVisibilityTrigger(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleConnect = () => {
      console.log('Connected to server:', socket.id);
      setError(null); // Clear general lobby error
      setRejoinStatusMessage("Connected. Checking session...");
      
      const storedGameId = localStorage.getItem(SESSION_STORAGE_KEY_GAME_ID);
      const storedPlayerId = localStorage.getItem(SESSION_STORAGE_KEY_PLAYER_ID);

      if (storedGameId && storedPlayerId && isAttemptingRejoin && !rejoinAttemptedOnConnect) {
        rejoinAttemptedOnConnect = true;
        addLog(`Attempting to rejoin game ${storedGameId.slice(-4)} as player ${storedPlayerId.slice(-4)}...`);
        setRejoinStatusMessage(`Attempting to rejoin game ${storedGameId.slice(-4)}...`);
        socket.emit('attemptRejoin', { gameId: storedGameId, playerId: storedPlayerId }, 
          (response: { success: boolean; gameState?: ClientCheckGameState; message?: string }) => {
            if (response.success && response.gameState) {
              setGameState(response.gameState);
              setGameId(storedGameId);
              setPlayerId(storedPlayerId);
              setError(null);
              addLog('Successfully rejoined game.');
              setRejoinStatusMessage('Successfully rejoined game!');
              setIsAttemptingRejoin(false); // SUCCESS
            } else {
              addLog(`Rejoin failed: ${response.message || 'Could not rejoin previous game.'}`);
              setRejoinStatusMessage(`Rejoin failed: ${response.message || 'Previous session invalid.'}`);
              localStorage.removeItem(SESSION_STORAGE_KEY_GAME_ID);
              localStorage.removeItem(SESSION_STORAGE_KEY_PLAYER_ID);
              setGameId(null); 
              setPlayerId(null);
              setGameState(null);
              setIsAttemptingRejoin(false); // DEFINITIVE FAIL from server
            }
          }
        );
      } else if (!isAttemptingRejoin) {
        // If not attempting rejoin, connection is for new game/join
        setRejoinStatusMessage(""); // Clear any residual status
      }
      // If isAttemptingRejoin but no storedGameId/PlayerId, or rejoinAttemptedOnConnect is true, do nothing here.
      // isAttemptingRejoin will be set to false if it was true but no IDs were found by the initial useEffect or after reconnect_failed.
    };

    const handleDisconnect = (reason: string) => {
      console.log('Disconnected:', reason);
      addLog(`Disconnected from server: ${reason}`);
      if (reason === 'io server disconnect') { // Server told us to disconnect
        setIsAttemptingRejoin(false); // Don't try to rejoin if server kicked us
        setRejoinStatusMessage("Disconnected by server.");
        handleReturnToLobby(); // Go back to lobby
      } else if (gameId && playerId) { // If we were in a game and it wasn't a server kick
        // isAttemptingRejoin might already be true if this disconnect triggers before initial rejoin logic fully completes
        // Or, if it's a subsequent disconnect after being in a game.
        // We don't set it to true here, rely on initial state or reconnect_attempt.
        setRejoinStatusMessage("Connection lost. Attempting to reconnect...");
        setError("Connection lost. Attempting to reconnect..."); // Show error in lobby if user gets there
      }
    };

    const handleConnectError = (err: Error) => { 
      console.error('Connection error:', err.message);
      addLog(`Connection error: ${err.message}`);
      // Don't set isAttemptingRejoin to false here. Let reconnect_failed handle it.
      // Update status message if currently in rejoin process
      if (isAttemptingRejoin) {
        setRejoinStatusMessage(`Connection error: ${err.message}. Retrying...`);
      } else {
        setError(`Connection error: ${err.message}`); // For lobby view
      }
    };

    const handleReconnectAttempt = (attemptNumber: number) => {
      console.log(`Reconnect attempt #${attemptNumber}`);
      addLog(`Reconnect attempt #${attemptNumber}`);
      if (isAttemptingRejoin || (gameId && playerId)) { // If initial rejoin or trying to restore active game
         setRejoinStatusMessage(`Connection lost. Reconnect attempt #${attemptNumber}...`);
      }
      rejoinAttemptedOnConnect = false; // Reset for the new connection attempt
    };

    const handleReconnectFailed = () => {
      console.error('Reconnection failed after multiple attempts.');
      addLog('Reconnection failed definitively.');
      if (isAttemptingRejoin || (gameId && playerId)) {
        setRejoinStatusMessage("Failed to reconnect. Please check your connection and refresh or return to lobby.");
        setIsAttemptingRejoin(false); // Definitive failure to reconnect
        // Clear gameId/playerId so user sees lobby, but keep localStorage for manual refresh.
        // If they choose "Return to Lobby", that will clear localStorage.
        setGameState(null); 
        setGameId(null);
        setPlayerId(null); 
        setError("Failed to reconnect to the game server.");
      }
    };
    
    const handleGameStateUpdate = (data: { gameId: string; gameState: ClientCheckGameState }) => {
      setGameState(currentGameState => {
        console.log('[Page.tsx-gameStateUpdate] Received. New CurrentPlayerID:', data.gameState.currentPlayerId, 'New Segment:', data.gameState.currentTurnSegment);
        if (currentGameState) {
            console.log('[Page.tsx-gameStateUpdate] Old CurrentPlayerID:', currentGameState.currentPlayerId, 'Old Segment:', currentGameState.currentTurnSegment);
        }

        if (data.gameState.currentPhase && data.gameState.currentPhase !== currentGameState?.currentPhase) {
          addLog(`Phase: ${data.gameState.currentPhase}`);
        }
        // Update turnSegmentTrigger when game state changes for current player or their segment
        if (currentGameState && 
            (data.gameState.currentPlayerId !== currentGameState.currentPlayerId || 
             (data.gameState.currentPlayerId === playerId && data.gameState.currentTurnSegment !== currentGameState.currentTurnSegment)) ) {
          setTurnSegmentTrigger(prevKey =>  prevKey + 1);
          console.log(`[Page.tsx-turnSegmentTrigger] Updated due to player/segment change. New trigger: ${turnSegmentTrigger +1}`);
        }
        return data.gameState;
      });
      setGameId(data.gameId);
      if (data.gameState.viewingPlayerId && playerId !== data.gameState.viewingPlayerId) {
        setPlayerId(data.gameState.viewingPlayerId);
        localStorage.setItem(SESSION_STORAGE_KEY_PLAYER_ID, data.gameState.viewingPlayerId);
        addLog(`Player ID updated by server to: ${data.gameState.viewingPlayerId.slice(-4)}`);
      }
      // If a gameStateUpdate comes through, it implies successful connection/rejoin.
      if(isAttemptingRejoin) {
        setIsAttemptingRejoin(false);
        setRejoinStatusMessage("Game state updated, session active.");
        addLog("Game state updated, session active.");
      }
    };

    const handlePlayerJoined = (data: { gameId: string, newPlayerInfo: InitialPlayerSetupData, updatedTurnOrder: string[] }) => {
      addLog(`Player joined: ${data.newPlayerInfo.name || data.newPlayerInfo.id.slice(-4)}`);
    };
    
    // Custom event from server if rejoin attempt is specifically denied (e.g. game full, not found)
    // This is an alternative to using the callback of `socket.emit('attemptRejoin', ...)`
    const handleRejoinDenied = (data: { message: string }) => {
        addLog(`Rejoin denied: ${data.message}`);
        setRejoinStatusMessage(`Rejoin denied: ${data.message}`);
        localStorage.removeItem(SESSION_STORAGE_KEY_GAME_ID);
        localStorage.removeItem(SESSION_STORAGE_KEY_PLAYER_ID);
        setGameId(null);
        setPlayerId(null);
        setGameState(null);
        setIsAttemptingRejoin(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('reconnect_attempt', handleReconnectAttempt);
    socket.on('reconnect_failed', handleReconnectFailed);
    socket.on('gameStateUpdate', handleGameStateUpdate);
    socket.on('playerJoined', handlePlayerJoined);
    socket.on('rejoinDenied', handleRejoinDenied); // New listener for specific rejoin errors

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect',handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('reconnect_attempt', handleReconnectAttempt);
      socket.off('reconnect_failed', handleReconnectFailed);
      socket.off('gameStateUpdate', handleGameStateUpdate);
      socket.off('playerJoined', handlePlayerJoined);
      socket.off('rejoinDenied', handleRejoinDenied);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [socket, addLog, playerId, isAttemptingRejoin, gameId, handleReturnToLobby]); // Added gameId, handleReturnToLobby

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
    
    setRejoinStatusMessage(""); // Clear rejoin status
    setIsAttemptingRejoin(false); // No longer rejoining

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

    setRejoinStatusMessage(""); // Clear rejoin status
    setIsAttemptingRejoin(false); // No longer rejoining

    const sanitizedGameId = inputGameId.trim();
    if (sanitizedGameId.startsWith('http://') || sanitizedGameId.startsWith('https://')) {
        setError("Invalid Game ID format. Please enter only the Game ID (e.g., game_xxxxxx), not a full URL.");
        addLog("Join attempt with invalid Game ID format (URL detected).");
        return;
    }
    if (!sanitizedGameId.startsWith('game_')) {
        setError("Invalid Game ID format. Game IDs typically start with 'game_'.");
        addLog("Join attempt with invalid Game ID format (missing 'game_' prefix).");
        return;
    }

    socket.emit('joinGame', sanitizedGameId, playerSetup, (response: { success: boolean; gameId?: string; playerId?: string; gameState?: ClientCheckGameState; message?: string }) => {
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
  const sendPlayerAction = (
    type: string, 
    payload?: any,
    clientCallback?: (message: string, isError: boolean) => void
  ) => {
    if (!socket || !gameId || !playerId) {
      setError('Cannot send action: connection or game details missing.');
      if (clientCallback) clientCallback('Connection or game details missing.', true);
      return;
    }
    socket.emit('playerAction', { gameId, playerId, type, payload }, 
        (response: {success: boolean, gameState?: ClientCheckGameState, message?: string}) => {
        // Handle the server's response
        if (response.message && clientCallback) {
          clientCallback(response.message, !response.success);
        } else if (clientCallback && type === 'passMatch' && response.success) {
          // For a successful pass, if server sends no specific message, 
          // let CheckGameBoard provide its default by calling callback with empty string.
          clientCallback("", false);
        } else if (clientCallback && response.success && !response.message) {
          // For other successful actions with no message, indicate success without text
          clientCallback("", false);
        } else if (clientCallback && !response.success && !response.message) {
            // For failed actions with no message, provide a generic error message
            clientCallback(`Action ${type} failed.`, true);
        }

        // Existing logic for logging or setting global error can remain (or be enhanced)
        if (response.success && response.gameState) {
          // THIS IS WHERE THE PLAYER-SPECIFIC gameState SHOULD BE APPLIED
          console.log(`[Page.tsx-playerActionCallback] Received direct gameState for player ${playerId} after action ${type}. Applying...`);
          // If the action was a draw, and it was for the current player, update the trigger
          // This is a bit indirect. A more robust way would be if server confirms segment change in response.
          if ((type === 'drawFromDeck' || type === 'drawFromDiscard') && response.gameState.currentPlayerId === playerId) {
            // Check if the segment actually changed to postDrawAction or if it was already that (e.g. error then success)
            // For simplicity, we'll increment if the new state confirms a pending card for the current player, implying a draw just happened.
            const playerSelfState = response.gameState.players[playerId];
            if (playerSelfState?.pendingDrawnCard && response.gameState.currentTurnSegment === 'postDrawAction') {
                setTurnSegmentTrigger(prevKey => prevKey + 1);
                console.log(`[Page.tsx-turnSegmentTrigger] Updated due to ${type} action. New trigger: ${turnSegmentTrigger +1}`);
            }
          }
          setGameState(response.gameState); // Apply the player-specific game state
        } else if (response.success) {
            // Action was successful but didn't return a new game state directly.
            // This is fine if the server is expected to follow up with a general broadcast.
            addLog(`Action ${type} successful. Waiting for broadcast update.`);
        } else {
          // Action failed, message handled by clientCallback above or set as general error.
          setError(response.message || `Action ${type} failed.`);
          addLog(`Action ${type} failed: ${response.message || 'No specific error message.'}`);
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

  // UI Rendering Logic
  // Error Modal (general error, not rejoin specific)
  const errorModal = error && !gameState && !isAttemptingRejoin ? ( // Show general error modal only if not in game and not rejoining
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div 
        className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg relative shadow-xl max-w-md w-full"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
      >
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline ml-2">{error}</span>
        <button 
          onClick={() => setError(null)} 
          className="absolute top-1 right-1 p-1.5 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-200 hover:bg-red-200 dark:hover:bg-red-700/50 rounded-full transition-colors"
          aria-label="Close error"
        >
          <FiX size={18}/> {/* Using react-icons FiX */}
        </button>
      </motion.div>
    </div>
  ) : null;
  
  // Rejoin UI
  if (isAttemptingRejoin && !gameState) { // Show if attempting rejoin AND not yet in game
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">
        <h1 className="text-5xl font-bold mb-8 text-sky-600 dark:text-sky-400">Check!</h1>
        <div className="text-center">
            <p className="text-neutral-600 dark:text-neutral-400 animate-pulse text-lg">{rejoinStatusMessage}</p>
            {rejoinStatusMessage.toLowerCase().includes("failed") && (
                 <button 
                    onClick={handleReturnToLobby} 
                    className="mt-6 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md transition-colors"
                >
                    Return to Lobby
                </button>
            )}
        </div>
      </div>
    );
  }

  // Lobby UI
  if (!gameState || !gameId || !playerId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-sky-600 dark:text-sky-400">Check!</h1>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">The Card Game</p>
          </div>
          <div className="bg-white dark:bg-neutral-800 p-6 sm:p-8 rounded-xl shadow-xl space-y-6">
            <div>
              <label htmlFor="playerName" className="sr-only">Your Name</label>
              <input 
                id="playerName"
                type="text" 
                placeholder="Enter your name (optional)" 
                value={playerName} 
                onChange={(e) => setPlayerName(e.target.value)} 
                className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 placeholder-neutral-500 dark:placeholder-neutral-400 text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm transition-shadow transition-colors duration-150 ease-in-out shadow-sm hover:shadow-md"
              />
            </div>

            <button 
              onClick={handleCreateGame} 
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md hover:shadow-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 dark:focus:ring-offset-neutral-800 transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-90"
            >
              Create New Game
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-neutral-300 dark:border-neutral-600" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500">
                  OR
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="gameIdInput" className="sr-only">Game ID</label>
              <input 
                id="gameIdInput"
                type="text" 
                placeholder="Enter Game ID to Join" 
                value={inputGameId} 
                onChange={(e) => setInputGameId(e.target.value)} 
                className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 placeholder-neutral-500 dark:placeholder-neutral-400 text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-shadow transition-colors duration-150 ease-in-out shadow-sm hover:shadow-md"
              />
            </div>
            <button 
              onClick={handleJoinGame} 
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md hover:shadow-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-neutral-800 transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-90"
            >
              Join Game
            </button>
            
            {error && !isAttemptingRejoin && <p className="text-red-500 dark:text-red-400 text-xs text-center pt-2">Error: {error}</p>}
          </div>
        </div>
        <AnimatePresence>{errorModal}</AnimatePresence>
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
                className="ml-2 p-1 bg-gray-200 dark:bg-neutral-600 hover:bg-gray-300 dark:hover:bg-neutral-500 rounded transition-colors relative transform hover:scale-110 active:scale-95"
              >
                {/* SVG Icon for copy */}
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <AnimatePresence>
                  {copiedGameId && (
                    <motion.span 
                      className="absolute -top-7 -right-1 text-[0.6rem] bg-sky-500 text-white px-1 py-0.5 rounded-sm shadow-md"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      Copied!
                    </motion.span>
                  )}
                </AnimatePresence>
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
            <span className={`transition-transform duration-300 ease-in-out ${showDebugPanel ? 'rotate-180' : ''}`}>
              <FaBug size={16} />
            </span>
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
          onReturnToLobby={handleReturnToLobby}
          turnSegmentTrigger={`${turnSegmentTrigger}-${visibilityTrigger}`} // Combine triggers
        />
      </main>
      <GameLogComponent log={log} />
      <AnimatePresence>{errorModal}</AnimatePresence>
    </div>
  );
}
