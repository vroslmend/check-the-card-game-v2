# Check! - The Online Multiplayer Card Game

## 🃏 Overview

"Check!" is a web-based, free-to-play online multiplayer card game. The primary goal is to have the lowest total card value in your hand at the end of a round. This project is an implementation of the card game featuring real-time multiplayer gameplay.

The detailed game rules, mechanics, and ongoing development notes can be found in `PROJECT_NOTES.md`.

## 🚀 Core Objective of the Game

Be the player with the lowest total card value in your hand when a round ends. Aces are low (-1 point), number cards are face value, and J, Q, K are 11, 12, 13 points respectively.

## ✨ Key Game Mechanics

*   **2x2 Hand Grid:** Players manage four cards in a 2x2 grid, initially peeking at two.
*   **Draw & Swap/Discard:** Players draw from a deck or discard pile, then swap a card from their hand into the discard pile, or discard the drawn card directly.
*   **Matching Opportunity:** Discarding a card creates an opportunity for *any* player to match its rank with a card from their hand.
*   **Special Cards (K, Q, J):** These cards have abilities (peek, swap cards) when discarded or as part of a matched pair.
*   **LIFO Ability Resolution:** If a special card is matched with another special card, their abilities trigger in Last-In, First-Out order.
*   **Calling "Check":** Players can "Call Check" to initiate the end of the round, or it can happen automatically if a player empties their hand via a match. Other players get one final turn.

## 💻 Technology Stack

*   **Frontend:** Next.js 15.x (App Router), React, TypeScript, Tailwind CSS (implicitly via `globals.css` and Next.js conventions)
*   **Backend:** Node.js, TypeScript, `boardgame.io` (for game logic and state management)
*   **Shared Code:** TypeScript types compiled to CommonJS, shared between frontend and backend.
*   **Real-time Communication:** `Socket.IO` (managed by `boardgame.io`)
*   **Package Manager:** npm (for each sub-project)

## 📁 Project Structure

The project is organized into three main sub-directories:

*   `frontend/`: Contains the Next.js client-side application.
*   `server/`: Contains the Node.js `boardgame.io` game server.
*   `shared-types/`: Contains TypeScript type definitions used by both the frontend and server.

```
check-the-card-game-v2/
├── frontend/               # Next.js UI
│   ├── app/
│   ├── components/
│   ├── public/
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── package.json
├── server/                 # boardgame.io game server
│   ├── src/
│   │   ├── game-definition.ts  # Core game logic exported for client
│   │   └── server.ts           # Server setup
│   ├── dist/                 # Compiled server code
│   ├── tsconfig.json
│   └── package.json
├── shared-types/           # Shared TypeScript interfaces
│   ├── src/
│   │   └── index.ts
│   ├── dist/                 # Compiled shared types (CommonJS)
│   ├── tsconfig.json
│   └── package.json
├── .gitignore
├── PROJECT_NOTES.md        # Detailed developer notes and game rules
└── README.md               # This file
```

## ⚙️ Setup and Installation

You'll need to install dependencies for each sub-project (`shared-types`, `server`, `frontend`).

1.  **Clone the repository (if you haven't already):**
    ```bash
    git clone <repository-url>
    cd check-the-card-game-v2
    ```

2.  **Install Dependencies for `shared-types`:**
    ```bash
    cd shared-types
    npm install
    npm run build # Compile types to dist/
    cd ..
    ```

3.  **Install Dependencies for `server`:**
    ```bash
    cd server
    npm install
    # The server imports from shared-types/dist, ensure it's built first.
    cd ..
    ```

4.  **Install Dependencies for `frontend`:**
    ```bash
    cd frontend
    npm install
    # The frontend imports from server/dist, ensure it's built first (for server-game alias).
    cd ..
    ```

## ▶️ How to Run the Game

1.  **Build `shared-types` (if not already done or if changed):**
    ```bash
    cd shared-types
    npm run build
    cd ..
    ```

2.  **Build `server` (if not already done or if changed):**
    This step compiles the server TypeScript to JavaScript in `server/dist/`, which is then used by the `server-game` alias in the frontend.
    ```bash
    cd server
    npm run build
    cd ..
    ```

3.  **Start the Game Server:**
    ```bash
    cd server
    npm start  # Typically runs node dist/server.js or similar via package.json script
    cd ..
    ```
    The server will usually start on `localhost:8000`.

4.  **Start the Frontend Development Server:**
    Open a new terminal for this step.
    *   **Using Webpack (recommended for stability with current alias setup):**
        ```bash
        cd frontend
        npm run dev:webpack  # Assuming you have 'npx next dev' as dev:webpack
        # Or directly: npx next dev
        ```
    *   **Using Turbopack (experimental, ensure `next.config.ts` is configured):**
        ```bash
        cd frontend
        npm run dev # Assuming this is 'next dev --turbopack'
        ```
    The frontend will usually be available at `localhost:3000`. Open this address in your browser. You should see two player views and a spectator view connecting to the game server.

## 📝 Current Status (High-Level)

*   **Core Game Logic:** Largely complete on the server using `boardgame.io`, including complex turn structures, matching, and special card abilities with LIFO resolution.
*   **Server & Shared Types:** Build systems in place, and modules are correctly resolved.
*   **Frontend UI:**
    *   Basic Next.js application structure with `boardgame.io` client integration.
    *   Client connects to the server and renders multiple player perspectives.
    *   Reusable UI components for Cards, Player Hands, Draw Pile, and Discard Pile have been created.
    *   The main `CheckGameBoard.tsx` component has been significantly enhanced to display the game visually and handle basic interactions and game phases.
*   **Build/Bundling:** Next.js frontend successfully imports server-side game logic using path aliases with both Webpack and Turbopack (with minor Turbopack warnings).

For a detailed breakdown, see the "✅ What is DONE" and "⏳ What is LEFT" sections in `PROJECT_NOTES.md`.

## 🎯 Next Steps / Future Goals

*   **Refine Frontend Interactivity:** Fully implement UI for all game actions, especially complex special card abilities.
*   **Visual Polish:** Enhance styling and overall user experience.
*   **Game Messages/Log:** Add a clear log of game events.
*   **Thorough Testing:** Conduct extensive playtesting of all game phases and interactions.
*   (Optional) User authentication, lobbies, multi-round game sessions, leaderboards.

---

This `README.md` provides a starting point. Feel free to expand it as the project evolves! 