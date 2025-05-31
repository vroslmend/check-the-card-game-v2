## Game Rules & Mechanics (Authoritative Overview)

This section provides a comprehensive and authoritative overview of the game rules for "Check."

**1. Object of the Game:**
Be the player with the lowest total card value in your hand at the end of the round.

**2. The Deck:**
A standard 52-card deck (no Jokers) is used.

**3. Card Values for Scoring:**
*   **Aces (A):** -1 point
*   **Number Cards (2-10):** Face value (e.g., '2' is 2 points, '10' is 10 points)
*   **Jack (J):** 11 points
*   **Queen (Q):** 12 points
*   **King (K):** 13 points

**4. Setup:**
*   The deck is shuffled.
*   Each player is dealt four cards, placed face-down in a **2x2 grid** in front of them. This is their initial hand.
*   **Initial Peek Phase:** After cards are dealt, each player secretly looks at their **bottom two cards** in their 2x2 grid. They must try to memorize these cards and their positions. These cards remain face-down unless revealed or swapped by game actions.

**5. Card Layout and Hand Expansion:**
*   Players' hands are visualized as a grid, starting as 2x2.
*   If a player gains additional cards (e.g., penalties, though not currently in rules), their hand grid expands. The layout aims to maintain a **maximum row width of 2 cards**.
    *   Example: A 5th card would typically start a new column, making it a 2x2 grid plus one card in a third column (effectively 2x3 for up to 6 cards, then 2x4, etc.).
*   *Implementation Note:* While visually a grid, the server typically manages a player's hand as an ordered array of cards. The array indices correspond to specific, consistent positions within the player's conceptual grid (e.g., 0: top-left, 1: top-right, 2: bottom-left, 3: bottom-right, 4: next available slot in the 2xN grid).

**6. Gameplay - Player Turns:**
Turns proceed in a chosen direction. A player's turn consists of a primary draw action, then the player discards a card, followed by a matching opportunity, and then resolution of any triggered abilities.

*   **A. Primary Draw Action (Mandatory):**
    *   **Draw from the Draw Pile (Face Down):**
        1.  Take the top card from the Draw Pile. This card is known only to the drawing player.
        2.  The player then chooses one of these options for this drawn card:
            *   **Swap & Discard:** Select one card from their hand grid and swap it with the drawn card. The drawn card is placed face-down into the selected grid position. The card originally in that grid position (Card X) is then placed face-up onto the Discard Pile. This discard (Card X) creates a "Matching/Stacking Opportunity" (see section 7).
            *   **Discard Drawn Card:** Immediately place the drawn card (Card X) face-up onto the Discard Pile. This does not affect the player's hand grid. This discard (Card X) creates a "Matching/Stacking Opportunity" (see section 7).
            *   *(Note: If a K, Q, or J is drawn and the player chooses to swap it into their hand, its ability does NOT trigger at this point. It only triggers when later discarded from the hand to the Discard Pile).*\
    *   **Draw from the Discard Pile (Face Up):**
        1.  This is only possible if `G.discardPileIsSealed` is `false` (i.e., the top card is not the second card of a just-completed matched pair).
        2.  Additionally, a player **cannot draw a special ability card (King, Queen, or Jack)** from the discard pile.
        3.  If drawable, take the top card from the Discard Pile.
        4.  The player **must** swap this card with one card from their hand grid. The drawn card is placed face-down into the selected grid position. The card originally in that grid position (Card X) is then placed face-up onto the Discard Pile. This discard (Card X) creates a "Matching/Stacking Opportunity" (see section 7).
        5.  A player cannot draw from the Discard Pile and then immediately discard that same card without swapping.

**7. Matching/Stacking Opportunity (Unified Rule):**
*   Triggered immediately after the current player discards a card (Card X) to the top of the Discard Pile, setting `G.matchingOpportunityInfo`. The game enters the `matchingStage`.
*   **During `matchingStage`:**
    *   Any one player (including the current player) can use the `attemptMatch` move with a card (Card Y) from their hand of the **exact same rank** as Card X.
    *   Any player can choose to `passMatch`.
    *   The stage ends once one player successfully matches, or all players have passed/had a chance.
*   **If a Match Occurs (Card Y is played on Card X via `attemptMatch`):**
    *   The hand of the player who played Card Y is reduced. Card Y is added to `G.discardPile`.
    *   `G.discardPileIsSealed` is set to `true`.
    *   If Card Y (and Card X) are **non-special cards** (e.g., '2's): No abilities trigger.
    *   If Card Y (and Card X) are **special cards** (e.g., Kings): This forms a stack. `PlayerState.pendingSpecialAbility` is set for the matcher (source: `'stack'`) and the original discarder (source: `'stackSecondOfPair'`).
    *   If playing Card Y causes the matcher's hand to become empty, they automatically "Call Check" (`G.playerWhoCalledCheck` is set).
*   **`matchingStage.onEnd` Logic:**
    *   If a match occurred AND special abilities are pending (from a special pair), transition to `abilityResolutionStage`.
    *   If no match occurred AND the original discarded Card X was special, `PlayerState.pendingSpecialAbility` is set for the original discarder (source: `'discard'`), then transition to `abilityResolutionStage`.
    *   Otherwise (no match, non-special discard OR match occurred with non-special cards and no abilities pending), end the stage, returning control to `playPhase` (and usually ending the current player's turn unless an auto-Check occurred).

**8. Special Card Abilities (Kings, Queens, Jacks) & Stack Resolution:**
*   Abilities are processed within the `abilityResolutionStage`.
*   The `resolveSpecialAbility` move is used by the player whose ability is active.
*   **Single Special Card (Not Matched, or original discarder's turn in LIFO):** Their `pendingSpecialAbility` is resolved.
*   **Stacked Special Cards (LIFO Resolution):**
    *   `G.lastResolvedAbilitySource` tracks whose ability (matcher's `'stack'` or original discarder's `'stackSecondOfPair'`) just resolved.
    *   `abilityResolutionStage.onEnd` uses this to determine if the other part of a LIFO pair still needs to resolve. If the matcher's (`'stack'`) ability resolved, it sets up for the original discarder's (`'stackSecondOfPair'`) turn.
*   The `abilityResolutionStage` continues (or re-enters for the second part of LIFO) until all pending abilities are cleared.
*   `resolveSpecialAbility` clears the acting player's `pendingSpecialAbility` and sets `G.lastResolvedAbilitySource`.
*   If a player is `isLocked` when their turn comes in `abilityResolutionStage`, their ability "fizzles" (is cleared without effect, `G.lastResolvedAbilitySource` is still set for LIFO).
*   **Ability Details:**
    *   **King (K - value 13):** Peek at any **two** cards on the table (any player's hand, any position). Then, swap any **one** card with any **other card** (any player, any position).
    *   **Queen (Q - value 12):** Peek at any **one** card on the table. Then, swap any **one** card with any **other card**.
    *   **Jack (J - value 11):** Swap any **one** card with any **other card**. (No peek).

**9. Calling "Check" and Ending the Round:**
*   **A. Player-Initiated "Check" (`callCheck` move):**
    *   On their turn (in `playPhase`), if no other actions are pending, a player may "Call Check."
    *   `G.playerWhoCalledCheck` is set. Player's `isLocked` becomes `true`. Turn ends. Game enters `finalTurnsPhase`.
*   **B. Automatic "Check" (Empty Hand via `attemptMatch`):**
    *   If a player empties their hand by making a match.
    *   `G.playerWhoCalledCheck` is set. Player's `isLocked` becomes `true`.
    *   If abilities are pending from the match, game first transitions to `abilityResolutionStage`. After abilities resolve, it then proceeds to `finalTurnsPhase`. Otherwise, directly to `finalTurnsPhase`.
*   **C. Final Turns Phase (`finalTurnsPhase`):**
    *   `G.finalTurnsTaken` is reset to `0` upon entering.
    *   The player who called/triggered "Check" is effectively skipped.
    *   Every other eligible (not `isLocked`) player gets **exactly one more turn**.
    *   The phase ends when enough final turns have been taken.
    *   Transitions to `scoringPhase`.

**10. Scoring Phase (`scoringPhase`):**
*   All players' hand cards are revealed. Scores are calculated per card values (section 3).
*   Player(s) with the **lowest total score** win(s) the round. (`G.roundWinner` is set).
*   Game ends. (Current implementation is for a single round).
