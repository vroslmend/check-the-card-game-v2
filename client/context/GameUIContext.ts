'use client';

import { createContext, useContext, useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import { type UIMachineActorRef, type UIMachineSnapshot } from '@/machines/uiMachine';

// Re-export the types so components can use them easily
export type { UIMachineSnapshot, UIMachineActorRef };

// 1. Create a standard React Context to hold our actor reference.
export const GameUIActorContext = createContext<UIMachineActorRef | null>(null);

/**
 * A hook to get the raw actor reference from the context.
 * This is how components will get the `send` function.
 */
export function useUIActorRef() {
  const actorRef = useContext(GameUIActorContext);
  if (!actorRef) {
    throw new Error('useUIActorRef must be used within a GameUIActorContext.Provider');
  }
  return actorRef;
}

/**
 * A hook to subscribe to the actor's state and select a part of it.
 * This is the custom equivalent of the `useSelector` that createActorContext provided.
 */
export function useUISelector<T>(
  selector: (snapshot: UIMachineSnapshot) => T,
  compare?: (a: T, b: T) => boolean
): T {
  const actorRef = useUIActorRef();

  // useSyncExternalStore is the modern React hook for subscribing to external stores like XState.
  const state = useSyncExternalStore(
    (onStoreChange) => {
      const subscription = actorRef.subscribe(onStoreChange);
      return () => subscription.unsubscribe();
    },
    () => actorRef.getSnapshot(), // How to get the state on the client
    () => actorRef.getSnapshot()  // How to get the state on the server (for hydration)
  );

  return useMemo(() => selector(state), [state, selector, compare]);
}