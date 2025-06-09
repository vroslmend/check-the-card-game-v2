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
  type ChatMessage,
  type RespondCardDetailsPayload,
  SocketEventName,
} from 'shared-types';

type UIContextType = {
  actorRef: UIMachineActorRef;
};

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIMachineProvider = ({
  children,
  gameId,
  localPlayerId,
}: {
  children: React.ReactNode;
  gameId: string;
  localPlayerId: string;
}) => {
  const actorRef = useActorRef(uiMachine, {
    input: {
      gameId,
      localPlayerId,
    },
  });

  useEffect(() => {
    const onGameStateUpdate = (data: { gameState: ClientCheckGameState }) => {
        actorRef.send({ type: 'CLIENT_GAME_STATE_UPDATED', gameState: data.gameState });
    };
    const onNewLog = (data: { logEntry: RichGameLogMessage }) => {
        actorRef.send({ type: 'NEW_GAME_LOG', logMessage: data.logEntry });
    };
    const onNewChatMessage = (chatMessage: ChatMessage) => {
        actorRef.send({ type: 'NEW_CHAT_MESSAGE', chatMessage });
    };
    const onCardDetails = (payload: RespondCardDetailsPayload) => {
      actorRef.send({ type: 'SERVER_PROVIDED_CARD_FOR_ABILITY', ...payload });
    };
    const onError = (data: { message: string }) => {
        actorRef.send({ type: 'ERROR_RECEIVED', error: data.message });
    };
    const onInitialLogs = (data: { logs: RichGameLogMessage[] }) => {
        actorRef.send({ type: 'INITIAL_LOGS_RECEIVED', logs: data.logs });
    };

    socket.on(SocketEventName.GAME_STATE_UPDATE, onGameStateUpdate);
    socket.on(SocketEventName.SERVER_LOG_ENTRY, onNewLog);
    socket.on(SocketEventName.CHAT_MESSAGE, onNewChatMessage);
    socket.on(SocketEventName.RESPOND_CARD_DETAILS_FOR_ABILITY, onCardDetails);
    socket.on(SocketEventName.ERROR_MESSAGE, onError);
    socket.on(SocketEventName.INITIAL_LOGS, onInitialLogs);


    return () => {
      socket.off(SocketEventName.GAME_STATE_UPDATE, onGameStateUpdate);
      socket.off(SocketEventName.SERVER_LOG_ENTRY, onNewLog);
      socket.off(SocketEventName.CHAT_MESSAGE, onNewChatMessage);
      socket.off(SocketEventName.RESPOND_CARD_DETAILS_FOR_ABILITY, onCardDetails);
      socket.off(SocketEventName.ERROR_MESSAGE, onError);
      socket.off(SocketEventName.INITIAL_LOGS, onInitialLogs);
    };
  }, [actorRef]);

  // Forward socket connection events to the state machine
  useEffect(() => {
    socket.connect(); // Manually connect the socket when the provider mounts
    
    const handleConnect = () => actorRef.send({ type: 'CONNECT' });
    const handleDisconnect = () => actorRef.send({ type: 'DISCONNECT' });

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      handleConnect();
    } else {
      handleDisconnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.disconnect();
    };
  }, [actorRef]);

  // Initializes the machine with top-level context
  useEffect(() => {
    if (localPlayerId && gameId) {
      actorRef.send({
        type: 'INITIALIZE',
        localPlayerId,
        gameId,
      });
    }
  }, [actorRef, gameId, localPlayerId]);

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

export function useUIMachineSelector<T>(
  selector: (state: UIMachineState) => T,
  compare?: (a: T, b: T) => boolean,
): T {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUIMachineSelector must be used within a UIMachineProvider');
  }
  return useSelector(context.actorRef, selector, compare);
}