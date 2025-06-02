# Project Notes: "Check" - Online Multiplayer Card Game

## Framework & Core Technologies (DO NOT OVERWRITE)
*   **Backend:** Node.js, Express.js (implicitly via Socket.IO's HTTP server), Socket.IO, TypeScript
*   **Frontend:** Next.js (with React), TypeScript, Tailwind CSS
*   **Shared Logic/Types:** TypeScript (in `shared-types/` directory)

## Current Status: Major Refactor - `boardgame.io` to Socket.IO Backend

The project has undergone a significant refactor to replace the `boardgame.io` library with a custom backend using Node.js, Express, and `socket.io`, while retaining the Next.js frontend.

### ✅ What is DONE (Socket.IO Refactor - As of this update)

**Server-Side (`server/`)**
*   **Socket.IO & HTTP Server Setup:**
    *   Dependencies: `socket.io` installed. `boardgame.io` and related dependencies removed from `server/package.json`.
    *   `server/src/index.ts` reconfigured:
        *   Uses Node.js `http` server with `socket.io` `Server` attached (port 8000).
        *   Basic `socket.io` connection (`io.on('connection', ...)`) and disconnection handlers.
        *   CORS configured for `http://localhost:3000`.
        *   Player ID management on socket connection (`socket.data.playerId`).
*   **Game State Management & Core Logic (`server/src/game-manager.ts`):**
    *   `GameManager` concept established to handle game rooms, game state, and core game logic.
    *   **Types & Initial Structure (integrated with `shared-types`):**
        *   Uses `Card`, `PlayerState`, `ServerCheckGameState` from `shared-types`.
        *   `ServerCheckGameState` now includes fields previously managed by `boardgame.io`'s `ctx` (e.g., `currentPhase`, `currentPlayerId`, `turnOrder`, `activePlayers`, `pendingAbilities`, `matchResolvedDetails`, `gameover`).
        *   `createDeck()` and `simpleShuffle()` (placeholder) implemented.
        *   `GameRoom` interface (`gameId`, `gameState`) and an in-memory `activeGames` store defined.
    *   **Game Initialization & Player Management:**
        *   `initializeNewGame(gameId, playerSetupData)`: Creates a new game, deals initial hands, sets up initial `ServerCheckGameState` (including `currentPhase: 'initialPeekPhase'`, `currentPlayerId`, `turnOrder`, `activePlayers` for peek, `matchResolvedDetails: null`, `pendingAbilities: []`, `gameover: null`).
        *   `getGameRoom(gameId)`: Retrieves an active game room.
        *   `addPlayerToGame(gameId, playerInfo)`: Adds a player to an existing game, deals their initial 4 cards, and initializes their state.
    *   **Player View / State Redaction:**
        *   `generatePlayerView(fullGameState, viewingPlayerId)` function created to redact sensitive information (other players' hands, full deck state) and produce `ClientCheckGameState`.
*   **Socket Event Handlers (`server/src/index.ts` integrating with `game-manager.ts`):**
    *   `createGame`: Calls `initializeNewGame`, client joins `socket.io` room, sends back `gameId` and a player-specific `gameState` (via `generatePlayerView`).
    *   `joinGame`: Calls `addPlayerToGame`, client joins room, notifies others with `playerJoined`, sends player-specific `gameState` to all clients in the room.
    *   `playerAction` (generic handler for `{ gameId, playerId, type, payload }`):
        *   Calls corresponding game logic functions from `game-manager.ts` based on `type`.
        *   Broadcasts player-specific `gameStateUpdate` views (via `generatePlayerView`) to all clients in the room. For `declareReadyForPeek`, this handles the first broadcast (peek start), while the second (peek end) is triggered by `game-manager` via an injected broadcast function.
*   **Ported & Refactored Game Moves/Logic (in `game-manager.ts`):**
    *   `handleDrawFromDeck(gameId, playerId)`
    *   `handleDrawFromDiscard(gameId, playerId)`
    *   `handleSwapAndDiscard(gameId, playerId, handIndex)`: Sets `matchingOpportunityInfo` (now including `potentialMatchers`), transitions phase to `matchingStage`.
    *   `handleDiscardDrawnCard(gameId, playerId)`: Sets `matchingOpportunityInfo` (now including `potentialMatchers`), transitions phase to `matchingStage`.
    *   `handleAttemptMatch(gameId, playerId, handIndex)`:
        *   Adds K/Q/J pair abilities to `G.pendingAbilities` array (instead of `player.pendingSpecialAbility`).
        *   Handles auto-"Check".
        *   Sets `G.matchResolvedDetails` and calls `checkMatchingStageEnd`.
    *   `handlePassMatch(gameId, playerId)`: Updates `G.activePlayers`, calls `checkMatchingStageEnd`.
    *   `checkMatchingStageEnd(gameId)` (helper): Sole decider for phase transitions out of `matchingStage`. Checks `G.matchResolvedDetails` or if all players passed. Adds discard-source abilities to `G.pendingAbilities`. Calls appropriate phase setup helpers.
    *   `handleCallCheck(gameId, playerId)`: Calls `setupFinalTurnsPhase`.
    *   `handleResolveSpecialAbility(gameId, playerId, abilityArgs)`:
        *   Processes abilities from `G.pendingAbilities`.
        *   Handles K, Q, J abilities (swaps, peeks - peek targets from `abilityArgs`).
        *   Fizzles for locked players (implicit, as abilities are on `G` not player).
        *   Sets `G.lastPlayerToResolveAbility` and `G.lastResolvedAbilitySource`.
        *   Calls `setupAbilityResolutionPhase` or next phase setup if no more abilities.
    *   `handleDeclareReadyForPeek(gameId, playerId)`: Now an `async` function. When all players are ready, it sets `player.cardsToPeek` (bottom two cards: indices 2 and 3) and `player.peekAcknowledgeDeadline`. After a server-side timeout (`PEEK_TOTAL_DURATION_MS`), it automatically clears peek state, marks peek as completed for all players, and transitions the game to `playPhase` via `setupNextPlayTurn`.
    *   `handleAcknowledgePeek(gameId, playerId)`: Removed. The peek completion is now automated by a server-side timer triggered in `handleDeclareReadyForPeek`.
    *   **Peek Broadcast Fix**: Modified `handleDeclareReadyForPeek` in `game-manager.ts` to be synchronous for its immediate return. It now sets `cardsToPeek` and returns the state for an immediate broadcast when all players are ready (peek starts). A `setTimeout` is scheduled, and its callback (after peek duration) updates the game state (clears `cardsToPeek`, advances phase) and then calls a new `triggerBroadcast` function (passed from `index.ts`) to send a second broadcast with the post-peek state. `index.ts` was updated to provide this broadcast function to `game-manager.ts` and correctly handle the immediate broadcast from `handleDeclareReadyForPeek`.
*   **Phase Setup Helper Functions (in `game-manager.ts`):**
    *   `setupNextPlayTurn(gameId)`: Finds next non-locked player for `playPhase`. Transitions to scoring if check called and no one else can play.
    *   `setupFinalTurnsPhase(gameId, checkerPlayerId)`: Sets up for final turns, resets `finalTurnsTaken`. Determines first player for final turns.
    *   `setupAbilityResolutionPhase(gameId)`: Finds the player with the highest priority pending ability from `G.pendingAbilities` (LIFO logic for `'stack' -> 'stackSecondOfPair'` using `pairTargetId` and `G.lastPlayerToResolveAbility`). Transitions to next phase if no abilities.
    *   `setupScoringPhase(gameId)`: Calculates scores, determines `roundWinner`, sets `G.gameover`.
    *   `continueOrEndFinalTurns(gameId)`: Manages turn-by-turn progression in `finalTurnsPhase`, incrementing `finalTurnsTaken` and finding the next player or transitioning to scoring. Called by `setupNextPlayTurn` and `setupAbilityResolutionPhase` when appropriate.
*   **Build Error Resolution & Code Cleanup:**
    *   Outdated `server/src/game-definition.ts` (from `boardgame.io`) deleted.
    *   Numerous TypeScript errors related to type mismatches and undefined properties resolved in `game-manager.ts` and `shared-types`.
    *   Corrected `potentialMatchers` logic.
    *   Ensured `playerId` is included in all `PendingSpecialAbility` objects.
    *   Resolved issues with `PEEK_COUNTDOWN_SECONDS`, `PEEK_REVEAL_SECONDS` constants.
    *   Fixed type errors in `generatePlayerView` related to `HiddenCard` IDs and player `name` property.

**Shared Types (`shared-types/`)**
*   **Comprehensive Type Update for Socket.IO Backend:**
    *   `InitialPlayerSetupData` interface moved here.
    *   `PlayerState` updated: added `cardsToPeek`, `peekAcknowledgeDeadline`. Removed `pendingSpecialAbility` (now on `CheckGameState`). `name` property is not part of `PlayerState`.
    *   `CheckGameState` (aliased as `ServerCheckGameState` in server) significantly updated:
        *   Added: `currentPhase`, `currentPlayerId`, `turnOrder`, `activePlayers`, `pendingAbilities: PendingSpecialAbility[]`, `matchResolvedDetails`, `gameover`, `lastPlayerToResolveAbility`, `lastResolvedAbilitySource`, `lastResolvedAbilityCardForCleanup`.
        *   `matchingOpportunityInfo` updated to include `potentialMatchers: string[]`.
    *   `PendingSpecialAbility` interface now includes `playerId`.
    *   `ClientCard` (union of `Card` and `HiddenCard`), `ClientPlayerState`, `ClientCheckGameState` (includes `viewingPlayerId`, `deckSize`) defined for tailored client views. `ClientPlayerState` has optional `name`. `HiddenCard` requires an `id`.
    *   `AbilityArgs` interface updated for King peek and J/Q swap targets.
    *   Card values (Ace: -1, J:11, Q:12, K:13) confirmed.

**Frontend (`frontend/`)**
*   **Socket.IO Client Setup & `boardgame.io` Removal:**
    *   Dependencies: `socket.io-client` installed. `boardgame.io` and `react-boardgame` removed from `frontend/package.json`.
    *   `frontend/app/components/CheckGameClient.tsx` deleted.
    *   `frontend/app/page.tsx` refactored:
        *   Initializes `socket.io-client` connection to `http://localhost:8000`.
        *   Manages socket connection state, game state (`ClientCheckGameState`), `gameId`, `playerId`, and errors using React hooks.
        *   Sets up listeners for `connect`, `disconnect`, `connect_error`, `gameStateUpdate`, and `playerJoined`.
        *   UI for "Create Game" and "Join Game", emitting corresponding socket events.
        *   `sendPlayerAction` function emits actions to the server.
        *   Renders `<CheckGameBoard />` with new props: `gameState`, `playerId`, `onPlayerAction`.
*   **Component Refactoring for Socket.IO State:**
    *   `frontend/app/components/CheckGameBoard.tsx` extensively refactored:
        *   Props changed to `gameState: ClientCheckGameState | null`, `playerId: string | null`, `onPlayerAction: (type: string, payload?: any) => void`.
        *   Removed internal `boardgame.io` specific logic (`G`, `ctx`, `moves`, `isActive`).
        *   Action handlers (e.g., for draw, discard, match, pass, ability resolution) now call `onPlayerAction`.
        *   UI conditionals and data display updated to use `gameState` and `playerId`.
        *   Initial peek flow UI (ready button, countdown, card reveal) adapted for server-driven state (`player.cardsToPeek`, `player.peekAcknowledgeDeadline`). The "Acknowledge Peek" button and its corresponding client-side handler (`handleAcknowledgePeek`) have been removed, as peek completion is now automated by the server.
        *   Corrected logic for passing `cardsToForceShowFaceUp` to `PlayerHandComponent`, ensuring it targets the correct cards (from `handToShow`) during initial peek reveal.
        *   UI for matching stage, ability resolution (target selection for King/Queen/Jack), and calling "Check" implemented/updated.
        *   Debug output updated.
    *   `frontend/app/components/CardComponent.tsx`: Prop `card` changed to `ClientCard | null`. Renders hidden cards as placeholders. `id` property added to `ClientCard` where appropriate.
    *   `frontend/app/components/PlayerHandComponent.tsx`:
        *   Props changed to use `ClientPlayerState`, `ClientCard[]`.
        *   Logic for determining card visibility (face-up/down) updated for `ClientCard` and peek scenarios (`cardsToForceShowFaceUp`, `handToShow`).
        *   Refined `showFaceUp` logic to ensure player's own cards are face-down by default, only showing face-up if `cardsToForceShowFaceUp` dictates (e.g., during initial peek reveal or ability peeks). This fixed an issue where all of the player's own cards were incorrectly visible by default.
*   **Linter Error Resolution (Frontend):**
    *   Resolved numerous TypeScript errors in `CheckGameBoard.tsx`, `CardComponent.tsx`, `PlayerHandComponent.tsx` related to new prop types and state structure.
    *   Addressed React specific errors (e.g. `ReactNode` type issues for button content).

**Reconnection Logic (Client + Server)**
*   **Client-Side (`frontend/app/page.tsx`):**
    *   Stores `gameId`, `playerId`, and `playerName` in `localStorage`.
    *   On load, attempts to retrieve session info and emits `attemptRejoin` to the server.
    *   Handles server response for rejoin (success/failure), updates state accordingly.
    *   `createGame` and `joinGame` updated to store session info and use server-provided `playerId`.
*   **Server-Side (`server/src/index.ts`, `server/src/game-manager.ts`):**
    *   `PlayerState` in `shared-types` updated with `isConnected: boolean` and `socketId: string`.
    *   `game-manager` updated to initialize and manage `isConnected` and `socketId` for players.
    *   New `markPlayerAsDisconnected` and `attemptRejoinGame` methods in `game-manager`.
    *   `index.ts` (main server file) handles new `attemptRejoin` socket event.
    *   On socket `disconnect`, player is marked as disconnected in `game-manager`.
    *   `socketId` passed correctly during game creation and joining.
    *   Game state broadcasts now include player connection status implicitly through `PlayerState` updates.
    *   Basic session tracking (`socketSessionMap`) added to `index.ts` to map `socket.id` to `gameId` and `playerId`.

### ⏳ What is LEFT / Next Steps

*   **Thorough Runtime Testing & Debugging (Client + Server):**
    *   Start the server (`npm run dev` in `server/`).
    *   Start the client (`npm run dev` in `frontend/`).
    *   Play through all game phases, testing all actions, player counts, edge cases.
    *   Identify and fix runtime bugs in game logic, state updates, and UI rendering.
    *   Verify player view redaction is working correctly.
    *   Ensure phase transitions are smooth and correct.
*   **Server-Side Refinements:**
    *   Replace `simpleShuffle()` with a robust shuffling algorithm (e.g., Fisher-Yates).
    *   Consider error handling and validation for socket events and game actions more deeply.
    *   Persistency: If desired, replace in-memory `activeGames` with a database solution (e.g., Redis).
*   **Frontend UI/UX Enhancements:**
    *   Improve visual styling and layout for a more polished game board.
    *   Add a game log/message area to display important events.
    *   Enhance UI for ability target selection (e.g., visual cues for selectable cards/players).
    *   Display scores clearly at the end of the round.
    *   Consider adding player names to the display (requires storing them on `PlayerState` server-side, propagating to `InitialPlayerSetupData` during game init, and passing via `ClientPlayerState`).
*   **Deployment Considerations:**
    *   The user noted Vercel's lack of WebSocket support. If deploying there, an alternative hosting solution for the Socket.IO server will be needed, or a different communication method (e.g., long polling, though less ideal for real-time games).
*   (Optional) User authentication, lobbies, multi-round game sessions, persistent leaderboards.
*   **Check Call**
    *  Check the functionality for game ending as currently thats not working properly.
    * Improve ui

---

## UI Redesign Implementation Plan (Minimal & Sleek, Richio-inspired)

**Goal:** Transform the game's UI to a minimal, modern, and sleek look inspired by Richio and similar card games.

### Step-by-Step Plan

1. **Design Foundation**
   - ✅ Minimal color palette, modern font, Tailwind v4 ready.
2. **Layout Refactor**
   - ✅ Centered board, responsive flex/grid, whitespace-based separation.
3. **Card Component Redesign**
   - ✅ Minimal, modern CardComponent (white, rounded, accent border, smooth hover, suit color, responsive size).
4. **Player Hand Component**
   - ✅ Minimal, modern PlayerHandComponent (clean grid, status badges, soft backgrounds, responsive, accessible).
5. **Board Layout & Piles**
   - ✅ Minimal DrawPileComponent and DiscardPileComponent (white, shadow, subtle labels, responsive, accessible).
6. **Action Bar & Buttons**
   - ✅ Floating, pill-shaped ActionBarComponent for all in-game actions (draw, discard, match, check, pass, ability, etc.).
7. **Game State & Info**
   - ✅ Minimal phase banner, turn indicator, and floating GameLogComponent (collapsible, recent events, mobile-friendly).
8. **End-of-Game Experience**
   - ✅ EndOfGameModal: modern, celebratory modal with winner(s), scores, and Play Again button.
9. **Accessibility & Polish**
   - In progress: Keyboard navigation, colorblind icons, loading states, further polish.
10. **Testing & Iteration**
   - In progress: Cross-device testing, feedback, and UI/UX tweaks.

### New Components Summary
- **ActionBarComponent:** Floating, pill-shaped action bar for all player actions, responsive and minimal.
- **EndOfGameModal:** Modern modal overlay for round end, showing winner(s), scores, and Play Again.
- **GameLogComponent:** Floating, collapsible panel for recent game events, mobile-friendly, minimal.

### ⏳ What is LEFT / Next Steps
- Further polish: animations (e.g., card draw/discard, confetti), ability resolution UI, player badges, and visual cues.
- Accessibility: keyboard navigation, colorblind support, loading/waiting states.
- Optional: Game log enhancements, player avatars, sound effects, advanced end-of-game experience.
- Cross-device testing and feedback-driven iteration.
- Fix the ending result screen.
- Improve the UI and Card Design.
- Better animations.
- Fix inconsistent ui size bug when penalty card is added (placeholder card visual difference)

*Last Updated: 2025-06-2*

---

## Session Notes (YYYY-MM-DD) - Logging, Core Mechanics, Rule Verification & UI Fixes

This session covered several key areas: refining the logging system, ensuring core gameplay mechanics align with the intended rules (especially card visibility), verifying server logic against the game overview, and fixing a UI bug.

*   **Sensitive & Targeted Logging Enhancements:**
    *   **Redundancy Reduction:** Implemented a mechanism to prevent players from receiving both a detailed private log and a generic public log for the same event.
        *   Added `privateVersionRecipientId?: string` to `RichGameLogMessage` in `shared-types`.
        *   Updated `emitLogEntry` (`game-manager.ts`) to set this field on the public log if a private version is sent.
        *   Modified `broadcastLogEntry` (`server/src/index.ts`) to check `privateVersionRecipientId` and exclude that recipient from the public broadcast, ensuring they only get the detailed private log.
*   **Comprehensive Server-Side Event Logging:**
    *   Added new `emitLogEntry` calls in `game-manager.ts` for previously unlogged critical game events:
        *   Player reconnection (`attemptRejoin`).
        *   Player disconnection (`markPlayerAsDisconnected`).
        *   Player forfeiture due to disconnect timeout (`handleDisconnectTimeout`).
        *   Game Over: Winner, final scores, total turns (`setupScoringPhase`).
        *   Matching stage ending without a match (all passed) (`checkMatchingStageEnd`).
        *   Matching stage timeout (`handleMatchingStageTimeout`).
        *   Turn timeouts with context for different segments (initial action, draw/discard choice, swap/discard choice, ability choice) (`handleTurnTimeout`).
*   **Core Gameplay Mechanic: "Always Face-Down in Hand" & Penalty Cards:**
    *   **Clarification:** Established that penalty cards are drawn face-down and remain unknown to the drawing player.
    *   **Implementation:**
        *   Added `isFaceDownToOwner?: boolean` to `Card` interface in `shared-types`.
        *   `handleAttemptMatch` (`game-manager.ts`): When a penalty card is drawn, it's now marked `isFaceDownToOwner: true`. The private log to the attempter now states "You drew a face-down card..." instead of revealing the card.
        *   `generatePlayerView` (`game-manager.ts`): Updated to send a `HiddenCard` object if `card.isFaceDownToOwner` is true for the viewing player's hand.
    *   **Reinforced "Always Face-Down In Hand" Principle:**
        *   Ensured cards are dealt initially with `isFaceDownToOwner: true` in `initializeNewGame`.
        *   Corrected `handleDeclareReadyForPeek` (initial peek timeout logic) to *not* permanently reveal peeked cards in hand; knowledge is temporary via `cardsToPeek`.
        *   Corrected `handleResolveSpecialAbility` (King/Queen peek confirmation) to *not* permanently reveal self-peeked cards in hand.
        *   Ensured cards swapped into hand via `handleSwapAndDiscard` are set with `isFaceDownToOwner: true`.
*   **Game Rule Verification & Server Logic Alignment (vs. `GAME_OVERVIEW.md`):**
    *   Confirmed card point values in `shared-types` match the overview.
    *   Verified that `setupNextPlayTurn` correctly unseals the discard pile.
    *   Confirmed `handleDrawFromDiscard` correctly prevents drawing special cards (K, Q, J, A) as per overview.
    *   Discussed and clarified the discard pile locking mechanism: locked if top card is special OR if it was placed as a match.
        *   Current server implementation of `topDiscardFlagForClient` in `generatePlayerView` correctly flags special cards and just-matched cards, aligning with this.
*   **UI Fixes:**
    *   **Draw Pile Count Visibility:**
        *   The card count for the draw pile was not showing.
        *   Fixed by adding `z-10` to the `className` of the `div` wrapping the card count display in `frontend/app/components/DrawPileComponent.tsx` to ensure it renders above other pile elements.

*Last Updated: 2025-06-02*

---

## Session Notes (2025-06-02) - UI/UX Refinements & Visual Cues

This session focused on significant UI/UX enhancements, particularly around visual feedback for player actions and game state changes.

*   **Global Ability Target Icons (Peek/Swap):**
    *   **Initial Problem:** Icons for peek/swap abilities were not showing correctly for all players or were persisting incorrectly.
    *   **Fixes (Client & Server):**
        *   Numerous iterations on server-side logic (`server/src/game-manager.ts`) for setting and clearing `globalAbilityTargets` in `ServerCheckGameState`.
        *   Refined `handleResolveSpecialAbility` to manage GATs for peek vs. swap stages, ensuring they are present for the immediate broadcast after an action and correctly cleared by subsequent phase/turn setups.
        *   Added `clearGlobalAbilityTargetsIfNeeded` calls to `handleDrawFromDeck` and `handleDrawFromDiscard` to ensure GATs from previous turns are cleared when a new player starts their draw action.
        *   Updated client-side logic (`frontend/app/components/CheckGameBoard.tsx`) to correctly interpret and display these icons, including hiding them from the player who initiated the ability or just resolved a swap (using `lastPlayerToResolveAbility`).
*   **Empty Pile Styling (Draw & Discard):**
    *   **Problem:** The empty state UI for the discard pile was inconsistent with the draw pile and the overall dark theme.
    *   **Fix (Client - `DiscardPileComponent.tsx`, `DrawPileComponent.tsx`):**
        *   Updated the placeholder for empty discard and draw piles to use a dark theme (`bg-neutral-700`, `text-neutral-300`, `border-neutral-600`).
        *   Removed the redundant "Cards: 0" text from the `DiscardPileComponent` when empty, as the "Empty" placeholder implies this.
*   **Discard Pile Interactivity:**
    *   **Problem:** The "Draw From Discard" action button was clickable even when the discard pile was empty.
    *   **Fix (Client - `CheckGameBoard.tsx`):**
        *   Modified the `canDrawFromDiscard` constant to include a check for `gameState.discardPile.length > 0`, ensuring the action button is disabled if the pile is empty.
*   **Card Selection Restrictions:**
    *   **Problem:** Players could select cards in their hand or opponents' hands even when no relevant action (like an ability or pending swap) was active.
    *   **Fix (Client - `CheckGameBoard.tsx`):**
        *   Removed fallback logic in `handleCardClick` that allowed selecting one's own card for general feedback. Card clicks are now only processed if a specific action context (pending drawn card, matching stage, ability resolution) is active.
*   **Visual Cue for Regular Swaps (Non-Ability):**
    *   **Goal:** Provide a visual highlight on a player's hand to indicate to *other* players which card slot was just affected by a regular swap (drawing a card and swapping it into their hand).
    *   **Implementation:**
        *   **Shared Types (`shared-types/src/index.ts`):**
            *   Added `LastRegularSwapInfo { playerId: string; handIndex: number; timestamp: number; }` interface.
            *   Added `lastRegularSwapInfo: LastRegularSwapInfo | null` to `CheckGameState` and `ClientCheckGameState`.
        *   **Server (`server/src/game-manager.ts`):**
            *   Populated `lastRegularSwapInfo` in `handleSwapAndDiscard` with the `playerId`, `handIndex`, and `Date.now()`.
            *   Added a new helper `clearTransientVisualCues` (which clears `lastRegularSwapInfo`) and called it in phase/turn setup functions (`setupNextPlayTurn`, `setupFinalTurnsPhase`, `setupAbilityResolutionPhase`, `setupScoringPhase`, `continueOrEndFinalTurns`) to ensure the highlight is temporary.
        *   **Client (`PlayerHandComponent.tsx`, `CheckGameBoard.tsx`):**
            *   Passed `gameState.lastRegularSwapInfo` as a prop to `PlayerHandComponent`.
            *   In `PlayerHandComponent`, used `useEffect` to watch for changes to `lastRegularSwapInfo`.
            *   When `lastRegularSwapInfo` updates for the displayed player (and it's not the viewing player), a `highlightedSwapIndex` state is set.
            *   A `setTimeout` clears `highlightedSwapIndex` after 2 seconds, making the highlight temporary.
            *   A `lastProcessedSwapTimestampRef` was added to the `useEffect` to ensure the highlight only triggers for new swap events and not due to unrelated re-renders if `lastRegularSwapInfo` hasn't changed its timestamp.
        *   **Animation:**
            *   The highlighted card slot initially used a yellow ring.
            *   This was enhanced with a Framer Motion animation:
                *   First attempt: A keyframe-based "pulse" for the ring.
                *   Second attempt (current): A "shimmer" or "glint" effect where a semi-transparent white band sweeps across the card. This involves animating the `backgroundPosition` of a `linear-gradient` on a `motion.div`.
*   **Timer Animation Key Fix (`PlayerStatusDisplay.tsx`, `CheckGameBoard.tsx`):**
    *   **Problem:** The progress bar animation for player timers (especially when viewed by an opponent) could be inconsistent or not reset properly due to an incorrect or `undefined` `key` prop (`turnSegmentIdentifier`) on the `motion.div`.
    *   **Fix:** Modified `CheckGameBoard.tsx` to correctly pass the `turnSegmentTrigger` (combined with `visibilityTrigger` from `page.tsx`) as `turnSegmentIdentifier` to the `PlayerStatusDisplay` component for the player whose turn is currently active, regardless of whether it's the viewing player or an opponent. This ensures the animation `key` is always a consistent, defined string, allowing `motion/react` to reliably reset the animation when the key changes (e.g., on turn changes or segment changes).

*Overall, this session involved deep debugging of special ability logic on both client and server, culminating in a critical fix for argument passing on the server, and a separate fix for discard pile ordering to resolve visual inconsistencies.*