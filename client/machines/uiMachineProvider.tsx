'use client';

import { createActorContext } from '@xstate/react';
import { uiMachine, UIMachineLogic } from './uiMachine'; 
import { useSocketManager } from '@/hooks/useSocketManager'; 
import { useGameStore } from '@/store/gameStore'; 
import { useEffect } from 'react';
import { SocketEventName, ClientCheckGameState, RichGameLogMessage, ChatMessage } from '@shared'; // Ensure all types are imported

// 1. Create the Actor Context
export const UIMachineContext = createActorContext<UIMachineLogic>(
  uiMachine,
  {
    // devTools: process.env.NODE_ENV === 'development', // Enable for XState dev tools visualization
  }
);

// 2. Export hooks directly from the created context
export const useUIMachineRef = UIMachineContext.useActorRef;
export const useUIMachineSelector = UIMachineContext.useSelector;

// 3. Custom Provider Component
export const UIMachineProvider = ({ children }: { children: React.ReactNode }) => {
  const socketManager = useSocketManager();
  const gameStore = useGameStore();
  
  // Get the actor ref from the context. This hook also starts the actor if it hasn't been started.
  const actorRef = UIMachineContext.useActorRef(); 

  // Effect for initializing socket connection and listeners
  useEffect(() => {
    socketManager.connect();

    const unregisterGameState = socketManager.registerListener(
      SocketEventName.GAME_STATE_UPDATE,
      (newState: ClientCheckGameState) => {
        gameStore.setGameState(newState);
        actorRef.send({ type: 'CLIENT_GAME_STATE_UPDATED', gameState: newState });
      }
    );

    const unregisterGameLog = socketManager.registerListener(
      SocketEventName.GAME_LOG_MESSAGE,
      (logMessage: RichGameLogMessage) => {
        gameStore.addLogMessage(logMessage);
        actorRef.send({ type: 'NEW_GAME_LOG', logMessage });
      }
    );

    const unregisterChatMessage = socketManager.registerListener(
      SocketEventName.CHAT_MESSAGE,
      (chatMessage: ChatMessage) => {
        gameStore.addChatMessage(chatMessage);
        actorRef.send({ type: 'NEW_CHAT_MESSAGE', chatMessage });
      }
    );
    
    const unregisterError = socketManager.registerListener(
      SocketEventName.ERROR_MESSAGE,
      (error: { message: string; details?: any }) => {
        console.error("Received error from server:", error);
        // Optionally, send an event to the UI machine to display the error
        actorRef.send({ type: 'ERROR_RECEIVED', error: error.message });
      }
    );

    return () => {
      unregisterGameState();
      unregisterGameLog();
      unregisterChatMessage();
      unregisterError();
      socketManager.disconnect();
    };
  // actorRef should be stable, but gameStore and socketManager might not be if they are not memoized.
  // Adding them to dependencies if they can change.
  }, [socketManager, gameStore, actorRef]);

  // Effect for sending events from XState machine to Socket.IO
  useEffect(() => {
    // The `on` method returns a subscription object.
    const subscription = actorRef.on('EMIT_TO_SOCKET', (emittedEvent) => {
      // The emittedEvent is the object defined in uiMachine's setup.types.emitted
      // It should be of shape: { type: 'EMIT_TO_SOCKET', eventName: string, payload: any }
      // We directly access eventName and payload from the emittedEvent.
      socketManager.emitEvent(emittedEvent.eventName, emittedEvent.payload);
    });

    return () => {
      // Call unsubscribe on the subscription object for cleanup.
      subscription.unsubscribe();
    };
  }, [actorRef, socketManager]);

  // The UIMachineContext.Provider component is used to provide the actor instance to the component tree.
  // It does not take a `machine` prop if createActorContext was already given the machine logic.
  return <UIMachineContext.Provider>{children}</UIMachineContext.Provider>;
};

/*
// 4. (Optional) Composed hook to easily get state and send function for the UI machine
// We can re-introduce this once the core provider and basic hooks are confirmed to work.
export const useUIMachine = () => {
  const actorRef = useUIMachineRef(); // Get the actor reference
  const state = useUIMachineSelector(actorRef, (snapshot) => snapshot); // Get the full snapshot
  return {
    state,
    send: actorRef.send,
    actorRef,
  };
};

// 5. (Optional) More specific composed hook if you only need the actor (state and send)
// This is similar to the old useActor behavior for a specific actor ref.
export const useUIMachineActor = () => {
  const actorRef = useUIMachineRef();
  const snapshot = useUIMachineSelector(actorRef, s => s);
  return [snapshot, actorRef.send, actorRef] as const; // [snapshot, send, actorRef]
};
*/ 