"use client";

import { createContext, useContext, useMemo } from "react";
import { useSyncExternalStore } from "react";
import {
  type UIMachineActorRef,
  type UIMachineSnapshot,
} from "@/machines/uiMachine";

export type { UIMachineSnapshot, UIMachineActorRef };

export const GameUIActorContext = createContext<UIMachineActorRef | null>(null);

/**
 * A hook to get the raw actor reference from the context.
 * This is how components will get the `send` function.
 */
export function useUIActorRef() {
  const actorRef = useContext(GameUIActorContext);
  if (!actorRef) {
    throw new Error(
      "useUIActorRef must be used within a GameUIActorContext.Provider",
    );
  }
  return actorRef;
}

/**
 * A hook to subscribe to the actor's state and select a part of it.
 * This is the custom equivalent of the `useSelector` that createActorContext provided.
 */
export function useUISelector<T>(
  selector: (snapshot: UIMachineSnapshot) => T,
  compare?: (a: T, b: T) => boolean,
): T {
  const actorRef = useUIActorRef();

  const state = useSyncExternalStore(
    (onStoreChange) => {
      const subscription = actorRef.subscribe(onStoreChange);
      return () => subscription.unsubscribe();
    },
    () => actorRef.getSnapshot(),
    () => actorRef.getSnapshot(),
  );

  return useMemo(() => selector(state), [state, selector, compare]);
}
