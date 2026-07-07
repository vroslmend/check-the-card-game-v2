// One broadcast can raise several center-table stamps at once — matching
// your LAST card fires CHECK. plus MATCH. (or KING. x2 for a special pair)
// from a single state update, and two players can earn PENALTY. and MATCH.
// inside one matching window. The stamps share one FIFO slot: each claims
// the slot when its trigger fires and shows only when the previous hold and
// exit fade have finished, so announcements read as a sequence instead of
// stacked scrims and overlapping type.
let busyUntil = 0;

/**
 * Claim the stamp slot. Returns the delay (ms) to wait before showing.
 * `notBeforeMs` lets a stamp that must sync to an animation (the match
 * stamp lands with its card) push its earliest start.
 */
export const claimStampSlot = (holdMs: number, notBeforeMs = 0): number => {
  const now = Date.now();
  const start = Math.max(now + notBeforeMs, busyUntil);
  busyUntil = start + holdMs;
  return start - now;
};
