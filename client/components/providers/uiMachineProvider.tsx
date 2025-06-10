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

type UIContextType = {
  actorRef: UIMachineActorRef;
};

export const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIMachineProvider = ({
  children,
  gameId,
  localPlayerId,
  initialGameState,
}: {
  children: React.ReactNode;
  gameId: string;
  localPlayerId: string;
  initialGameState?: ClientCheckGameState;
}) => {
  const getPersistedState = () => {
    // If we've been given a fresh initial state, don't try to load a stale one.
    if (initialGameState) {
      return undefined;
    }

    try {
      const persistedStateJSON = sessionStorage.getItem('ui-machine-persisted-state');
      if (persistedStateJSON) {
        const persistedState = JSON.parse(persistedStateJSON);
        // Basic validation: ensure it's for the right game.
        if (persistedState.context.gameId === gameId) {
          // Clear the state so it's only used once for initialization
          sessionStorage.removeItem('ui-machine-persisted-state');
          return persistedState;
        }
      }
    } catch (e) {
      console.error("Failed to read persisted state from sessionStorage", e);
    }
    return undefined;
  };

  const persistedState = getPersistedState();

  const actorRef = useActorRef(uiMachine, {
    snapshot: persistedState,
    input: {
      gameId,
      localPlayerId,
      initialGameState,
    },
  });

  useEffect(() => {
    // If we didn't restore from a persisted state, we need to initialize.
    // This is the flow for a player joining a game, or rejoining after a refresh.
    if (!persistedState) {
      actorRef.send({ type: 'RECONNECT' });
    }
  }, [actorRef, persistedState]);

  useEffect(() => {
    const onGameStateUpdate = (gameState: ClientCheckGameState) => {
      actorRef.send({ type: 'CLIENT_GAME_STATE_UPDATED', gameState });
    };
    const onNewLog = (logMessage: RichGameLogMessage) => {
      actorRef.send({ type: 'NEW_GAME_LOG', logMessage });
    };
    const onCardDetails = (payload: { card: Card; playerId: PlayerId; cardIndex: number }) => {
      actorRef.send({ type: 'ABILITY_PEEK_RESULT', ...payload });
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