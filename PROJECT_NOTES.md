# Project AI Notes: "Check" - Online Multiplayer Card Game

## Current Status: What is Done & What is Left

### ✅ What is DONE
-   **Project Structure:** `frontend/`, `server/`, `shared-types/` using npm.
-   **Core Game Logic (Server-Side with `boardgame.io`):**
    -   Game setup (deck creation, shuffle, deal), initial peek phase (`performPeek`).
    -   **"Unified Matching/Stacking Opportunity" Rule Implemented:**
        -   Discard actions (`swapAndDiscard`, `discardDrawnCard`) trigger a `matchingStage`.
        -   `matchingStage` allows any player to `attemptMatch` or `passMatch`.
        -   Successful matches seal the discard pile top, can trigger auto-"Check" if hand empties.
        -   Special card pairs (K, Q, J) set up `pendingSpecialAbility` for LIFO resolution.
        -   `matchingStage.onEnd` correctly transitions to `abilityResolutionStage` or back to `playPhase`.
    -   **Special Card Abilities (K, Q, J) & LIFO Resolution Implemented:**
        -   `abilityResolutionStage` manages ability execution via `resolveSpecialAbility` move.
        -   `abilityResolutionStage.onEnd` handles LIFO for stacked abilities.
    -   **"Calling Check" & End-of-Round Implemented:**
        -   `callCheck` move and automatic "Check" on hand empty.
        -   `finalTurnsPhase` correctly gives other players one more turn.
    -   **Scoring Phase:** Logic implemented.
    -   **Server-Side Edge Cases Addressed:** Including interactions between matching, auto-check, and LIFO ability resolution; handling for locked players and "fizzled" abilities.
-   **Shared Types (`shared-types/`):**
    -   Comprehensive types for cards, player state, game state, fully refactored for the "Unified Matching/Stacking Opportunity" rule.
    -   Compiles to CommonJS for Node.js compatibility.
-   **Runtime Module Resolution:**
    -   `shared-types` successfully imported at runtime by `server` using `module-alias`.
    -   `server` code (specifically client-safe game logic) successfully imported by `frontend`.
-   **Server Build (`server/`):**
    -   `npm run build` (using `tsc`) correctly compiles TypeScript to `dist/`.
    -   `game-definition.ts` created to separate client-consumable game object from server-only code.
    -   `tsconfig.json` configured for `declaration: true` and CommonJS output.
-   **Frontend Setup (`frontend/`):**
    -   Next.js 15.3.2 project initialized with `app` router.
    -   `boardgame.io` client library and `react-boardgame` bindings installed.
    -   Basic `CheckGameBoard.tsx` and `CheckGameClient.tsx` components created.
    -   Client connects to `localhost:8000` and renders multiple player views.
    -   **Type Error Resolution:** `CheckGameBoardProps` updated to allow `G.players` to be `{}` during initial `boardgame.io` client setup, resolving type incompatibilities.
    -   **New UI Components Created:**
        -   `CardComponent.tsx`: Displays individual cards (face-up or face-down).
        -   `PlayerHandComponent.tsx`: Renders a player's hand in a grid, handling card visibility.
        -   `DrawPileComponent.tsx`: Displays the draw pile and handles draw interaction.
        -   `DiscardPileComponent.tsx`: Displays the discard pile and handles interaction.
    -   **`CheckGameBoard.tsx` Enhancements:**
        -   Integrates `PlayerHandComponent`, `DrawPileComponent`, and `DiscardPileComponent`.
        -   Displays game state (phase, current player), player hands, draw/discard piles.
        -   Includes an "Action Zone" for the current player.
        -   Basic state management for card selections (`selectedHandCardIndex`, `multiSelectedCardLocations`, `revealedCardLocations`, `abilityArgs`).
        -   Placeholder move handlers and initial UI for different game phases (initial peek, play, matching, ability resolution).
        -   `Rank` enum import fixed for value usage.
-   **Frontend Build & Bundling (Webpack & Turbopack):**
    -   **Path Aliases:**
        -   `frontend/tsconfig.json` defines `server-game` alias pointing to `../server/dist/game-definition.js`.
    -   **Webpack (`npx next dev`):**
        -   Successfully compiles and runs.
        -   `frontend/next.config.ts` includes a Webpack rule (`type: 'javascript/auto'`) to correctly handle CommonJS output from `server/dist/game-definition.js`, resolving `import.meta` errors.
        -   `@types/webpack` added as a dev dependency.
    -   **Turbopack (`npm run dev` i.e., `next dev --turbopack`):**
        -   Successfully compiles and runs.
        -   `frontend/next.config.ts` uses `turbopack.resolveAlias` for the `server-game` alias.
        -   `turbopack.root` is set to `path.join(__dirname, '..')` (absolute path to project root). This is necessary for Turbopack to resolve the alias correctly due to the `../server` path.
        -   A warning `Unrecognized key(s) in object: 'root' at "turbopack"` appears with this `root` setting, despite it being documented and functional. This is noted as a potential minor inconsistency in Next.js 15.3.2.
    -   `experimental.externalDir: true` is enabled in `frontend/next.config.ts`.
-   **Documentation:** This `PROJECT_NOTES.md` file updated.

### ⏳ What is LEFT
-   **Frontend Implementation (Major Focus):**
    -   **Refine UI Interactivity & Move Handlers:**
        -   Connect placeholder move handlers in `CheckGameBoard.tsx` to `boardgame.io` moves.
        -   Implement robust UI logic for complex actions (e.g., King/Queen ability target selection: peek targets, then swap targets).
        -   Manage UI state for multi-step actions effectively.
    -   **Game Visuals & User Experience:**
        -   Improve overall styling and layout for a polished look and feel.
        -   Add a dedicated game messages/log area.
        -   Visually enhance representation of `matchingStage` and `abilityResolutionStage`.
        -   Display scores clearly at the end of the round.
    -   **Type Safety:** Define a proper TypeScript interface for the `moves` prop in `CheckGameBoardProps`.
    -   Handle and display game state updates dynamically and smoothly.
-   **Server-Side Refinements & Testing:**
    -   Thorough playtesting of all game phases and interactions.
    -   Verify turn management robustness after complex stage transitions.
-   CORS configuration for server (if deploying frontend and server to different origins).
-   (Optional) User authentication, lobbies, persistent leaderboards, multi-round game sessions.
-   (Optional) Investigate and report the `turbopack.root` warning to Next.js if it becomes problematic or if a cleaner solution is found.

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
Turns proceed in a chosen direction. A player's turn consists of a primary draw action, followed by a matching opportunity, and then resolution of any triggered abilities.

*   **A. Primary Draw Action (Mandatory):**
    *   **Draw from the Draw Pile (Face Down):**
        1.  Take the top card from the Draw Pile. This card is known only to the drawing player.
        2.  The player then chooses one of these options for this drawn card:
            *   **Swap & Discard:** Select one card from their hand grid and swap it with the drawn card. The drawn card is placed face-down into the selected grid position. The card originally in that grid position (Card X) is then placed face-up onto the Discard Pile. This discard (Card X) creates a "Matching/Stacking Opportunity" (see section 7).
            *   **Discard Drawn Card:** Immediately place the drawn card (Card X) face-up onto the Discard Pile. This does not affect the player's hand grid. This discard (Card X) creates a "Matching/Stacking Opportunity" (see section 7).
            *   *(Note: If a K, Q, or J is drawn and the player chooses to swap it into their hand, its ability does NOT trigger at this point. It only triggers when later discarded from the hand to the Discard Pile).*\
    *   **Draw from the Discard Pile (Face Up):**
        1.  This is only possible if `G.discardPileIsSealed` is `false` (i.e., the top card is not the second card of a just-completed matched pair).\
        2.  If drawable, take the top card from the Discard Pile.
        3.  The player **must** swap this card with one card from their hand grid. The drawn card is placed face-down into the selected grid position. The card originally in that grid position (Card X) is then placed face-up onto the Discard Pile. This discard (Card X) creates a "Matching/Stacking Opportunity" (see section 7).
        4.  A player cannot draw from the Discard Pile and then immediately discard that same card without swapping.

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

## 1. Project Overview

**Goal:** Develop a web-based, free-to-play online multiplayer card game called "Check."

**Core Objective of "Check":** Be the player with the lowest total card value at the end of the round.

**(Key Game Mechanics are detailed in the "Game Rules & Mechanics (Authoritative Overview)" section above, which is the primary reference for rules.)**

## 2. Technology Stack & Architecture

### 2.1. Project Structure
*   **Root Directory:** `check-the-game-v2/`
*   **Structure:** Separate project folders for `frontend/`, `server/`, `shared-types/`.
*   **Package Manager:** `npm` for each sub-project.

### 2.2. Frontend (`frontend/`)
*   **Framework:** Next.js 15.3.2 (App Router)
*   **Language:** TypeScript
*   **UI:** React
*   **Real-time:** `boardgame.io/react` client, `socket.io-client`.
*   **Key Responsibilities:** UI rendering, user input, WebSocket communication.

### 2.3. Backend (`server/`)
*   **Language:** TypeScript
*   **Environment:** Node.js
*   **Real-time Framework:** `boardgame.io` with `SocketIO` transport.
*   **Key Responsibilities:** Server-authoritative game logic, state synchronization.

### 2.4. Shared Code (`shared-types/`)
*   **Purpose:** TypeScript type definitions shared between `frontend/` and `server/`.
*   **Build:** Compiles to CommonJS in `dist/` with declaration files.

### 2.5. Database
*   **Current Status:** Not implemented. (Future: User accounts, leaderboards).

## 3. Current Project Status & Key Decisions (Summary)

*   **Core Game Logic:** Largely complete on the server with `boardgame.io`, including the "Unified Matching/Stacking Opportunity" and LIFO ability resolution.
*   **Build System:** `tsc` for `server/` and `shared-types/`; Next.js build for `frontend/` (supports Webpack and Turbopack).
*   **Frontend:** Basic client setup done, displays multiple player views and connects to server. UI for game interactions is the next major step.
*   **Module Resolution:** Stable for `shared-types` in server (via `module-alias`) and for importing server game logic into frontend (via `tsconfig.json` paths and `next.config.js` bundler aliases).

**(Detailed status of components and features is in the "✅ What is DONE" section.)**

## 4. Challenges & Solutions Discussed (Key Points)

*   **Hidden Information:** Handled by `boardgame.io`'s `playerView`.
*   **Complex Turn/Stage Management:** Managed using `boardgame.io` stages (`matchingStage`, `abilityResolutionStage`).
*   **Monorepo-like Structure & Build Issues:**
    *   **Server & Shared Types:** `shared-types` compiled to CommonJS. `module-alias` used in `server` for runtime resolution. `server` code intended for client consumption (`game-definition.ts`) isolated and compiled.
    *   **Frontend & Server Code:**
        *   `frontend/tsconfig.json` uses `paths` for `server-game` alias.
        *   `frontend/next.config.ts`:
            *   `experimental.externalDir: true`.
            *   Webpack: Custom rule `type: 'javascript/auto'` for `server/dist/**.js` to handle CommonJS.
            *   Turbopack: `turbopack.resolveAlias` for `server-game`, and `turbopack.root` set to project root (absolute path) to make this alias work correctly. This currently shows a warning `Unrecognized key(s) in object: 'root' at "turbopack"`, but is functional and aligns with documentation.
*   **Frontend Type Errors:** Initial `boardgame.io` client/board props mismatch resolved by making `G.players` in `CheckGameBoardProps` allow `{}`.

## 5. Next Immediate Steps (as of last update)

Primarily focused on **Frontend Implementation**:
1.  Develop detailed React components for game visualization and interaction.
2.  Implement UI logic for all player actions and game stages (`matchingStage`, `abilityResolutionStage`).
3.  Thoroughly test frontend-backend interaction.

Followed by **Server-Side Testing & Refinement**.

## 6. AI Assistant Instructions

*   This document is the primary context.
*   Help maintain this document.
*   Prioritize `boardgame.io` solutions.
*   Focus on TypeScript best practices.

## 7. Deprecated/Historical Notes (Pre-Unified Matching Rule)

(Sections 7-12 from the previous version of the notes, detailing older mechanics like "Quick Action" and a different "Special Ability Stacking," are now considered historical and have been superseded by the "Unified Matching/Stacking Opportunity" rule detailed in the main "Game Rules & Mechanics" section. They can be referred to if needed for understanding the evolution but do not represent current implementation.)

---
*Last Updated: (Current Date)*