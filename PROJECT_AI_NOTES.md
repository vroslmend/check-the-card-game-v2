# Project AI Notes: "Check" - Online Multiplayer Card Game

## Current Status: What is Done & What is Left

### ✅ What is DONE
- Project structure: `frontend/`, `server/`, `shared-types/`
- TypeScript project references and runtime type sharing (with module-alias)
- Server starts successfully, reliably loading `shared-types` modules at runtime after resolving CommonJS/ESM and path alias issues.
- **Shared types (`shared-types/`) significantly refactored:**
  - Core types for cards, player state, and game state updated for new "Unified Matching/Stacking Opportunity" rule.
  - Removed fields related to old "Quick Action" (e.g., `quickActionWindow`, `quickActionPenalty`) and old "Special Ability Stacking" (e.g., `specialAbilityStack`, `stackActive`).
  - Added `discardPileIsSealed: boolean` to `CheckGameState` (marks discard undrawable after a match).
  - Added `matchingOpportunityInfo?: { cardToMatch: Card; originalPlayerID: string; } | null` to `CheckGameState` (manages immediate matching chance).
  - Added `lastResolvedAbilitySource` to `CheckGameState` (tracks ability source for LIFO).
  - `PlayerState.pendingSpecialAbility.source` expanded to include `'stackSecondOfPair'` for LIFO ability tracking.
  - Existing fields for `hasCalledCheck`, `isLocked`, `score`, `playerWhoCalledCheck`, `roundWinner`, and `finalTurnsTaken` remain relevant.
- **Server-side game logic (`server/src/index.ts`) significantly refactored using `boardgame.io` for "Unified Matching/Stacking Opportunity":**
  - Game setup: Deck creation, shuffling, dealing 4 cards to each player, initialization of all game and player state fields including new ones.
  - Initial Peek Phase: `performPeek` move.
  - **Main Play Phase Core Mechanics Updated:**
    - Drawing cards from deck or discard pile (discard pile draw respects `G.discardPileIsSealed`).
    - Discarding cards (`swapAndDiscard`, `discardDrawnCard`) now triggers a `matchingStage` by setting `G.matchingOpportunityInfo`.
    - **Unified Matching/Stacking Opportunity Implemented:**
      - New `matchingStage` allows any one player to play a card of the exact same rank (`attemptMatch` move) or pass (`passMatch` move).
      - Successful match (`attemptMatch`):
        - Player's hand reduced, card added to discard pile.
        - `G.discardPileIsSealed` set to `true`.
        - Automatic "Call Check" if matcher's hand becomes empty.
        - If matched pair is special (e.g., two Kings), `pendingSpecialAbility` is set for both players (matcher `source: 'stack'`, original discarder `source: 'stackSecondOfPair'`) to facilitate LIFO.
      - `matchingStage.onEnd` logic:
        - If a match occurred, transitions to `abilityResolutionStage` if abilities are pending.
        - If no match, and original discard was special, sets `pendingSpecialAbility` for original discarder and transitions to `abilityResolutionStage`.
        - Otherwise, ends stage, returning control to `playPhase`.
    - **Special Card Abilities (K, Q, J) & LIFO Resolution:**
      - `abilityResolutionStage` implemented to manage ability execution.
      - `resolveSpecialAbility` move now called from this stage, uses `events.endStage()`.
      - `abilityResolutionStage.onEnd` uses `G.lastResolvedAbilitySource` (set by `resolveSpecialAbility`) to handle LIFO: if matcher's ability (source: `'stack'`) just resolved, it transitions to original discarder's ability (source: `'stackSecondOfPair'`).
  - **"Calling Check" and End-of-Round Sequence:**
    - `callCheck` move allows a player to call "Check" on their turn.
    - Automatic "Check" if a player empties their hand via `attemptMatch`.
    - Both methods initiate `finalTurnsPhase` and reset `G.finalTurnsTaken = 0`.
    - `finalTurnsPhase` logic remains (gives other eligible players one final turn).
  - **Scoring Phase:** Logic remains (calculates scores, determines winner, ends game).
- Documentation: PROJECT_AI_NOTES.md rules section is authoritative. This "What is DONE" section is being updated.

### ⏳ What is LEFT
- **Frontend Implementation:**
  - Install `boardgame.io` client library in `frontend/`.
  - Create React components for game display (board, cards, player hands, discard pile, game messages).
  - Implement client-side logic to connect to the `boardgame.io` server.
  - Handle user input for game actions (drawing, selecting cards for swap/discard, peek/swap targets for abilities, matching attempts).
  - Display game state updates received from the server, including UI for `matchingStage` and `abilityResolutionStage`.
- **Server-Side Refinements & Testing:**
  - Thorough playtesting of the new "Unified Matching/Stacking" and ability resolution flow.
  - Ensure robust turn management after `matchingStage` and `abilityResolutionStage` conclude (e.g., original player's turn correctly ends or continues).
  - Consider edge cases for LIFO ability resolution (e.g., player involved in LIFO calls Check).
- CORS configuration for server (for frontend connection).
- (Optional) User authentication, lobbies, persistent leaderboards.

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
*   If a player gains additional cards (e.g., penalties), their hand grid expands. The layout aims to maintain a **maximum row width of 2 cards**.
    *   Example: A 5th card would typically start a new column, making it a 2x2 grid plus one card in a third column (effectively 2x3 for up to 6 cards, then 2x4, etc.).
*   *Implementation Note:* While visually a grid, the server typically manages a player's hand as an ordered array of cards. The array indices correspond to specific, consistent positions within the player's conceptual grid (e.g., 0: top-left, 1: top-right, 2: bottom-left, 3: bottom-right, 4: next available slot in the 2xN grid).

**6. Gameplay - Player Turns:**
Turns proceed in a chosen direction. A player's turn consists of a primary draw action, followed by an optional matching opportunity, and then resolution of any triggered abilities.

*   **A. Primary Draw Action (Mandatory):**
    *   **Draw from the Draw Pile (Face Down):**
        1.  Take the top card from the Draw Pile. This card is known only to the drawing player.
        2.  The player then chooses one of these options for this drawn card:
            *   **Swap & Discard:** Select one card from their hand grid and swap it with the drawn card. The drawn card is placed face-down into the selected grid position. The card originally in that grid position (Card X) is then placed face-up onto the Discard Pile. This discard (Card X) creates a "Matching/Stacking Opportunity" (see section 7).
            *   **Discard Drawn Card:** Immediately place the drawn card (Card X) face-up onto the Discard Pile. This does not affect the player's hand grid. This discard (Card X) creates a "Matching/Stacking Opportunity" (see section 7).
            *   *(Note: If a K, Q, or J is drawn and the player chooses to swap it into their hand, its ability does NOT trigger at this point. It only triggers when later discarded from the hand to the Discard Pile).*
    *   **Draw from the Discard Pile (Face Up):**
        1.  This is only possible if the top card of the Discard Pile is **not** the second card of a just-completed ("sealed") matched pair. If the top card is part of a sealed pair, the Discard Pile is effectively unusable for drawing.
        2.  If drawable, take the top card from the Discard Pile.
        3.  The player **must** swap this card with one card from their hand grid. The drawn card is placed face-down into the selected grid position. The card originally in that grid position (Card X) is then placed face-up onto the Discard Pile. This discard (Card X) creates a "Matching/Stacking Opportunity" (see section 7).
        4.  A player cannot draw from the Discard Pile and then immediately discard that same card without swapping.

**7. Matching/Stacking Opportunity (Unified Rule):**
*   Immediately after the current player discards a card (Card X) to the top of the Discard Pile as part of their primary action:
    *   An opportunity arises for **any one player** (including the current player themselves) to play a card (Card Y) of the **exact same rank** from their hand directly on top of Card X.
    *   This is the **only** such match allowed in this immediate sequence. Once Card Y is played (or if no one makes a match quickly), this specific opportunity ends. No further cards can be played on top of Card Y in this same immediate sequence.
*   **If a Match Occurs (Card Y is played on Card X):**
    *   The hand of the player who played Card Y is reduced.
    *   If Card Y (and by extension Card X) are **non-special cards** (e.g., '2's): No abilities trigger. The pair (X, Y) is formed.
    *   If Card Y (and Card X) are **special cards** (e.g., Kings): This forms a stack of two special cards (Card X, with Card Y on top). Their abilities will be resolved (see section 8).
    *   **"Sealed Pair" for Drawing:** The pair (X, Y) is now considered "sealed." Card Y (the new top of the discard pile) cannot be drawn. Effectively, the discard pile is unusable for drawing until a new, single, unmatched card is later discarded on top of this pair.
    *   If playing Card Y causes a player's hand to become empty, they "Call Check" (see section 9).
*   **If No Match Occurs:** Card X simply remains on top of the discard pile. If Card X was a special card, its ability triggers (see section 8).

**8. Special Card Abilities (Kings, Queens, Jacks) & Stack Resolution:**
*   Abilities activate when a K, Q, or J is the final card on the Discard Pile after the Matching/Stacking Opportunity (section 7) has concluded (either a single special card was discarded and not matched, or a pair of special cards was formed).
*   **Single Special Card (Not Matched):** Its ability triggers and is resolved by its owner.
*   **Stacked Special Cards (Pair of K, Q, or J of same rank):**
    *   A stack of two cards: the initial discard (Card X) and the matching card played on top (Card Y).
    *   Abilities are resolved LIFO: Card Y's ability (played by its owner) is resolved first. Then, Card X's ability (played by its owner) is resolved.
*   The current player's turn does not end until all triggered abilities (from a single card or a stack) are resolved.
*   **Ability Details:**
    *   **King (K - value 13):** Peek at any **two** cards on the table (any player's hand, any position). Then, swap any **one** card with any **other card** (any player, any position).
    *   **Queen (Q - value 12):** Peek at any **one** card on the table. Then, swap any **one** card with any **other card**.
    *   **Jack (J - value 11):** Swap any **one** card with any **other card**. (No peek).

**9. Calling "Check" and Ending the Round:**
*   **A. Player-Initiated "Check":**
    *   On their turn, if no other actions are pending, a player may "Call Check."
    *   Their hand is "locked" (no more changes). Their turn ends. The game enters `finalTurnsPhase`.
*   **B. Automatic "Check" (Empty Hand):**
    *   If a player empties their hand (e.g., by making a match in section 7), they automatically "Call Check."
    *   Their hand is locked. The game enters `finalTurnsPhase`.
*   **C. Final Turns Phase:**
    *   The player who called/triggered "Check" is skipped.
    *   Every other eligible player gets **exactly one more turn**. (Locked players are skipped).
    *   The server tracks `G.finalTurnsTaken`. The phase ends when `G.finalTurnsTaken >= ctx.numPlayers - 1`.
    *   Transitions to `scoringPhase`.

**10. Scoring Phase:**
*   All players' hand cards are revealed. Scores are calculated per card values (section 3).
*   Player(s) with the **lowest total score** win(s) the round. (Ties possible).
*   Game ends. (Current implementation is for a single round).

## 1. Project Overview

**Goal:** Develop a web-based, free-to-play online multiplayer card game called "Check."

**Core Objective of "Check":** Be the player with the lowest total card value at the end of the round.

**Key Game Mechanics:**
*   Standard 52-card deck.
*   Specific card values for scoring (Ace: -1, 2-10: face value, J: 11, Q: 12, K: 13).
*   4 cards per player, initially face-down, arranged in a **2x2 grid**.
*   **Initial Peek:** One-time look at their **bottom two cards**.
*   **Turn:** Draw (from Draw Pile or Discard Pile), then Discard.
    *   Discarding a card (Card X) creates an immediate **Matching Opportunity**.
*   **Matching Opportunity (Unified Rule):**
    *   Any one player (including current) can play a card (Card Y) of the exact same rank on Card X.
    *   If matched, Card Y forms a "sealed pair" with Card X. The discard pile becomes undrawable (top card is Y).
    *   If Card X & Y are non-special: No abilities.
    *   If Card X & Y are special (e.g., Kings): Abilities resolve LIFO (Y's then X's).
    *   If no match: Card X's ability (if special) triggers for the discarder.
    *   Emptying hand via a match results in an automatic "Call Check."
*   **Special Abilities (K, Q, J):** Details in "Game Rules & Mechanics (Authoritative Overview)".
    *   **King (K):** Peek 2, Swap 1 with 1.
    *   **Queen (Q):** Peek 1, Swap 1 with 1.
    *   **Jack (J):** Swap 1 with 1.
*   **Calling "Check":** Player-initiated or automatic (empty hand via match). Locks hand, triggers final turns for others.

## 2. Technology Stack & Architecture

### 2.1. Project Structure (Revised)

*   **Root Directory:** `check-the-game-v2/`
*   **Structure:** Separate project folders directly under the root:
    *   `frontend/`: Next.js application for the game's frontend.
    *   `server/`: Node.js application for the game server backend.
    *   `shared-types/`: Shared TypeScript types/interfaces between frontend and server.
*   **Package Manager:** `npm` (assumed for individual projects, to be confirmed if different).

### 2.2. Frontend (`frontend/`)

*   **Framework:** Next.js (already initialized by user)
*   **Language:** TypeScript
*   **UI:** React
*   **Key Responsibilities:**
    *   Rendering game UI (board, cards, player hands, etc.).
    *   Handling user input.
    *   Client-side WebSocket communication with the game server.
    *   Managing local game state representation.

### 2.3. Backend (`server/`)

*   **Language:** TypeScript
*   **Environment:** Node.js
*   **Real-time Framework Recommendation:**
    *   **Primary:** `boardgame.io` (strongly recommended for its features tailored to turn-based games).
    *   **Alternative:** Custom Node.js + Express.js/NestJS + Socket.IO.
*   **Key Responsibilities:**
    *   Server-authoritative game logic and rule enforcement.
    *   Managing game rooms/lobbies.
    *   Real-time state synchronization with clients via WebSockets.
    *   Handling hidden information (player-specific views).
    *   Managing the 'Unified Matching/Stacking Opportunity', special abilities, and complex turn flow via `boardgame.io` stages.

### 2.4. Shared Code (`shared-types/`)

*   **Purpose:** Contains TypeScript type definitions (interfaces, enums) shared between `frontend/` and `server/`.
    *   Example: `Card` interface, `GameState` type.
*   **Build:** Will compile to a `dist/` directory with declaration files (`.d.ts`) within `shared-types/`, to be referenced by `frontend/` and `server/`.

### 2.5. Database

*   **Recommendation:** Firebase (Firestore/Realtime Database) or PostgreSQL (e.g., via Supabase).
*   **Usage:** Primarily for user accounts, leaderboards. Ephemeral game state can be in-memory on the server for active games.
*   **Current Status:** Not yet implemented. Decision pending based on specific needs as development progresses.

## 3. Current Project Status & Key Decisions

*   **Project Structure:** Transitioned from npm workspaces to separate project folders: `frontend/`, `server/`, `shared-types/`.
*   **Next.js Frontend:** `frontend/` directory created and Next.js initialized. `boardgame.io` client library **not yet installed**. No game-specific client components or `boardgame.io` client setup implemented yet.
*   **Server Backend:** `server/` directory created. Setup complete and server runs successfully.
*   **Shared Types Package:** `shared-types/` directory created. Types are comprehensive and compiled to CommonJS.
*   **Build System:** `next build` for `frontend/`. `npm run build` (using `tsc`) for `server/` and `shared-types/`.
*   **Real-time Framework Choice:** `boardgame.io` chosen and successfully set up in `server/`.
    *   Game state (`CheckGameState`), player state (`PlayerState`), `setup`, moves, and phases (`initialPeekPhase`, `playPhase`, `matchingStage`, `abilityResolutionStage`, `finalTurnsPhase`, `scoringPhase`) are established.
    *   **Major Refactor (July 2024):** Server logic and shared types overhauled to implement the "Unified Matching/Stacking Opportunity" rule, replacing previous "Quick Action" and separate "Special Ability Stacking" mechanics. This involved significant changes to discard flow, introduction of `matchingStage` and `abilityResolutionStage`, "sealed pair" discard pile logic, and LIFO ability resolution for matched special pairs.
    *   Runtime module loading of `shared-types` is stable.
*   **TypeScript Project References:** Configured.

**Codebase Review Summary (as of 2024-07-30 - PRE-REFACTOR - Needs Update if a new review is done):**
*   `shared-types/src/index.ts`: Contains comprehensive type definitions. (NOW REFACTORED)
*   `server/src/index.ts`:
    *   Successfully implements a significant portion of the game logic using `boardgame.io`. (NOW REFACTORED for new matching/stacking rules)
    *   **Key implemented features** (as detailed in "What is DONE" section, including "Calling Check" flow with `finalTurnsPhase` and `finalTurnsTaken` counter, and `scoringPhase`). (NOW INCLUDES NEW MATCHING/STACKING LOGIC)
    *   **Minor observations/TODOs from code review** (still apply, can be addressed later):
        *   Presence of duplicate local `CheckGameState` and `PlayerState` interfaces (RESOLVED - now imports from shared-types).
        *   An older, likely unused `drawCard` move (Still present, low priority).
        *   The `endIf` condition for `initialPeekPhase`.
*   `frontend/`:
    *   Basic Next.js project structure.
    *   The `boardgame.io` client library has **not** been installed.
    *   No client-side components for game rendering or interaction with the `boardgame.io` server have been created yet.

## 4. Challenges & Solutions Discussed

*   **Hidden Information:** Server holds all truth; client receives tailored state. `boardgame.io` `playerView` is a good fit.
*   **Multi-Step Abilities (K, Q, J):** Mini state machines or phases within a turn. `boardgame.io` stages are suitable. (Note: This phrasing is now more aligned with the new ability resolution stage).
*   **Cost-Effectiveness:** Focus on free/low-cost tiers for hosting (Vercel/Netlify for frontend, Render/Fly.io for backend, Firebase/Supabase for DB).
*   **Build Issues:** (Details about past build issues, mostly resolved)
*   **Server-Side Logic Complexity:** The "Unified Matching/Stacking Opportunity" with LIFO special abilities and stage-based resolution introduces significant complexity, managed via `boardgame.io` stages (`matchingStage`, `abilityResolutionStage`) and careful state tracking in `CheckGameState` and `PlayerState`.

## 5. Next Immediate Steps (as of last interaction)

With the server-side game logic largely refactored for the new "Unified Matching/Stacking Opportunity" rule, the project can proceed with frontend development or further server-side testing.

1.  ~~Initialize `shared-types/` as a TypeScript project.~~ (DONE)
2.  ~~Initialize `server/` as a Node.js/TypeScript project.~~ (DONE)
3.  ~~Configure TypeScript project references so `frontend/` and `server/` can consume types from `shared-types/`.~~ (DONE)
4.  ~~Define initial types (`Suit`, `Rank`, `Card`, `PlayerState`, `CheckGameState`) in `shared-types/` .~~ (DONE)
5.  ~~Set up `boardgame.io` in `server/` (basic game object, server instance, player setup, initial phase structure). This includes successful server startup and module loading.~~ (DONE - Confirmed Stable)
6.  ~~Implement the `performPeek` move in `server/src/index.ts` and integrate into `initialPeekPhase`.~~ (DONE)
7.  ~~**Implement "Calling Check" and End-of-Round Mechanics (`server/src/index.ts` & `shared-types/`):**~~ (DONE, integrated with new match rules)
8.  ~~**Implement Scoring Logic (`server/src/index.ts` & `shared-types/`):**~~ (DONE)
9.  ~~**Expand `shared-types/` as needed** for the above features (e.g., new phase identifiers, score fields, round status).~~ (DONE)
10. **Implement "Unified Matching/Stacking Opportunity" rule (`server/src/index.ts` & `shared-types/`):** (DONE - Major Refactor Completed)
    *   Refactor `shared-types` for new rule (remove old fields, add `discardPileIsSealed`, `matchingOpportunityInfo`, `lastResolvedAbilitySource`).
    *   Refactor server discard logic to use `matchingStage`.
    *   Implement `attemptMatch` and `passMatch` moves.
    *   Implement `matchingStage` logic (transitions to `abilityResolutionStage` or ends).
    *   Implement `abilityResolutionStage` for LIFO and single special abilities.
    *   Update `resolveSpecialAbility` move to use `events.endStage()`.
11. **Primary Focus:** Frontend Development:
    *   Install `boardgame.io` client library in `frontend/`.
    *   Create a basic game client component.
    *   Connect to the `boardgame.io` server.
    *   Display basic game state.
    *   Implement UI for all game actions, including the new matching opportunity and ability resolution.
12. **Server-Side Testing & Refinement:**
    *   Thoroughly test the new matching/stacking and ability resolution logic.
    *   Verify turn management after stages conclude.

## 6. AI Assistant Instructions

*   Refer to this document for context on project history, architecture, and decisions.
*   Help maintain this document by suggesting updates as new features are added or decisions change.
*   When providing code or making changes, consider the revised project structure (separate folders) and chosen technologies.
*   Prioritize `boardgame.io` for backend solutions unless otherwise specified by the user.
*   Ensure TypeScript best practices and type safety.
*   Be mindful of the cost-effective development goal.

## 7. Shared Types Integration (Runtime) - Lessons Learned

**Initial Problems & Errors Encountered:**

During server startup, two main issues arose related to integrating the `shared-types` package:

1.  **`SyntaxError: Unexpected token 'export'`:**
    *   **Cause:** The `shared-types` package was compiling to ES Modules (ESM) by default (or due to `tsconfig.json` settings like `"module": "ESNext"`), while the `server` (Node.js environment) was expecting CommonJS modules.
    *   **Solution:** Modified `shared-types/tsconfig.json` to set `"module": "CommonJS"` and rebuilt `shared-types`.

2.  **`Error: Cannot find module 'shared-types'` (or similar `MODULE_NOT_FOUND` for `shared-types/dist/index.js`):**
    *   **Cause:** Even with TypeScript path aliases working at compile-time, Node.js at runtime could not resolve the `shared-types` module path. Initial attempts with `module-alias` were incorrect due to misconfigured paths in `server/package.json` (`_moduleAliases`) or incorrect `path.resolve` in the `module-alias` setup code.
    *   **Solution:**
        *   Removed the `_moduleAliases` configuration from `server/package.json` to avoid conflicts and simplify setup.
        *   Correctly configured `module-alias` programmatically at the very beginning of `server/src/index.ts`:
          ```ts
          import moduleAlias from 'module-alias';
          import path from 'path';

          // Path from server/dist/index.js to shared-types/dist/index.js
          const sharedTypesPath = path.resolve(__dirname, '../../shared-types/dist/index.js');
          moduleAlias.addAlias('shared-types', sharedTypesPath);

          // Ensure this is done BEFORE other imports that rely on the alias
          ```

**Key Configuration for Successful Runtime Module Loading:**

*   **`shared-types/tsconfig.json`:**
    ```json
    {
      "compilerOptions": {
        "module": "CommonJS", // Crucial for server-side Node.js compatibility
        // ... other options
      }
    }
    ```
*   **`server/src/index.ts` (at the top):**
    ```ts
    import moduleAlias from 'module-alias';
    import path from 'path';
    const sharedTypesPath = path.resolve(__dirname, '../../shared-types/dist/index.js');
    moduleAlias.addAlias('shared-types', sharedTypesPath);

    // Subsequent imports can now use 'shared-types'
    // import { MyType } from 'shared-types';
    ```
*   **Build Process:** Always run `npm run build` in `shared-types` (after `tsconfig.json` changes) and then `npm run build` in `server` to ensure compiled outputs are up-to-date.
*   **`server/package.json`:** Ensure no conflicting `_moduleAliases` section.

**Outcome:** With these changes, the server now successfully starts and can import modules from `shared-types` at runtime.

**Troubleshooting (Summary):**
- If you see `Cannot find module ...shared-types/dist/index.js`, double-check the alias path. From `server/dist`, the correct relative path is `../../shared-types/dist/index.js`.
- If you see `SyntaxError: Unexpected token 'export'`, your `shared-types` is being compiled as an ES module. Change to CommonJS and rebuild.
- Always run `npm run build` in both `shared-types` and `server` after making changes.

## 8. Main Play Phase: Draw/Swap/Discard Logic (Pre-Unified Rule Refactor)

(This section describes an older implementation before the "Unified Matching/Stacking Opportunity" refactor. Kept for historical context.)

**Turn Sequence:**
1. On their turn, a player chooses to draw from either:
   - The main deck (face down, unknown card)
   - The top of the discard pile (face up, known card)
2. If drawing from the main deck:
   - The player secretly looks at the drawn card.
   - The player can:
     - **Swap:** Swap the drawn card with any card in their hand, then discard the swapped-out card to the discard pile.
     - **Discard:** Immediately discard the drawn card to the discard pile (no swap).
3. If drawing from the discard pile:
   - The player must swap the drawn card with a card in their hand (cannot discard it immediately).
   - The swapped-out card goes to the discard pile.

**State Changes:**
- `PlayerState` will be updated to include an optional `pendingDrawnCard: Card | null` field, representing a card the player has drawn but not yet swapped/discarded.
- The game logic will enforce that after drawing, the player must either swap or discard before ending their turn.

**Planned Moves:**
- `drawFromDeck`: Draw a card from the main deck, set as `pendingDrawnCard`.
- `drawFromDiscard`: Draw the top card from the discard pile, set as `pendingDrawnCard`.
- `swapAndDiscard`: Swap the `pendingDrawnCard` with a card in hand, discarding the swapped-out card.
- `discardDrawnCard`: Discard the `pendingDrawnCard` directly (only allowed if drawn from the deck).

## 9. Draw/Discard Rule Enforcement (Implementation - Pre-Unified Rule)

(This section describes an older implementation.)

- The server now tracks both the pending drawn card and its source (deck or discard pile) in PlayerState.
- Only allows discarding a drawn card if it was drawn from the deck (not the discard pile).
- Both fields are cleared after a swap or discard.
- This enforces the main draw/discard rules as described in the authoritative game overview.

**Next up:** Implementing special card abilities (K/Q/J logic and stacking).

## 10. Special Card Abilities (K/Q/J) Implementation (Pre-Unified Rule)

(This section describes an older implementation.)

- When a King, Queen, or Jack is discarded (by any means), its special ability is triggered and must be resolved before the turn ends.
- The client calls `resolveSpecialAbility` with arguments specifying which cards to peek at (for K/Q) and which two cards to swap (for K/Q/J).
- The server validates the arguments, performs the swap, discards the special card, and ends the turn.
- Peeking is handled client-side for UI/UX, but the server enforces the correct number of peeks.
- If a K/Q/J is drawn, the player may swap it into their hand (no ability triggered) or discard it immediately (ability is triggered).

**Next up:** Stacking (consecutive special card discards), quick action, or other advanced features.

## 11. Special Ability Stacking Implementation (Pre-Unified Rule)

(This section describes an older implementation, now superseded by the "Unified Matching/Stacking Opportunity" rule and its LIFO handling within `abilityResolutionStage`.)

The stacking mechanism for special abilities (K/Q/J) has been implemented with the following features:

**Core Components:**
- `specialAbilityStack`: Array in game state tracking stacked cards and their owners
- `stackActive`: Boolean flag indicating when stacking is in progress
- New moves: `stackSpecialCard` and `resolveStack`

**Stacking Rules:**
1. When a K/Q/J is discarded (via normal discard or drawn card discard):
   - A new stack is started with this card
   - Other players have the opportunity to add matching cards
2. While a stack is active:
   - Players can discard matching K/Q/J cards from their hand using `stackSpecialCard`
   - Added cards must match the rank of the last stacked card
   - Cards are added to the stack and removed from the player's hand

**Stack Resolution:**
1. When no more cards are added to the stack:
   - Abilities are resolved in LIFO order (last in, first out)
   - Each card's ability is set up as a `pendingSpecialAbility` for its owner
   - The standard `resolveSpecialAbility` move handles the actual ability resolution
2. After each ability resolution:
   - If more cards are in the stack, `resolveStack` is called automatically
   - If the stack is empty, the turn ends

**Integration:**
- Updated the normal discard paths (`swapAndDiscard`, `discardDrawnCard`) to initiate stacks
- Modified `resolveSpecialAbility` to trigger `resolveStack` after ability resolution if more cards are in the stack
- Added validation to ensure only matching cards can be stacked
- Implemented proper state tracking for the entire stacking sequence

## 12. Quick Action Implementation (Pre-Unified Rule)

(This section describes an older implementation, now superseded by the `matchingStage` and `attemptMatch` move under the "Unified Matching/Stacking Opportunity" rule.)

The quick action mechanic (out-of-turn matching card discards) has been implemented with the following features:

**Core Components:**
- `quickActionWindow` in game state tracks:
  - `active`: Whether quick actions are currently allowed
  - `startTime`: When the window opened (timestamp)
  - `duration`: How long the window stays open (5 seconds)
  - `topCard`: The card that can be matched
- `quickActionPenalty` flag in player state for tracking failed attempts

**Quick Action Flow:**
1. Window Opening:
   - When a non-special card is discarded (via normal discard or drawn card discard)
   - 5-second window opens for all players to attempt matches
   - Only one successful match allowed per window

2. Matching Attempts:
   - Players can attempt to discard a matching card (same rank) using `attemptQuickAction`
   - Successful match:
     - Card is removed from hand and added to discard pile
     - Quick action window closes
     - If hand is emptied, triggers "Check" (TODO)
   - Failed match:
     - Player draws a penalty card immediately
     - Quick action window remains open for other players

**Integration:**
- Updated `swapAndDiscard` and `discardDrawnCard` to open quick action windows
- Added helper functions:
  - `isQuickActionWindowOpen`: Validates window status
  - `openQuickActionWindow`: Creates new windows
  - `closeQuickActionWindow`: Closes after successful match
- Enhanced game state initialization with quick action window defaults
- Added to available moves in playPhase

**Next Steps:**
- Implement "Check" logic for empty hand wins
- Add frontend UI components:
  - Visual timer for quick action window
  - Quick action attempt controls
  - Feedback for successful/failed attempts
- Test edge cases:
  - Multiple simultaneous attempts
  - Quick Action timing accuracy
  - Penalty card application

**End of Current Notes**
---
*Last Updated: 2024-07-31*