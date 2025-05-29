# Project AI Notes: "Check" - Online Multiplayer Card Game

## Current Status: What is Done & What is Left

### ✅ What is DONE
-   **Project Structure:** `frontend/`, `server/`, `shared-types/` using npm.
-   **Core Game Logic (Server-Side with `boardgame.io`):**
    -   Game setup (deck creation, shuffle, deal), initial peek phase (`performPeek`).
    -   **New Initial Peek Flow Implemented (Server-Side):**
        -   Players must click "Ready" to start a countdown.
        -   Bottom two cards are automatically revealed for a limited time.
        -   `PlayerState` and `CheckGameState` updated with `isReadyForInitialPeek`, `hasCompletedInitialPeek`, `initialPeekAllReadyTimestamp`.
        -   `initialPeekPhase` redefined with `waitingForReadyStage` and `revealingCardsStage`.
        -   `playerView` updated to reveal correct cards during `revealingCardsStage` and redact for spectators.
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
        -   **New Initial Peek Flow Implemented (Client-Side):**
            -   UI for "Ready" button, countdown messages, and timed card reveal.
            -   `useEffect` hook manages countdown and reveal timers, and calls `playerAcknowledgesPeek`.
            -   `getOwnCardsToShowFaceUp` updated for automated reveal.
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
-   **Monorepo-like Structure & Build Issues:**
    *   **Server & Shared Types:** `shared-types` compiled to CommonJS. `module-alias` used in `server` for runtime resolution. `server` code intended for client consumption (`game-definition.ts`) isolated and compiled.
    *   **Frontend & Server Code:**
        *   `frontend/tsconfig.json` uses `paths` for `server-game` alias.
        *   `frontend/next.config.ts`:
            *   `experimental.externalDir: true`.
            *   Webpack: Custom rule `type: 'javascript/auto'` for `server/dist/**.js` to handle CommonJS.
            *   Turbopack: `turbopack.resolveAlias` for `server-game`, and `turbopack.root` set to project root (absolute path) to make this alias work correctly. This currently shows a warning `Unrecognized key(s) in object: 'root' at "turbopack"`, but is functional and aligns with documentation.
    *   **Build Process & TypeScript Compilation:** Resolved issues with `tsc` silently failing to create `dist` folder in `server` by using `tsc -b --force` and subsequently ensuring clean build scripts (`rimraf ./dist ./tsconfig.tsbuildinfo && tsc`).
    *   **Client-Side Timers in React `useEffect`:** Debugged and resolved issues with `setTimeout` being prematurely cleared in `useEffect` due to re-renders caused by state updates. Solution involved careful management of timer IDs (e.g., using `useRef`) and selective clearing in the effect's cleanup function.
-   **Frontend Type Errors:** Initial `boardgame.io` client/board props mismatch resolved by making `G.players` in `CheckGameBoardProps` allow `{}`.

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

*   **useEffect Dependency Array Error:**
    *   Encountered "Error: The final argument passed to useEffect changed size between renders."
    *   This was due to adding `isActive` to the peek `useEffect` dependency array. The error message indicated the array size changed from 8 to 9.
    *   Solution involved a full page reload (to clear potential HMR inconsistencies) and defensively memoizing the `moves.checkInitialPeekTimer` function reference before passing it to the dependency array.
*   **HTML Nesting Error (`<div>` in `<p>`):**
    *   "Error: In HTML, `<div>` cannot be a descendant of `<p>`." occurred in the `matchingStage` UI where `CardComponent` (which renders `div`s) was inside a `<p>` tag.
    *   Fixed by changing the `<p>` to a `<div>`.

**Current Issue: "Pass Match" Button Not Working in `matchingStage`**
*   Player 1 discards a card, game enters `matchingStage`.
*   `G.matchingOpportunityInfo` is set, `ctx.activePlayers` shows both players in `matchingStage`.
*   UI for both players shows "Matching Opportunity for: [Card]" and a "Pass Match" button.
*   Client error "disallowed move: passMatch" occurs because `ctx.allowedMoves` is `undefined`.
    *   **Root Cause Identified (Initial):** `matchingStage` was being activated as a *stage* within `playPhase` using `events.setActivePlayers`. However, `matchingStage` is defined as a top-level *phase*. This mismatch caused `boardgame.io` client to not recognize available moves.
    *   **Secondary Issue Identified:** The client-side conditional `isInMatchingStage` was incorrectly checking `ctx.activePlayers?.[playerID] === 'matchingStage'`. It should check `ctx.phase === 'matchingStage'` and that the player is active in *any* stage of that phase (i.e., `ctx.activePlayers?.[playerID]` is truthy).
        *   **Fix:** Updated `isInMatchingStage` to `!!(playerID && ctx.phase === 'matchingStage' && ctx.activePlayers?.[playerID])`.
    *   **Tertiary Issue Suspected (Stale Closure):** `handlePassMatch` might be using a stale `ctx` object because it wasn't memoized with `useCallback`. `ctx.allowedMoves` was `undefined` in the handler at click time, even if it might have been populated in `ctx` when the phase began.
        *   **Fix:** Wrapped `handlePassMatch` in `useCallback` with dependencies `[moves, playerID, ctx, isActive]`. Refined the internal condition for calling `moves.passMatch` to align with `isInMatchingStage` logic.
    *   **Fourth Issue Identified (Client `ctx.allowedMoves` missing):** The `ctx` object logged by `useEffect` when `matchingStage` begins shows that `allowedMoves` is missing or undefined *before* `handlePassMatch` is even called. This is the primary bug now.
        *   **Debug Step (Ruled Out):** Temporarily simplified `playerView` on the server to `return G;`. This did not resolve the missing `allowedMoves`.
        *   **Hypothesis for Missing `allowedMoves` (Tested):** The `moves` for `matchingStage` were defined at the phase level, but `turn.activePlayers` used `{ all: 'stage' }`. `boardgame.io` might require moves to be defined within the specific stage (`stages.stage.moves`) when `activePlayers` points to a named stage.
            *   **Fix Attempt (Applied):** Restructured `matchingStage` in `server/src/game-definition.ts` to define `attemptMatch` and `passMatch` within `turn.stages.stage.moves`. This did *not* resolve `allowedMoves` being missing from the client `ctx` upon entering the phase.
        *   **Next Steps:** Check `boardgame.io` versions. Consider minimal reproduction if versions are normal.
        *   **Fix (Server-side validation):** Corrected the server-side `passMatch` move validation to properly check `ctx.phase === 'matchingStage'` and player activity in that phase.
    *   **Fix Attempt for Root Cause (Phase vs. Stage):**
        *   Changed `swapAndDiscard` and `discardDrawnCard` to use `events.setPhase('matchingStage')`.
        *   Updated `matchingStage.turn.onEnd` to use `events.setPhase` for transitions to `abilityResolutionStage` or `playPhase`.
        *   Updated `abilityResolutionStage.turn.onBegin` to find and set the active player with a pending ability using `events.setActivePlayers({ currentPlayer: playerWithAbility })`.
        *   Updated `abilityResolutionStage.turn.onEnd` to use `events.endTurn()` to re-evaluate `onBegin` if multiple abilities need sequential resolution within the phase, or `events.setPhase` to move to the next appropriate game phase.
        *   Added `lastPlayerToResolveAbility: string | null` and `lastResolvedAbilityCardForCleanup: Card | null` to `CheckGameState` (and initialized them) to aid in ability resolution flow.
        *   Corrected type definitions and ordering in `shared-types/src/index.ts` to resolve linter errors.
        *   Corrected `ctx.playerID` usage to `ctx.currentPlayer` in a server log.
*   **Debugging Steps Taken:**
    *   Added detailed console logs to the client-side `handlePassMatch` function in `frontend/app/components/CheckGameBoard.tsx` to verify if the `moves.passMatch()` call is being made and under what conditions. This included logging `ctx.allowedMoves`.
    *   Added detailed console logs to the server-side `passMatch` move in `server/src/game-definition.ts` to check if the move is received and if it's considered valid by the server.

**Previous Issue (Resolved): Stuck in `matchingStage` due to waiting for both players**
*   The game was "stuck" because it was correctly waiting for *both* players to make their move (`attemptMatch` or `passMatch`) within the `matchingStage`, as per `moveLimit: 1`. The next step was for the user to have both players click "Pass Match" to see if `matchingStage.onEnd` executes correctly, which led to discovering the non-functional buttons.

Throughout the process, `console.log` statements were added to both client and server, and client-side debug state was frequently inspected to diagnose issues.