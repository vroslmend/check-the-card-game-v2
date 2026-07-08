/**
 * Geometry for the selection / indicator ring drawn around a card.
 *
 * Kept in ONE place so the rules-page illustrations and the in-game hand stay
 * in sync — they render the same rings and previously duplicated (and drifted
 * on) these classes.
 *
 * The ring must share the card's EXACT outer box: `inset-0` (no inset) and
 * `rounded-card` (the card's own radius). Tailwind's `ring-*` is an outset
 * box-shadow, so a same-size, same-radius element draws its band right on the
 * card's true outer edge. The old `inset-0.5 rounded-md` sat 2px inside the
 * card with a smaller 6px corner, so the card body (its red fill) peeked out
 * past the ring along the top/bottom edges — worst on the fractional height
 * that `w-* aspect-[5/7]` produces. Matching the box exactly removes both the
 * corner mismatch and the sub-pixel seam.
 *
 * Add the ring width and color (e.g. `ring-[3px] ring-accent`) at the call
 * site; the meaning is carried by a corner badge, never by the hue alone.
 */
export const CARD_RING_GEOMETRY =
  "pointer-events-none absolute inset-0 z-20 rounded-card";
