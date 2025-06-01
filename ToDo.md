
---

## UI/UX Modernization & Animation To-Do List

### I. Global Styles & Setup (Verification)

*   **[ ] Font Verification:**
    *   **Goal:** Ensure `Plus_Jakarta_Sans` (from `layout.tsx`) is the primary font being rendered.
    *   **Action:** Inspect the game in a browser. The `font-family: Arial, Helvetica, sans-serif;` in `frontend/app/globals.css` likely overrides `Plus_Jakarta_Sans`. If `Plus_Jakarta_Sans` is desired, this override needs to be removed or adjusted.
    *   **Impact:** Critical for the "modern, sleek" feel.
*   **[ ] Tailwind CSS Setup:**
    *   **Goal:** Confirm Tailwind CSS is processing styles as expected.
    *   **Action:** Verify if the `@import "tailwindcss";` in `frontend/app/globals.css` is the intended setup for this project version. Standard Next.js/Tailwind typically uses `@tailwind base; @tailwind components; @tailwind utilities;`. If issues arise with Tailwind styling, this could be a point to investigate.
*   **[ ] Dark Mode Consistency:**
    *   **Goal:** Ensure all components and text have proper dark mode variants.
    *   **Action:** Review all UI elements in dark mode for readability, contrast, and aesthetic consistency.

### II. Lobby / Initial Screen (`frontend/app/page.tsx`)

*   **[ ] Layout & Typography:**
    *   **Goal:** More engaging and modern lobby layout.
    *   **Action:**
        *   Explore alternative layouts (e.g., two-panel for Create/Join, card-based options).
        *   Refine typography (font sizes, weights) for clear hierarchy.
        *   Increase whitespace for a minimal aesthetic.
*   **[ ] Input Fields (Player Name, Game ID):**
    *   **Goal:** Stylized and interactive input fields.
    *   **Action:**
        *   Implement subtle focus animations (e.g., border/underline animates in, placeholder slides/fades).
        *   Consider adding icons within input fields if appropriate.
*   **[ ] Buttons (Create Game, Join Game):**
    *   **Goal:** Sleek buttons with satisfying feedback.
    *   **Action:**
        *   Enhance existing hover/active animations (e.g., smoother scaling, subtle gradient/shadow changes).
        *   Implement a ripple click effect.
        *   Design and implement a loading state for buttons (e.g., spinner/progress animation) after click.
*   **[ ] "OR" Separator:**
    *   **Goal:** More elegant visual separator.
    *   **Action:** Replace plain text "OR" with a stylized graphical element or a thinner line.
*   **[ ] Background / Theme:**
    *   **Goal:** More visually interesting (but minimal) background.
    *   **Action:** Consider a very subtle, slow-moving gradient or a high-quality, optimized abstract background image for the lobby area.
*   **[ ] Loading State ("Attempting to rejoin"):**
    *   **Goal:** Engaging loading animation.
    *   **Action:** Replace static text with an animated spinner or a theme-appropriate loading graphic. Text could also have a subtle pulse animation.
*   **[ ] Error Display Modal:**
    *   **Goal:** Smoother modal presentation.
    *   **Action:** Animate modal entry/exit more smoothly (e.g., fade in + slide down). Polish "X" button interaction.

### III. In-Game Header (`frontend/app/page.tsx`)

*   **[ ] Game ID Copy Animation:**
    *   **Goal:** Smoother "Copied!" tooltip animation.
    *   **Action:** Refine animation (e.g., fade in/out and slide up). Animate copy icon itself on hover/click.
*   **[ ] Player Name Truncation:**
    *   **Goal:** More graceful truncation.
    *   **Action:** If `truncate` feels abrupt, consider a fade-out ellipsis effect.
*   **[ ] Debug Toggle Animation:**
    *   **Goal:** Small visual flair for debug icon.
    *   **Action:** Add a slight rotation or morphing animation on toggle, ensuring smooth color transition.

### IV. Core Game Board (`frontend/app/components/CheckGameBoard.tsx`)

*   **[ ] Overall Layout & Spacing:**
    *   **Goal:** Improved visual hierarchy and clarity.
    *   **Action:** Review and refine spacing (paddings, margins, gaps) throughout the game board components.
*   **[ ] Phase Banner Animation:**
    *   **Goal:** Dynamic phase change indication.
    *   **Action:** Animate banner entry (slide down/fade) and text changes.
*   **[ ] Turn Indicator Polish:**
    *   **Goal:** Clearer and more visually appealing turn indicator.
    *   **Action:** Enhance prominence or tie more closely to player areas. Smooth transition between active/inactive states.
*   **[ ] "Waiting for..." Messages:**
    *   **Goal:** More dynamic waiting state.
    *   **Action:** Add subtle loading animations (e.g., animated ellipsis, pulsing icon) to "Waiting for opponents/player" messages.
*   **[ ] Animation Orchestration:**
    *   **Goal:** Manage animations for cards moving between areas (e.g., deck to hand, hand to discard).
    *   **Action:** Implement logic in `CheckGameBoard.tsx` to trigger animations when game state dictates card movement. This involves:
        *   Animating cards from `DrawPileComponent` to a staging area or hand.
        *   Animating cards from hand/staging area to `DiscardPileComponent`.

### V. Player Hand (`frontend/app/components/PlayerHandComponent.tsx`)

*   **[ ] Card Reordering Animation:**
    *   **Goal:** Smooth animation when cards are added/removed or hand layout changes.
    *   **Action:** Add the `layout` prop (e.g., `layout="position"`) to the `motion.div` wrapping each card.
*   **[ ] Swap-Out Animation Enhancement:**
    *   **Goal:** More diegetic card exit.
    *   **Action:** Consider adding a positional shift towards the discard pile area to the `swappingOutExit` variant.
*   **[ ] Status Badge Animation:**
    *   **Goal:** Subtle animation for "Locked" / "Called Check" badges.
    *   **Action:** Animate badge appearance (fade in, scale up). "Called Check" icon could "draw" itself.
*   **[ ] `showSwapHighlight` Polish:**
    *   **Goal:** Crisp and clear swap highlight on opponent hands.
    *   **Action:** Ensure the shimmering gradient animation is smooth and well-timed. Consider if it should also apply briefly to the newly received card.

### VI. Individual Cards (`frontend/app/components/CardComponent.tsx`)

*   **[ ] Flip Animation Refinement:**
    *   **Goal:** More dynamic or physically-based card flip.
    *   **Action:** Experiment with `transition={{ type: 'spring', ... }}` for the `rotateY` animation if a bouncier feel is desired.
*   **[ ] Card Face Design (Front & Back):**
    *   **Goal:** Modern, sleek, and minimal card aesthetics.
    *   **Action (Front):**
        *   Use clean, modern sans-serif for ranks.
        *   Refine layout (e.g., dominant central suit, or extremely minimal corner ranks/suits).
        *   Consider a subtle off-white/light gray background or very fine texture.
    *   **Action (Back):**
        *   Design an elegant, abstract logo or minimal pattern.
        *   Alternatively, a clean single-color back with a matte finish.
        *   Consider a very subtle, slow animation on the card back (e.g., shimmer, pulsing logo).
*   **[ ] Hover/Tap Animation Polish:**
    *   **Goal:** Enhanced interactive feedback.
    *   **Action:** Fine-tune spring/tween transitions for `whileHover` and `whileTap` effects for smoothness.
*   **[ ] Selection State Animation:**
    *   **Goal:** More dynamic selection indication.
    *   **Action:** Animate the selection ring/border in. Consider a small, animated checkmark or glowing edge for selected cards.
*   **[ ] "Targeted for Ability" Visuals:**
    *   **Goal:** Clear and animated indication of ability targets.
    *   **Action:** For `isBeingTargetedForPeek`/`isBeingTargetedForSwap`, ensure icons are clear and animate their appearance (e.g., pulse, glow around icon).

### VII. Deck & Discard Piles

*   **`DrawPileComponent.tsx`:**
    *   **[ ] Stack Effect Enhancement:**
        *   **Goal:** More convincing 3D stack.
        *   **Action:** Render a few more dummy card backs with increasing offsets and varied opacity/brightness. Animate stack layers shifting when a card is drawn.
    *   **[ ] Hover/Tap Refinement:**
        *   **Goal:** More dynamic interaction feedback.
        *   **Action:** Add a slight lift (`y` translation) on hover. Top card could have an additional highlight if drawable.
    *   **[ ] Empty State Animation:**
        *   **Goal:** Smooth transition to empty state.
        *   **Action:** Animate the "Empty" state text/placeholder fading in.
*   **`DiscardPileComponent.tsx`:**
    *   **[ ] Stack Effect Enhancement:** (Similar to `DrawPileComponent`)
    *   **[ ] `isSealed` Lock Animation:**
        *   **Goal:** Animated lock icon appearance.
        *   **Action:** Animate the lock icon and its overlay (fade/scale in) using `motion.div` and `AnimatePresence`.
    *   **[ ] Hover/Tap Refinement:** (Similar to `DrawPileComponent`, considering `effectiveCanDraw`)
    *   **[ ] Empty State Animation:** (Similar to `DrawPileComponent`)

### VIII. Action Bar (`frontend/app/components/ActionBarComponent.tsx`)

*   **[ ] Prompt Text Animation:**
    *   **Goal:** Smooth transitions for changing prompts/feedback messages.
    *   **Action:** Wrap prompt text in `motion.div` within `AnimatePresence` to animate old text out and new text in.
*   **[ ] Button Icon Animation (Optional "Eye Candy"):**
    *   **Goal:** More engaging icon buttons.
    *   **Action:** If feasible, icons within buttons could have subtle animations on hover (e.g., rotation, bounce).
*   **[ ] Button Loading State:**
    *   **Goal:** Clear feedback when an action is pending.
    *   **Action:** Design and implement a loading state for buttons (e.g., spinner, pulse) if server actions have noticeable latency.

### IX. End Of Game Modal (`frontend/app/components/EndOfGameModal.tsx`)

*   **[ ] Celebratory Winner Animation:**
    *   **Goal:** More exciting winner reveal.
    *   **Action:**
        *   Animate winner's name (e.g., letters sequence in, shimmer effect).
        *   Animate `🏆` icon (pop in, wiggle).
        *   Consider lightweight confetti/particle animation on winner reveal (respect `prefers-reduced-motion`).
*   **[ ] Staggered List Animation:**
    *   **Goal:** Dynamic presentation of scores, stats, and final hands.
    *   **Action:** Use `motion.li` with a staggered `delay` in `transition` for items in lists to animate in sequentially.
*   **[ ] "Play Again" Button Animation:**
    *   **Goal:** Consistent interactive feedback.
    *   **Action:** Add `whileHover` and `whileTap` effects (scale, color change) using `motion.button`.
*   **[ ] Styled Scrollbar:**
    *   **Goal:** Consistent modern aesthetics.
    *   **Action:** Ensure `overflow-y-auto` on the modal content has a styled scrollbar (thin, auto-hiding).

### X. Game Log (`frontend/app/components/GameLogComponent.tsx`)

*   **[ ] Panel Expand/Collapse Animation:**
    *   **Goal:** Smoother panel transition.
    *   **Action:** Consider using Framer Motion to animate `height` or `max-height` for the panel.
*   **[ ] New Message Animation:**
    *   **Goal:** Dynamic entry of new log messages.
    *   **Action:** Wrap `<li>` in `motion.li` and use `AnimatePresence` with `layout` prop for smooth entry and reordering.
*   **[ ] Auto-Scroll Functionality:**
    *   **Goal:** Keep latest messages in view.
    *   **Action:** Implement auto-scroll when new messages arrive and the log is open and near the bottom.
*   **[ ] Message Type Styling:**
    *   **Goal:** Improved log readability.
    *   **Action:** Use the `type` field in `GameLogMessage` to color-code messages (e.g., errors, system messages).
*   **[ ] Styled Scrollbar:**
    *   **Goal:** Consistent modern aesthetics.
    *   **Action:** Style the scrollbar within the log content area.

---