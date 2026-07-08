import type { Transition } from "framer-motion";

// Shared card-travel choreography ("lift-travel-place"): eases out of the
// origin slowly, travels fast, settles slowly into the destination. Applied
// to the layout transition of every layoutId card element so draws,
// discards, swaps and dealing all move at the same pace. Tune duration/ease
// here — one knob for the whole board.
export const cardTravelTransition: { layout: Transition } = {
  layout: {
    type: "tween",
    duration: 0.65,
    ease: [0.55, 0.06, 0.19, 0.98],
  },
};

export const CARD_LIFT_SCALE = 1.06;
// The lift shadow moved to a theme-tokened CSS transition (.card-lift in
// globals.css, toggled by CardFlight's data-inflight) so it fades smoothly
// and adapts to light/dark, instead of a fixed value Framer popped on/off.
