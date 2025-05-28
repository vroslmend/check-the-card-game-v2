# Project AI Notes: "Check" - Online Multiplayer Card Game

## Current Status: What is Done & What is Left

### ✅ What is DONE
- Project structure: `frontend/`, `server/`, `shared-types/`
- TypeScript project references and runtime type sharing (with module-alias)
- Shared types for cards, player state, and game state
- Deck shuffling and initial deal
- Initial peek phase (each player peeks at two cards)
- Main play phase:
  - Drawing from deck or discard pile
  - Swapping drawn card into hand or discarding it
  - Enforcing that only cards drawn from the deck can be discarded immediately
  - Tracking pending drawn card and its source
- Special card abilities (K/Q/J):
  - When discarded, ability is triggered and must be resolved before turn ends
  - Client calls `resolveSpecialAbility` with arguments (peek targets, swap targets)
  - Server validates, performs swap, discards the special card, and ends the turn
  - Peeking is handled client-side but validated by the server
  - If a K/Q/J is drawn, the player may swap it into their hand (no ability triggered) or discard it immediately (ability is triggered)
- Stacking special abilities:
  - Allow consecutive discards of matching K/Q/J, with abilities resolved in reverse order (LIFO)
  - Track stacks with `specialAbilityStack` and `stackActive` in game state
  - Out-of-turn stacking through `stackSpecialCard` move
  - Validate matching rank for stacking
  - Resolve abilities in LIFO order using `resolveStack`
- Quick action (matching card discard):
  - Allow out-of-turn matching discards to form pairs
  - 5-second window for quick actions after each non-special card discard
  - Penalties (draw a card) for incorrect attempts
  - Automatic "Check" trigger when a player's hand is emptied via quick action
- Documentation: PROJECT_AI_NOTES.md is up to date with all rules, implementation details, and lessons learned

### ⏳ What is LEFT
- Calling "Check" and end-of-round: allow a player to call "Check" to end the round, lock their hand, and trigger final turns for others
- Scoring: reveal all cards, calculate scores, and determine the winner at the end of the round
- Player locking: lock a player's hand after calling "Check" or discarding all cards
- Expand types to track locked hands, player scores, and round/phase status as needed
- Frontend: connect to server, display game state, handle user actions, show peeks/swaps/abilities, UI for quick action and special abilities
- CORS configuration for server (for frontend connection)
- (Optional) User authentication, lobbies, persistent leaderboards

## Game Rules & Mechanics (Authoritative Overview)

**Object:** Be the player with the lowest total card value at the end of the round.

**Deck:** Standard 52-card deck (no Jokers).

**Setup:**
- Shuffle the deck.
- Deal four cards face down to each player.
- Each player secretly looks at only two of their four cards and memorizes them. These cards remain face down and hidden until the end of the round, unless a special ability reveals them.

**Gameplay:**
- Turns proceed in a chosen direction.
- On your turn, you must do one of the following:

### 1. Draw a Card
- **From Draw Pile (Face Down):**
  - Draw the top card (unknown).
  - You may:
    - **Replace:** Swap the drawn card with one of your face-down cards. Place the replaced card face up on the Discard Pile.
    - **Discard:** Immediately discard the drawn card face up (no swap).
    - **Play a Special Card:** If the drawn card is a King, Queen, or Jack, you may immediately use its special ability (see below) and then discard it face up. You do not need to replace a card from your hand in this case.
- **From Discard Pile (Face Up):**
  - Take the top card of the Discard Pile and exchange it for one of your face-down cards. Place the replaced card face up on the Discard Pile. (You cannot simply discard it.)

### 2. Matching Card Discard (Quick Action, Out-of-Turn)
- If the top card of the Discard Pile matches a card in your hand, you may immediately discard the matching card on top, creating a pair.
- Only the first player to do so succeeds; others must return their cards.
- Incorrect discards (non-matching) result in a penalty: draw one card from the Draw Pile.

### Special Card Abilities (K/Q/J, activated upon discarding/playing):
- **King (13):** Look at any two cards of any player and swap the position of any one card with any other card of any player (any combination).
- **Queen (12):** Look at any one card of any player and swap the position of any one card with any other card of any player (any combination).
- **Jack (11):** Swap the position of any one card with any other card of any player (any combination).

**Stacking Special Abilities and Matching Pairs:**
- If a Special Card is discarded, other players can discard matching Special Cards from their hand on top of it.
- When multiple matching Special Cards are discarded consecutively, their abilities are resolved in reverse order of discard (last in, first out).
- If a Special Card ability allows you to look at a card and you find a matching Special Card in your hand, you may immediately discard it, triggering its ability as well (stacking in a single turn).
- Once a K/Q/J has been discarded and its ability used, it cannot be drawn from the Discard Pile.

### Ending the Round (Calling "Check")
- On your turn, you may call "Check" if you believe you have the lowest total. This ends your turn and initiates the final round (all other players get one last turn). Your hand is locked after calling Check.
- If you discard all your cards (via matching discards or abilities), this also counts as calling Check and initiates the final round.

### Scoring
- After the final round, all players reveal their cards. Players may have different numbers of cards due to discards/penalties.
- Number cards (2-10): face value. Jack: 11, Queen: 12, King: 13, Ace: -1.
- Lowest total wins the round.

**Key Points:**
- Memorize your initial two cards carefully.
- Different rules for drawing from deck vs. discard pile.
- Use Special Card abilities and quick actions strategically.
- Calling Check locks your hand.
- Lowest score wins.

## 1. Project Overview

**Goal:** Develop a web-based, free-to-play online multiplayer card game called "Check."

**Core Objective of "Check":** Be the player with the lowest total card value at the end of the round.

**Key Game Mechanics:**
*   Standard 52-card deck.
*   Specific card values for scoring (Ace: -1, 2-10: face value, J: 11, Q: 12, K: 13).
*   4 cards per player, initially face-down. Players don't know their own cards initially.
*   **Initial Peek:** One-time look at two of their own four cards.
*   **Turn:** Draw (from Draw Pile or Discard Pile), then Discard.
*   **Special Abilities (on K, Q, J discard):**
    *   **King (K):** Peek 2 cards (anywhere), Swap 1 of own cards with 1 opponent card.
    *   **Queen (Q):** Peek 1 card (anywhere), Swap any 1 card with any other 1 card.
    *   **Jack (J):** Swap positions of any two cards on the field.
*   **Calling "Check":** Ends the round after all other players take one final turn.
*   **"Quick Action" Discard:** Out-of-turn play if a discarded card forms a rank-pair with the previous discard top, or if the discard itself could start a pair. Reduces hand size. Locked pairs on discard.
*   **Empty Hand Win (via Quick Action):** Auto-checks, player scores 0.

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
    *   Managing "Quick Action" and multi-step abilities.

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
*   **Next.js Frontend:** `frontend/` directory created and Next.js initialized.
*   **Server Backend:** `server/` directory created. Setup pending.
*   **Shared Types Package:** `shared-types/` directory created. Initial types (`Suit`, `Rank`, `Card`) defined and compiled. `package.json` configured with `main` and `types` fields.
*   **Build System:** `next build` for `frontend/`. `npm run build` (using `tsc`) for `server/` and `shared-types/`.
*   **Real-time Framework Choice:** `boardgame.io` chosen and successfully set up in `server/`.
    *   `Server` imported from `'boardgame.io/server'. `Game` and `Ctx` imported from `'boardgame.io'.
    *   Initial game state (`CheckGameState`), player state (`PlayerState`), and basic `setup` (deck creation, shuffle using `random.Die`, dealing cards, initializing `hasUsedInitialPeek`) and `moves` (placeholder `drawCard`) defined.
    *   Initial phase structure (`initialPeekPhase`, `playPhase`) established.
    *   TypeScript type issues for `Server` import and `random` API usage resolved.
*   **TypeScript Project References:** Configured between `frontend/`, `server/`, and `shared-types/`. `server/tsconfig.json` uses `paths` alias for `shared-types`.

## 4. Challenges & Solutions Discussed

*   **Hidden Information:** Server holds all truth; client receives tailored state. `boardgame.io` `playerView` is a good fit.
*   **"Quick Action" Mechanic:** Event-driven approach with a short reaction window. `boardgame.io` stages/events can manage this.
*   **Multi-Step Abilities (K, Q, J):** Mini state machines or phases within a turn. `boardgame.io` stages are suitable.
*   **Cost-Effectiveness:** Focus on free/low-cost tiers for hosting (Vercel/Netlify for frontend, Render/Fly.io for backend, Firebase/Supabase for DB).
*   **Build Issues:** 
    *   Resolved `pnpm` installation and network issues by switching to `npm` workspaces.
    *   Addressed `MODULE_NOT_FOUND` for `next` in `apps/frontend` by cleaning `node_modules` and reinstalling.
    *   Fixed TypeScript project reference errors (`TS6310: referenced project may not disable emit` and `TS2307: Cannot find module`) by ensuring `composite: true`, `noEmit: false` in the referenced package, and using `tsc -b` for the server build. (Note: This was for the old monorepo structure, but principles apply to current project references).
    *   Resolved persistent TypeScript errors in `server/src/index.ts` for `boardgame.io` integration:
        *   `Cannot use namespace 'Server' as a value`: Fixed by importing `Server` specifically from `'boardgame.io/server'` and `Game`/`Ctx` from the main `'boardgame.io'` entry point.
        *   Type errors with `random.D6` (later `random.Die`): Fixed by using `random.Die()` and providing a structural type for the `random` parameter in the `setup` function: `({ random }: { random: { Die: (sides: number) => number; Shuffle: <T>(deck: T[]) => T[]; [key: string]: any; } })`.

## 5. Next Immediate Steps (as of last interaction)

1.  ~~Initialize `shared-types/` as a TypeScript project.~~ (DONE)
2.  ~~Initialize `server/` as a Node.js/TypeScript project.~~ (DONE)
3.  ~~Configure TypeScript project references so `frontend/` and `server/` can consume types from `shared-types/`.~~ (DONE)
4.  ~~Define initial types (`Suit`, `Rank`, `Card`, `PlayerState`, `CheckGameState`) in `shared-types/` .~~ (DONE)
5.  ~~Set up `boardgame.io` in `server/` (basic game object, server instance, player setup, initial phase structure).~~ (DONE)
6.  Implement the `performPeek` move in `server/src/index.ts`:
    *   Define the move logic.
    *   Restrict it to `initialPeekPhase`.
    *   Update `PlayerState.hasUsedInitialPeek`.
    *   Plan for client-side temporary reveal of peeked cards.
7.  Expand further core game logic in `server/` using `boardgame.io` features:
    *   Implement game phases (e.g., initial peek, main play, final turns after "Check") fully.
8.  Define more detailed game state interfaces in `shared-types/` (e.g., `Player`, more comprehensive `GameState` reflecting face-down/face-up cards, player scores, current turn, phase, etc.).
9.  Establish basic WebSocket communication and rendering in `frontend/`:
    *   Install `boardgame.io` client library.
    *   Create a basic game client component.
    *   Connect to the `boardgame.io` server.
    *   Display basic game state (e.g., deck size, current player).

## 6. AI Assistant Instructions

*   Refer to this document for context on project history, architecture, and decisions.
*   Help maintain this document by suggesting updates as new features are added or decisions change.
*   When providing code or making changes, consider the revised project structure (separate folders) and chosen technologies.
*   Prioritize `boardgame.io` for backend solutions unless otherwise specified by the user.
*   Ensure TypeScript best practices and type safety.
*   Be mindful of the cost-effective development goal.

## 7. Shared Types Integration (Runtime) - Lessons Learned

**Problem:**
- Node.js server could not resolve the `shared-types` package at runtime, resulting in `MODULE_NOT_FOUND` errors.
- Even after using `module-alias`, errors persisted due to incorrect alias paths and module format mismatches.

**Solution:**
- Use the `module-alias` package in `server/src/index.ts` to register the alias before any imports:
  ```ts
  import moduleAlias from 'module-alias';
  import path from 'path';
  // Correct path for runtime: from server/dist to shared-types/dist/index.js
  const sharedTypesPath = path.resolve(__dirname, '../../shared-types/dist/index.js');
  moduleAlias.addAlias('shared-types', sharedTypesPath);
  ```
- Ensure the `shared-types` package compiles to CommonJS (not ESNext) in `shared-types/tsconfig.json`:
  ```json
  "module": "CommonJS"
  ```
- Rebuild `shared-types` after changing the module type.
- Remove any `_moduleAliases` section from `server/package.json` to avoid conflicts.

**Troubleshooting:**
- If you see `Cannot find module ...shared-types/dist/index.js`, double-check the alias path. From `server/dist`, the correct relative path is `../../shared-types/dist/index.js`.
- If you see `SyntaxError: Unexpected token 'export'`, your `shared-types` is being compiled as an ES module. Change to CommonJS and rebuild.
- Always run `npm run build` in both `shared-types` and `server` after making changes.

## 8. Main Play Phase: Draw/Swap/Discard Logic

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

## 9. Draw/Discard Rule Enforcement (Implementation)

- The server now tracks both the pending drawn card and its source (deck or discard pile) in PlayerState.
- Only allows discarding a drawn card if it was drawn from the deck (not the discard pile).
- Both fields are cleared after a swap or discard.
- This enforces the main draw/discard rules as described in the authoritative game overview.

**Next up:** Implementing special card abilities (K/Q/J logic and stacking).

## 10. Special Card Abilities (K/Q/J) Implementation

- When a King, Queen, or Jack is discarded (by any means), its special ability is triggered and must be resolved before the turn ends.
- The client calls `resolveSpecialAbility` with arguments specifying which cards to peek at (for K/Q) and which two cards to swap (for K/Q/J).
- The server validates the arguments, performs the swap, discards the special card, and ends the turn.
- Peeking is handled client-side for UI/UX, but the server enforces the correct number of peeks.
- If a K/Q/J is drawn, the player may swap it into their hand (no ability triggered) or discard it immediately (ability is triggered).

**Next up:** Stacking (consecutive special card discards), quick action, or other advanced features.

## 11. Special Ability Stacking Implementation

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

**Next Steps:**
- Implement quick action (matching card discard) feature
- Add frontend UI for stacking interaction
- Test edge cases and concurrent stack operations

## 12. Quick Action Implementation

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
  - Window timing accuracy
  - Penalty card application

---
*Last Updated: 2024-07-28* 