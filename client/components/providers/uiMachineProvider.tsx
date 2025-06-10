'use client';

import React, { createContext, useEffect, useContext } from 'react';
import { useActorRef, useSelector } from '@xstate/react';
import { socket } from '@/lib/socket';
import {
  uiMachine,
  type UIMachineActorRef,
  type UIMachineState,
} from '@/machines/uiMachine';
import {
  type ClientCheckGameState,
  type RichGameLogMessage,
  SocketEventName,
  type Card,
  type PlayerId,
} from 'shared-types';
import { SnapshotFrom } from 'xstate';

type UIContextType = {
  actorRef: UIMachineActorRef;
};

export const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIMachineProvider = ({
  children,
  gameId,
  localPlayerId,
  initialState,
}: {
  children: React.ReactNode;
  gameId: string;
  localPlayerId: string;
  initialState: SnapshotFrom<typeof uiMachine> | null;
}) => {
  const actorRef = useActorRef(uiMachine, {
    snapshot: initialState ?? undefined,
    input: initialState ? undefined : {
      gameId,
      localPlayerId,
    },
  });

  useEffect(() => {
    const onGameStateUpdate = (gameState: ClientCheckGameState) => {
      actorRef.send({ type: 'CLIENT_GAME_STATE_UPDATED', gameState });
    };
    const onNewLog = (logMessage: RichGameLogMessage) => {
      actorRef.send({ type: 'NEW_GAME_LOG', logMessage });
    };
    const onCardDetails = (payload: { card: Card; playerId: PlayerId; cardIndex: number }) => {
      actorRef.send({ type: 'SERVER_PROVIDED_CARD_FOR_ABILITY', ...payload });
    };
    const onError = (error: { message: string }) => {
      actorRef.send({ type: 'ERROR_RECEIVED', error: error.message });
    };
    const onInitialLogs = (logs: RichGameLogMessage[]) => {
      actorRef.send({ type: 'INITIAL_LOGS_RECEIVED', logs });
    };

    socket.on(SocketEventName.GAME_STATE_UPDATE, onGameStateUpdate);
    socket.on(SocketEventName.SERVER_LOG_ENTRY, onNewLog);
    socket.on(SocketEventName.ABILITY_PEEK_RESULT, onCardDetails);
    socket.on(SocketEventName.ERROR_MESSAGE, onError);
    socket.on(SocketEventName.INITIAL_LOGS, onInitialLogs);


    return () => {
      socket.off(SocketEventName.GAME_STATE_UPDATE, onGameStateUpdate);
      socket.off(SocketEventName.SERVER_LOG_ENTRY, onNewLog);
      socket.off(SocketEventName.ABILITY_PEEK_RESULT, onCardDetails);
      socket.off(SocketEventName.ERROR_MESSAGE, onError);
      socket.off(SocketEventName.INITIAL_LOGS, onInitialLogs);
    };
  }, [actorRef]);

  // It subscribes to specific events emitted by the machine and forwards them to the socket.
  // This is the preferred, type-safe way to handle emitted events from an actor.
  useEffect(() => {
    const subscription = actorRef.on('EMIT_TO_SOCKET', (event) => {
      socket.emit(event.eventName, event.payload);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [actorRef]);

  // Forward socket connection events to the state machine
  useEffect(() => {
    const handleConnect = () => actorRef.send({ type: 'CONNECT' });
    const handleDisconnect = () => actorRef.send({ type: 'DISCONNECT' });

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // If the socket is already connected when we load, immediately tell the machine.
    if (socket.connected) {
      handleConnect();
    } else {
      // If not connected, we might need to manually connect.
      // This can happen if the user navigates directly to the game URL.
      socket.connect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.disconnect();
    };
  }, [actorRef]);

  useEffect(() => {
    actorRef.send({ type: 'RECONNECT' });
  }, [actorRef]);

  // Initializes the machine with top-level context
  useEffect(() => {
    // If the machine was NOT rehydrated from a persisted state,
    // then we need to kick off the rejoin attempt.
    if (!initialState && localPlayerId && gameId) {
      actorRef.send({
        type: 'INITIALIZE',
        localPlayerId,
        gameId,
      });
    }
  }, [actorRef, gameId, localPlayerId, initialState]);

  return <UIContext.Provider value={{ actorRef }}>{children}</UIContext.Provider>;
};

export const useUI = (): [UIMachineState, UIMachineActorRef['send']] => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIMachineProvider');
  }
  const state = useSelector(context.actorRef, (s) => s);
  return [state, context.actorRef.send];
};