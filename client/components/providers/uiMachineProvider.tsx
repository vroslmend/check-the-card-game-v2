'use client';

import React, { createContext, useEffect, useContext } from 'react';
import { useActorRef } from '@xstate/react';
import { socket } from '@/lib/socket';
import {
  uiMachine,
  type UIMachineActorRef,
  type UIMachineSnapshot,
} from '@/machines/uiMachine';
import {
  type ClientCheckGameState,
  type RichGameLogMessage,
  SocketEventName,
  type Card,
  type PlayerId,
} from 'shared-types';
import logger from '@/lib/logger';

// These are the events the client is allowed to send to the server.
const clientToServerEvents = [
  SocketEventName.CREATE_GAME,
  SocketEventName.JOIN_GAME,
  SocketEventName.PLAYER_ACTION,
  SocketEventName.ATTEMPT_REJOIN,
  SocketEventName.SEND_CHAT_MESSAGE, // Added this as it's a client->server event
];
type ClientToServerEventName = typeof clientToServerEvents[number];

function isClientToServerEvent(eventName: string): eventName is ClientToServerEventName {
  return (clientToServerEvents as string[]).includes(eventName);
}

type UIContextType = {
  actorRef: UIMachineActorRef;
};

export const UIContext = createContext<UIContextType | undefined>(undefined);

export type { UIMachineSnapshot };

export const UIMachineProvider = ({
  children,
  gameId,
  localPlayerId,
  initialGameState: explicitInitialGameState,
}: {
  children: React.ReactNode;
  gameId?: string;
  localPlayerId?: string | null;
  initialGameState?: ClientCheckGameState;
}) => {
  const getSessionInfo = () => {
    try {
      const persistedPlayerSessionJSON = sessionStorage.getItem('playerSession');
      if (persistedPlayerSessionJSON) {
        const session = JSON.parse(persistedPlayerSessionJSON);
        if (session.gameId === gameId) {
          logger.info({ gameId, playerId: session.playerId, source: 'sessionStorage' }, 'Hydrating player info from session storage.');
          return { playerId: session.playerId };
        }
      }
    } catch (e) {
      logger.error({ error: e }, 'Failed to read persisted session from sessionStorage');
    }
    return { playerId: null };
  };

  const { playerId: sessionPlayerId } = getSessionInfo();

  const actorRef = useActorRef(uiMachine, {
    input: {
      gameId,
      localPlayerId: localPlayerId ?? sessionPlayerId ?? undefined,
      initialGameState: explicitInitialGameState,
    },
  });

  useEffect(() => {
    // This effect runs once on mount to handle one-time hydration from session storage.
    // This is more robust against React StrictMode re-renders than doing it during initialization.
    const persistedGameStateJSON = sessionStorage.getItem('initialGameState');
    
    // If we have game state from props, log it and use it
    if (explicitInitialGameState) {
      logger.info({ gameId, source: 'props' }, 'Using provided initialGameState directly from props');
      // Make sure this state also gets properly hydrated into the machine
      actorRef.send({ type: 'HYDRATE_GAME_STATE', gameState: explicitInitialGameState });
    }
    // Otherwise try to get from session storage
    else if (persistedGameStateJSON) {
      try {
        const gameState = JSON.parse(persistedGameStateJSON);
        logger.info({ gameId, source: 'sessionStorage' }, 'Sending HYDRATE_GAME_STATE event from session storage.');
        actorRef.send({ type: 'HYDRATE_GAME_STATE', gameState });
        // We can remove this now since it's been processed
        sessionStorage.removeItem('initialGameState');
      } catch (e) {
        logger.error({ error: e }, 'Failed to parse persisted game state from sessionStorage');
      }
    }
  }, [actorRef, gameId, explicitInitialGameState]);

  // Monitor socket connection state and sync with state machine
  useEffect(() => {
    const handleConnect = () => {
      logger.info('Socket connected, notifying state machine');
      // Send CONNECT event to state machine when socket connects
      actorRef.send({ type: 'CONNECT' });
    };

    const handleDisconnect = (reason: string) => {
      logger.warn({ reason }, 'Socket disconnected, notifying state machine');
      // Send DISCONNECT event to state machine when socket disconnects
      actorRef.send({ type: 'DISCONNECT' });
    };

    const handleConnectError = (error: Error) => {
      logger.error({ error: error.message }, 'Socket connection error');
      // Send CONNECTION_ERROR event to state machine
      actorRef.send({ type: 'CONNECTION_ERROR', message: error.message });
    };

    // Set up listeners for connection events
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    // If socket is already connected when component mounts, notify state machine
    if (socket.connected) {
      logger.info('Socket already connected on mount, notifying state machine');
      actorRef.send({ type: 'CONNECT' });
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [actorRef]);

  useEffect(() => {
    const onGameStateUpdate = (gameState: ClientCheckGameState) => {
      logger.debug({ gameState }, `Socket IN: ${SocketEventName.GAME_STATE_UPDATE}`);
      actorRef.send({ type: 'CLIENT_GAME_STATE_UPDATED', gameState });
    };
    const onNewLog = (logMessage: RichGameLogMessage) => {
      logger.debug({ logMessage }, `Socket IN: ${SocketEventName.SERVER_LOG_ENTRY}`);
      actorRef.send({ type: 'NEW_GAME_LOG', logMessage });
    };
    const onInitialPeek = (data: { hand: Card[] }) => {
      logger.debug({ hand: data.hand }, `Socket IN: ${SocketEventName.INITIAL_PEEK_INFO}`);
      actorRef.send({ type: 'INITIAL_PEEK_INFO', hand: data.hand });
    };
    const onCardDetails = (payload: { card: Card; playerId: PlayerId; cardIndex: number }) => {
      logger.debug({ payload }, `Socket IN: ${SocketEventName.ABILITY_PEEK_RESULT}`);
      actorRef.send({ type: 'ABILITY_PEEK_RESULT', ...payload });
    };
    const onError = (error: { message: string }) => {
      logger.error({ error }, `Socket IN: ${SocketEventName.ERROR_MESSAGE}`);
      actorRef.send({ type: 'ERROR_RECEIVED', error: error.message });
    };
    const onInitialLogs = (logs: RichGameLogMessage[]) => {
      logger.debug({ logCount: logs.length }, `Socket IN: ${SocketEventName.INITIAL_LOGS}`);
      actorRef.send({ type: 'INITIAL_LOGS_RECEIVED', logs });
    };

    socket.on(SocketEventName.GAME_STATE_UPDATE, onGameStateUpdate);
    socket.on(SocketEventName.SERVER_LOG_ENTRY, onNewLog);
    socket.on(SocketEventName.INITIAL_PEEK_INFO, onInitialPeek);
    socket.on(SocketEventName.ABILITY_PEEK_RESULT, onCardDetails);
    socket.on(SocketEventName.ERROR_MESSAGE, onError);
    socket.on(SocketEventName.INITIAL_LOGS, onInitialLogs);

    return () => {
      socket.off(SocketEventName.GAME_STATE_UPDATE, onGameStateUpdate);
      socket.off(SocketEventName.SERVER_LOG_ENTRY, onNewLog);
      socket.off(SocketEventName.INITIAL_PEEK_INFO, onInitialPeek);
      socket.off(SocketEventName.ABILITY_PEEK_RESULT, onCardDetails);
      socket.off(SocketEventName.ERROR_MESSAGE, onError);
      socket.off(SocketEventName.INITIAL_LOGS, onInitialLogs);
    };
  }, [actorRef]);

  // It subscribes to specific events emitted by the machine and forwards them to the socket.
  // This is the preferred, type-safe way to handle emitted events from an actor.
  useEffect(() => {
    const subscription = actorRef.on('EMIT_TO_SOCKET', (event) => {
      logger.debug({ eventName: event.eventName, payload: event.payload }, `Socket OUT: ${event.eventName}`);

      // Using a switch statement allows TypeScript to correctly narrow the event type
      // and ensure the payload/ack match the specific event being emitted.
      switch (event.eventName) {
        case SocketEventName.CREATE_GAME:
          logger.info({ payload: event.payload }, 'Emitting CREATE_GAME to socket');
          socket.emit(event.eventName, event.payload, event.ack);
          break;
        case SocketEventName.JOIN_GAME:
          logger.info({ payload: event.payload }, 'Emitting JOIN_GAME to socket');
          socket.emit(event.eventName, ...event.payload, event.ack);
          break;
        case SocketEventName.ATTEMPT_REJOIN:
          logger.info({ payload: event.payload }, 'Emitting ATTEMPT_REJOIN to socket');
          socket.emit(event.eventName, event.payload, event.ack);
          break;
        case SocketEventName.PLAYER_ACTION:
          socket.emit(event.eventName, event.payload);
          break;
        case SocketEventName.SEND_CHAT_MESSAGE:
          socket.emit(event.eventName, event.payload);
          break;
        default:
          // This should be unreachable due to the machine's strict typing
          logger.error({ event }, 'Attempted to emit an unhandled event to socket');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [actorRef]);

  return <UIContext.Provider value={{ actorRef }}>{children}</UIContext.Provider>;
};