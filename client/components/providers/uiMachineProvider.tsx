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
  initialGameState,
}: {
  children: React.ReactNode;
  gameId: string;
  localPlayerId: string | null;
  initialGameState?: ClientCheckGameState;
}) => {
  const getSessionInfo = () => {
    try {
      const persistedSessionJSON = sessionStorage.getItem('playerSession');
      if (persistedSessionJSON) {
        const session = JSON.parse(persistedSessionJSON);
        // Basic validation: ensure it's for the right game.
        if (session.gameId === gameId) {
          logger.info({ gameId, playerId: session.playerId, source: 'sessionStorage' }, 'Hydrating UI machine from session storage.');
          return { playerId: session.playerId };
        }
      }
    } catch (e) {
      logger.error({ error: e }, 'Failed to read persisted session from sessionStorage');
    }

    // If no state is found, we'll need to reconnect.
    logger.info({ gameId }, 'No session found. Machine will start fresh.');
    return { playerId: null };
  };

  const { playerId: sessionPlayerId } = getSessionInfo();

  const actorRef = useActorRef(uiMachine, {
    input: {
      gameId,
      // If we have a player ID from the server (first load) or from the session, use it.
      localPlayerId: localPlayerId ?? sessionPlayerId ?? undefined,
      initialGameState: initialGameState,
    },
  });

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
      logger.debug({ event }, `Socket OUT: ${event.eventName}`);

      // Using a switch statement allows TypeScript to correctly narrow the event type
      // and ensure the payload/ack match the specific event being emitted.
      switch (event.eventName) {
        case SocketEventName.CREATE_GAME:
          socket.emit(event.eventName, event.payload, event.ack);
          break;
        case SocketEventName.JOIN_GAME:
          socket.emit(event.eventName, ...event.payload, event.ack);
          break;
        case SocketEventName.ATTEMPT_REJOIN:
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