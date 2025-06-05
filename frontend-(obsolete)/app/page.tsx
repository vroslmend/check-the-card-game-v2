'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react'; // Changed from framer-motion
import CheckGameBoard from './components/CheckGameBoard';
import { 
  SocketEventName, // Changed from import type
  PlayerActionType // Changed from import type
} from 'shared-types';
import type { 
  ClientCheckGameState, 
  InitialPlayerSetupData, 
  Card, 
  RichGameLogMessage, 
  ChatMessage
} from 'shared-types';
import GameLogComponent from './components/GameLogComponent';
import ChatComponent from './components/ChatComponent';
import { FiX, FiCopy } from 'react-icons/fi'; // Added import for FiX and FiCopy
import ThemeToggle from './components/ThemeToggle';
import MinimalLayoutTest from './components/MinimalLayoutTest'; // <-- ADD IMPORT

// Define the server URL
const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8000';
const SESSION_STORAGE_KEY_GAME_ID = 'checkGame_gameId';
const SESSION_STORAGE_KEY_PLAYER_ID = 'checkGame_playerId';
const SESSION_STORAGE_KEY_PLAYER_NAME = 'checkGame_playerName';

// Helper function to get player name
const getPlayerName = (pId: string, gs: ClientCheckGameState | null): string => {
  if (!gs || !gs.players || !gs.players[pId]) {
    return `P-${pId.slice(-4)}`; // Fallback if player not found or gameState is null
  }
  return gs.players[pId].name || `P-${pId.slice(-4)}`;
};

// Helper function to format a card for display
const cardToString = (card: Card | null | undefined): string => {
  if (!card || ('isHidden' in card && card.isHidden)) {
    return 'a card'; // Or 'a hidden card'
  }
  const suitSymbols: { [key: string]: string } = { H: '♥', D: '♦', C: '♣', S: '♠' };
  return `${card.rank}${suitSymbols[card.suit] || card.suit}`;
};

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
  const [log, setLog] = useState<RichGameLogMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]); // New state for chat messages
  const [isAttemptingRejoin, setIsAttemptingRejoin] = useState<boolean>(true); // Start true
  const [rejoinStatusMessage, setRejoinStatusMessage] = useState<string>("Attempting to rejoin previous game..."); // More detailed status
  const [copiedGameId, setCopiedGameId] = useState(false);
  const [turnSegmentTrigger, setTurnSegmentTrigger] = useState<number>(0); // For progress bar reset
  const [visibilityTrigger, setVisibilityTrigger] = useState<number>(0); // For tab focus reset

  // Helper to add a log entry
  const addLog = useCallback((logEntry: RichGameLogMessage) => {
    setLog((prev) => {
      const entryWithDefaults: RichGameLogMessage = {
        ...logEntry,
        timestamp: logEntry.timestamp || new Date().toISOString(),
        logId: logEntry.logId || `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      };

      // Prevent adding if a log with the same ID already exists and the ID is not undefined
      if (entryWithDefaults.logId && prev.some(existingLog => existingLog.logId && existingLog.logId === entryWithDefaults.logId)) {
        // console.log(`[Page.tsx-addLog] Duplicate logId skipped: ${entryWithDefaults.logId}`);
        return prev;
      }

      // Log entry already has timestamp and logId from server, or defaults are applied
      const next = [...prev, entryWithDefaults]; 
      return next.length > 100 ? next.slice(-100) : next;
    });
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
    addLog({ message: "Returned to lobby. Game session cleared." });
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
      addLog({ message: `Found previous session: Game ${storedGameId.slice(-4)}, Player ${storedPlayerId.slice(-4)}` });
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
        addLog({ message: `Attempting to rejoin game ${storedGameId.slice(-4)} as player ${storedPlayerId.slice(-4)}...` });
        setRejoinStatusMessage(`Attempting to rejoin game ${storedGameId.slice(-4)}...`);
        socket.emit(SocketEventName.ATTEMPT_REJOIN, { gameId: storedGameId, playerId: storedPlayerId }, 
          (response: { success: boolean; gameState?: ClientCheckGameState; message?: string }) => {
            if (response.success && response.gameState) {
              setGameState(response.gameState);
              setGameId(storedGameId);
              setPlayerId(storedPlayerId);
              setError(null);
              addLog({ message: 'Successfully rejoined game.' });
              setRejoinStatusMessage('Successfully rejoined game!');
              setIsAttemptingRejoin(false); // SUCCESS
            } else {
              addLog({ message: `Rejoin failed: ${response.message || 'Could not rejoin previous game.'}` });
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
      addLog({ message: `Disconnected from server: ${reason}` });
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
      addLog({ message: `Connection error: ${err.message}` });
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
      addLog({ message: `Reconnect attempt #${attemptNumber}` });
      if (isAttemptingRejoin || (gameId && playerId)) { // If initial rejoin or trying to restore active game
         setRejoinStatusMessage(`Connection lost. Reconnect attempt #${attemptNumber}...`);
      }
      rejoinAttemptedOnConnect = false; // Reset for the new connection attempt
    };

    const handleReconnectFailed = () => {
      console.error('Reconnection failed after multiple attempts.');
      addLog({ message: 'Reconnection failed definitively.', type: 'error' });
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
            
            // REMOVED CLIENT-SIDE PHASE CHANGE LOGGING - Rely on server for these logs
            // if (data.gameState.currentPhase !== currentGameState.currentPhase) {
            //   let phaseMessage = `Game phase changed to: ${data.gameState.currentPhase}`;
            //   switch (data.gameState.currentPhase) {
            //     case 'initialPeekPhase': phaseMessage = "Initial Peek phase has begun."; break;
            //     case 'playPhase': phaseMessage = "Play phase has started."; break;
            //     case 'matchingStage': phaseMessage = "Matching stage has begun!"; break;
            //     case 'abilityResolutionPhase': phaseMessage = "Ability resolution in progress."; break;
            //     case 'finalTurnsPhase': phaseMessage = "Final Turns phase has started."; break;
            //     case 'scoringPhase': phaseMessage = "Scoring phase."; break;
            //     case 'gameOver': phaseMessage = "Game Over!"; break;
            //   }
            //   addLog({ message: phaseMessage, type: 'game_event' }); 
            // }

            // Player calling "Check!" and Game Over/Winner are now logged by the server.
            // Turn changes are also now logged by the server.
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
        addLog({ message: `Player ID updated by server to: ${data.gameState.viewingPlayerId.slice(-4)}` });
      }
      // If a gameStateUpdate comes through, it implies successful connection/rejoin.
      if(isAttemptingRejoin) {
        setIsAttemptingRejoin(false);
        setRejoinStatusMessage("Game state updated, session active.");
        addLog({ message: "Game state updated, session active." });
      }
    };

    const handlePlayerJoined = (data: { gameId: string, newPlayerInfo: InitialPlayerSetupData, updatedTurnOrder: string[] }) => {
      // Player joined logs are now handled by serverLogEntry
      // addLog({ message: `Player joined: ${data.newPlayerInfo.name || data.newPlayerInfo.id.slice(-4)}` });
    };
    
    // Custom event from server if rejoin attempt is specifically denied (e.g. game full, not found)
    // This is an alternative to using the callback of `socket.emit('attemptRejoin', ...)`
    const handleRejoinDenied = (data: { message: string }) => {
        addLog({ message: `Rejoin denied: ${data.message}`, type: 'error' });
        setRejoinStatusMessage(`Rejoin denied: ${data.message}`);
        localStorage.removeItem(SESSION_STORAGE_KEY_GAME_ID);
        localStorage.removeItem(SESSION_STORAGE_KEY_PLAYER_ID);
        setGameId(null);
        setPlayerId(null);
        setGameState(null);
        setIsAttemptingRejoin(false);
    };

    // New listener for server-sent log entries
    const handleServerLogEntry = (data: { gameId: string; logEntry: RichGameLogMessage }) => {
      if (data.gameId === gameId || (gameId === null && isAttemptingRejoin)) {
        addLog(data.logEntry);
      }
    };

    // Listener for initial batch of logs on join/rejoin
    const handleInitialLogs = (data: { logs: RichGameLogMessage[] }) => {
      console.log('[Page.tsx] Received initialLogs:', data.logs);
      // Replace current client logs with the initial set from server
      // This ensures the welcome message and recent history are displayed correctly.
      setLog(data.logs.length > 100 ? data.logs.slice(-100) : data.logs);
    };

    // Listener for incoming chat messages
    const handleIncomingChatMessage = (chatMessage: ChatMessage) => {
      setChatMessages((prevMessages) => {
        // Avoid duplicates based on message ID
        if (prevMessages.find(msg => msg.id === chatMessage.id)) {
          return prevMessages;
        }
        const next = [...prevMessages, chatMessage];
        return next.length > 100 ? next.slice(-100) : next; // Keep last 100 messages
      });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('reconnect_attempt', handleReconnectAttempt);
    socket.on('reconnect_failed', handleReconnectFailed);
    socket.on(SocketEventName.GAME_STATE_UPDATE, handleGameStateUpdate);
    socket.on(SocketEventName.PLAYER_JOINED, handlePlayerJoined);
    socket.on(SocketEventName.REJOIN_DENIED, handleRejoinDenied);
    socket.on(SocketEventName.SERVER_LOG_ENTRY, handleServerLogEntry);
    socket.on(SocketEventName.INITIAL_LOGS, handleInitialLogs); 
    socket.on(SocketEventName.CHAT_MESSAGE, handleIncomingChatMessage); // Add listener for chat messages

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect',handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('reconnect_attempt', handleReconnectAttempt);
      socket.off('reconnect_failed', handleReconnectFailed);
      socket.off(SocketEventName.GAME_STATE_UPDATE, handleGameStateUpdate);
      socket.off(SocketEventName.PLAYER_JOINED, handlePlayerJoined);
      socket.off(SocketEventName.REJOIN_DENIED, handleRejoinDenied);
      socket.off(SocketEventName.SERVER_LOG_ENTRY, handleServerLogEntry);
      socket.off(SocketEventName.INITIAL_LOGS, handleInitialLogs); 
      socket.off(SocketEventName.CHAT_MESSAGE, handleIncomingChatMessage); // Clean up chat message listener
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

    socket.emit(SocketEventName.CREATE_GAME, playerSetup, (response: { success: boolean; gameId?: string; playerId?: string; gameState?: ClientCheckGameState; message?: string }) => {
      if (response.success && response.gameId && response.playerId && response.gameState) {
        setGameId(response.gameId);
        setPlayerId(response.playerId);
        setGameState(response.gameState);
        localStorage.setItem(SESSION_STORAGE_KEY_GAME_ID, response.gameId);
        localStorage.setItem(SESSION_STORAGE_KEY_PLAYER_ID, response.playerId);
        localStorage.setItem(SESSION_STORAGE_KEY_PLAYER_NAME, finalPlayerName); // Store the final name
        setError(null);
        // Game creation log now comes from server
        // addLog({ message: `Game ${response.gameId.slice(-4)} created. You are ${finalPlayerName} (Player ${response.playerId.slice(-4)}).` });
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
    setPlayerName(finalPlayerName); // Ensure playerName state is updated before join

    const playerSetup: InitialPlayerSetupData = { id: newPlayerId, name: finalPlayerName };

    setRejoinStatusMessage(""); // Clear rejoin status
    setIsAttemptingRejoin(false); // No longer rejoining

    const sanitizedGameId = inputGameId.trim();
    if (sanitizedGameId.startsWith('http://') || sanitizedGameId.startsWith('https://')) {
        setError("Invalid Game ID format. Please enter only the Game ID (e.g., game_xxxxxx), not a full URL.");
        addLog({ message: "Join attempt with invalid Game ID format (URL detected)." });
        return;
    }
    if (!sanitizedGameId.startsWith('game_')) {
        setError("Invalid Game ID format. Game IDs typically start with 'game_'.");
        addLog({ message: "Join attempt with invalid Game ID format (missing 'game_' prefix)." });
        return;
    }

    socket.emit(SocketEventName.JOIN_GAME, sanitizedGameId, playerSetup, (response: { success: boolean; gameId?: string; playerId?: string; gameState?: ClientCheckGameState; message?: string }) => {
      if (response.success && response.gameId && response.playerId && response.gameState) {
        setGameId(response.gameId);
        setPlayerId(response.playerId);
        setGameState(response.gameState);
        localStorage.setItem(SESSION_STORAGE_KEY_GAME_ID, response.gameId);
        localStorage.setItem(SESSION_STORAGE_KEY_PLAYER_ID, response.playerId);
        localStorage.setItem(SESSION_STORAGE_KEY_PLAYER_NAME, finalPlayerName); // Store the final name
        setError(null);
        // Join game log now comes from server
        // addLog({ message: `Joined Game ${response.gameId.slice(-4)}. You are ${finalPlayerName} (Player ${response.playerId.slice(-4)}).` });
      } else {
        setError(response.message || "Failed to join game.");
      }
    });
  };
  
  // Handler for actions sent from CheckGameBoard
  const sendPlayerAction = (
    type: PlayerActionType, // Changed from string to PlayerActionType
    payload?: any,
    clientCallback?: (message: string, isError: boolean) => void
  ) => {
    if (!socket || !gameId || !playerId) {
      const errorMsg = 'Cannot send action: connection or game details missing.';
      setError(errorMsg);
      if (clientCallback) clientCallback(errorMsg, true);
      return;
    }
    socket.emit(SocketEventName.PLAYER_ACTION, { gameId, playerId, type, payload }, 
        (response: {success: boolean, gameState?: ClientCheckGameState, message?: string}) => {
        // Handle the server's response
        let errorHandledByClientCallback = false;

        if (response.message && clientCallback) {
          clientCallback(response.message, !response.success);
          if (!response.success) errorHandledByClientCallback = true;
        } else if (clientCallback && type === PlayerActionType.PASS_MATCH && response.success) { // Used enum
          // For a successful pass, if server sends no specific message, 
          // let CheckGameBoard provide its default by calling callback with empty string.
          clientCallback("", false);
        } else if (clientCallback && response.success && !response.message) {
          // For other successful actions with no message, indicate success without text
          clientCallback("", false);
        } else if (clientCallback && !response.success && !response.message) {
            // For failed actions with no message, provide a generic error message via clientCallback
            clientCallback(`Action ${type} failed.`, true);
            errorHandledByClientCallback = true;
        }

        // Existing logic for logging or setting global error can remain (or be enhanced)
        if (response.success && response.gameState) {
          // THIS IS WHERE THE PLAYER-SPECIFIC gameState SHOULD BE APPLIED
          console.log(`[Page.tsx-playerActionCallback] Received direct gameState for player ${playerId} after action ${type}. Applying...`);
          // If the action was a draw, and it was for the current player, update the trigger
          // This is a bit indirect. A more robust way would be if server confirms segment change in response.
          if ((type === PlayerActionType.DRAW_FROM_DECK || type === PlayerActionType.DRAW_FROM_DISCARD) && response.gameState.currentPlayerId === playerId) { // Used enums
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
            // Action-specific logs now come from the server via 'serverLogEntry'
            // addLog({ message: `Action ${type} successful. Waiting for broadcast update.` });
        } else {
          // Action failed
          const failMessage = response.message || `Action ${type} failed.`;
          addLog({ message: `Action ${type} failed: ${failMessage}`, type: 'error' });
          if (!errorHandledByClientCallback) { // Only set global error if not handled by specific callback
            setError(failMessage);
          }
        }
    });
  };

  // Function to send a chat message
  const handleSendChatMessage = (messageText: string) => {
    if (!socket || !playerId || !playerName) {
      addLog({ message: 'Cannot send chat message: User details or connection missing.', type: 'error' });
      return;
    }
    const chatMessage: ChatMessage = {
      id: `msg_${socket.id}_${Date.now()}`,
      senderId: playerId,
      senderName: playerName,
      message: messageText,
      timestamp: new Date().toISOString(),
      // type: gameId ? 'room' : 'lobby', // Example: set type based on game context
      // gameId: gameId || undefined,
    };

    // Optimistically add to local state
    setChatMessages((prevMessages) => {
      const next = [...prevMessages, chatMessage];
      return next.length > 100 ? next.slice(-100) : next;
    });

    socket.emit(SocketEventName.SEND_CHAT_MESSAGE, chatMessage, (ack: {success: boolean, messageId?: string, error?: string}) => {
      if (!ack.success) {
        addLog({ message: `Chat message failed to send: ${ack.error || 'Unknown error'}`, type: 'error' });
        // Optionally, remove the optimistically added message or mark it as failed
        setChatMessages(prev => prev.filter(msg => msg.id !== chatMessage.id));
      } else {
        // Server acknowledged. If server sends back the message with its own ID, we might update ours.
        // For now, optimistic update is primary.
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
        addLog({ message: "Error copying Game ID to clipboard.", type: 'error' });
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
        {/* INSERT TEST COMPONENT HERE - START */}
        <MinimalLayoutTest />
        {/* INSERT TEST COMPONENT HERE - END */}
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center relative">
            {/* <div className="absolute right-0 top-2">
              <div className="h-9 flex items-center">
                <ThemeToggle />
              </div>
            </div> */}
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
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 select-none">
      {/* INSERT TEST COMPONENT HERE (Alternative placement for in-game view) - START */}
      {/* <MinimalLayoutTest /> */}
      {/* INSERT TEST COMPONENT HERE - END */}
      
      {/* Main Game Area Container - This now becomes the primary layout container for game + overlays */}
      <div className="relative flex-grow flex flex-col items-center overflow-hidden"> 
        {/* Header */}
        <header className="bg-white dark:bg-neutral-800 dark:border-b dark:border-neutral-700/70 shadow-md py-2.5 sm:py-3 px-2.5 sm:px-4 flex items-center justify-between w-full flex-shrink-0 z-10">
          <div className="flex items-center">
            <h1 
              onClick={handleReturnToLobby}
              className="text-xl sm:text-2xl font-bold text-sky-600 dark:text-sky-400 mr-3 sm:mr-4 cursor-pointer hover:opacity-80 transition-opacity"
            >
              Check!
            </h1>
            {gameId && (
              <div className="flex items-center h-9 border border-gray-300 dark:border-neutral-700/50 p-1.5 sm:p-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/30">
                <span className="text-[0.65rem] sm:text-xs text-gray-500 dark:text-neutral-400 mr-1.5 uppercase">Game:</span>
                <span className="text-xs sm:text-sm font-mono font-semibold tracking-wider text-gray-700 dark:text-neutral-200">{gameId.slice(-6)}</span>
                <button 
                  onClick={handleCopyGameId}
                  title="Copy Game ID"
                  className="ml-2 p-1 bg-neutral-200 dark:bg-neutral-600 hover:bg-neutral-300 dark:hover:bg-neutral-500 rounded-md transition-colors relative transform hover:scale-105 active:scale-95 flex items-center justify-center"
                >
                  <FiCopy size={14} />
                  <AnimatePresence>
                    {copiedGameId && (
                      <motion.span 
                        className="absolute top-full mt-1.5 left-1/2 transform -translate-x-1/2 text-[0.6rem] bg-sky-500 text-white px-1 py-0.5 rounded-sm shadow-md"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
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
            {playerName && (
              <div className="flex items-center h-9 border border-gray-300 dark:border-neutral-700/50 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-700/30">
                <span className="text-[0.65rem] sm:text-xs text-gray-500 dark:text-neutral-400 mr-1.5 uppercase">Player:</span>
                <span 
                  className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-200 hidden sm:inline truncate max-w-[70px] sm:max-w-[120px]"
                  title={playerName}
                >
                  {playerName}
                </span>
              </div>
            )}
            <div className="h-9 flex items-center">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Main Game Area */}
        <main className="flex-grow flex flex-col items-center min-h-0 overflow-auto p-1 sm:p-2 bg-gray-100 dark:bg-neutral-900 w-full">
          <CheckGameBoard 
            gameState={gameState} 
            playerId={playerId} 
            onPlayerAction={sendPlayerAction} 
            gameId={gameId}
            onReturnToLobby={handleReturnToLobby}
            turnSegmentTrigger={`${turnSegmentTrigger}-${visibilityTrigger}`}
          />
        </main>
        
        {/* GameLogComponent is already absolutely positioned within this container */}
        <GameLogComponent log={log} />

        {/* ChatComponent - Positioned absolutely to the bottom-left */}
        {gameState && gameId && playerId && (
          <div className="absolute bottom-2 left-2 z-20">
            <ChatComponent 
              messages={chatMessages} 
              onSendMessage={handleSendChatMessage} 
              currentUserId={playerId}
              // isVisible={true} // Control visibility based on screen size or other logic if needed
            />
          </div>
        )}

      </div> {/* Closing Main Game Area Container */}
      <AnimatePresence>{errorModal}</AnimatePresence>
    </div>
  );
}
