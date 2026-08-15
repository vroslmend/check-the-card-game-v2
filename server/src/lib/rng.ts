import { nanoid } from "nanoid";

/**
 * The random source for anything a replay has to reproduce: the shuffle order
 * and the card ids. Production uses the system source and behaves exactly as
 * it did before this existed. A seeded source makes a whole game reproducible
 * from one number, which is what turns a failing random game into a bug report
 * (#36).
 */
export interface Rng {
  /** Float in [0, 1). The Math.random contract. */
  float(): number;
  /** A unique id for one card. */
  id(): string;
}

export const systemRng: Rng = {
  float: () => Math.random(),
  id: () => nanoid(),
};

/**
 * mulberry32. Small, fast, and far better than good enough for shuffling a
 * deck. Not for anything security related.
 *
 * The returned object is stateful, so one game needs one instance kept for its
 * lifetime. It lives in machine context, which is safe only because no
 * snapshot here is ever persisted or serialised wholesale. If that changes,
 * this has to become a seed plus a cursor that can survive a round trip.
 */
export const createSeededRng = (seed: number): Rng => {
  let state = seed >>> 0;
  let cardCount = 0;

  const float = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return { float, id: () => `c${(cardCount++).toString(36)}` };
};
