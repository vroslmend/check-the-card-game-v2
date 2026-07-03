"use client";

import { createContext, useContext } from "react";
import { useSelector } from "@xstate/react";
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
 * Compares selector results one level deep so selectors can return small
 * derived objects without re-rendering on every unrelated snapshot change.
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }
  const keysA = Object.keys(a) as (keyof T)[];
  const keysB = Object.keys(b) as (keyof T)[];
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => Object.is(a[key], b[key]));
}

/**
 * Subscribes to the UI machine and re-renders only when the selected value
 * changes (shallow comparison by default).
 */
export function useUISelector<T>(
  selector: (snapshot: UIMachineSnapshot) => T,
  compare: (a: T, b: T) => boolean = shallowEqual,
): T {
  const actorRef = useUIActorRef();
  return useSelector(actorRef, selector, compare);
}
