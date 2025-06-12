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
  type ChatMessage,
} from 'shared-types';
import logger from '@/lib/logger';
import { InspectionEvent } from 'xstate';

// Create a single inspector instance that can be reused
const inspector =
  process.env.NODE_ENV === 'development' && typeof window !== 'undefined'
    ? {
        inspect: (inspectionEvent: InspectionEvent) => {
          if (inspectionEvent.type === '@xstate.snapshot') {
            if (inspectionEvent.event.type.startsWith('xstate.after')) return;
            const { snapshot, actorRef } = inspectionEvent;
            console.groupCollapsed(`%cSNAPSHOT: %c${(actorRef as any).id}`, 'color: #999; font-weight: lighter;', 'color: #999; font-weight: bold;');
            if ('value' in snapshot && 'context' in snapshot) {
              console.log(snapshot.value);
              console.log(snapshot.context);
            } else {
              console.log(snapshot);
            }
            console.groupEnd();
          } else if (inspectionEvent.type === '@xstate.event') {
            if (inspectionEvent.event.type.startsWith('xstate.after')) return;
            console.groupCollapsed(`%cEVENT: %c${inspectionEvent.event.type} %c(from ${(inspectionEvent.sourceRef as any)?.id ?? 'external'})`, 'color: #999; font-weight: lighter;', 'color: #0AF; font-weight: bold;', 'color: #999; font-weight: lighter;');
            console.log(inspectionEvent.event);
            console.groupEnd();
          }
        },
      }
    : undefined;

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
    inspect: inspector?.inspect,
    input: {
      gameId,
      localPlayerId: localPlayerId ?? sessionPlayerId ?? undefined,
      initialGameState: explicitInitialGameState,
    },
  });

  useEffect(() => {
    const persistedGameStateJSON = sessionStorage.getItem('initialGameState');
    if (explicitInitialGameState) {
      logger.info({ gameId, source: 'props' }, 'Using provided initialGameState directly from props');
      actorRef.send({ type: 'HYDRATE_GAME_STATE', gameState: explicitInitialGameState });
    }
    else if (persistedGameStateJSON) {
      try {
        const gameState = JSON.parse(persistedGameStateJSON);
        logger.info({ gameId, source: 'sessionStorage' }, 'Sending HYDRATE_GAME_STATE event from session storage.');
        actorRef.send({ type: 'HYDRATE_GAME_STATE', gameState });
        sessionStorage.removeItem('initialGameState');
      } catch (e) {
        logger.error({ error: e }, 'Failed to parse persisted game state from sessionStorage');
      }
    }
  }, [actorRef, gameId, explicitInitialGameState]);

  useEffect(() => {
    const handleConnect = () => {
      logger.info('Socket connected, notifying state machine');
      actorRef.send({ type: 'CONNECT' });
    };

    const handleDisconnect = (reason: string) => {
      logger.warn({ reason }, 'Socket disconnected, notifying state machine');
      actorRef.send({ type: 'DISCONNECT' });
    };

    const handleConnectError = (error: Error) => {
      logger.error({ error: error.message }, 'Socket connection error');
      // This event needs to be added to UIMachineEvents to be valid
      actorRef.send({ type: 'CONNECTION_ERROR', message: error.message });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    if (socket.connected) {
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
    const onNewChatMessage = (chatMessage: ChatMessage) => {
      logger.debug({ chatMessage }, `Socket IN: ${SocketEventName.NEW_CHAT_MESSAGE}`);
      actorRef.send({ type: 'NEW_CHAT_MESSAGE', chatMessage });
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
    socket.on(SocketEventName.NEW_CHAT_MESSAGE, onNewChatMessage);
    socket.on(SocketEventName.INITIAL_PEEK_INFO, onInitialPeek);
    socket.on(SocketEventName.ABILITY_PEEK_RESULT, onCardDetails);
    socket.on(SocketEventName.ERROR_MESSAGE, onError);
    socket.on(SocketEventName.INITIAL_LOGS, onInitialLogs);

    return () => {
      socket.off(SocketEventName.GAME_STATE_UPDATE, onGameStateUpdate);
      socket.off(SocketEventName.SERVER_LOG_ENTRY, onNewLog);
      socket.off(SocketEventName.NEW_CHAT_MESSAGE, onNewChatMessage);
      socket.off(SocketEventName.INITIAL_PEEK_INFO, onInitialPeek);
      socket.off(SocketEventName.ABILITY_PEEK_RESULT, onCardDetails);
      socket.off(SocketEventName.ERROR_MESSAGE, onError);
      socket.off(SocketEventName.INITIAL_LOGS, onInitialLogs);
    };
  }, [actorRef]);
  
  useEffect(() => {
    const subscription = actorRef.on('EMIT_TO_SOCKET', (event) => {
      logger.debug({ eventName: event.eventName, payload: event.payload }, `Socket OUT: ${event.eventName}`);

      // FIX: Handle each case explicitly to satisfy TypeScript's strict type checking
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
          logger.error({ event }, 'Attempted to emit an unhandled event to socket');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [actorRef]);

  return <UIContext.Provider value={{ actorRef }}>{children}</UIContext.Provider>;
};