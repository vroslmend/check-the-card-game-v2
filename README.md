# Check! - Online Multiplayer Card Game

## 🃏 Overview

"Check!" is a web-based, free-to-play online multiplayer card game. The primary goal is to have the lowest total card value in your hand at the end of a round. This project implements the card game with a Node.js/Socket.IO backend and a modern Next.js/React frontend.

This README provides a comprehensive guide to understanding, setting up, and running the project. Detailed documentation, including game rules and architecture, can be found in the `/docs` directory.

## 🚀 Core Objective of the Game

Be the player with the lowest total card value in your hand when a round ends. Aces are low (-1 point), number cards are face value, and J, Q, K are 11, 12, 13 points respectively.

## ✨ Key Game Mechanics

(Refer to the documentation in the `/docs` directory for full details)

*   **Hand Management:** Players manage their cards (initially four) in a conceptual grid, with an initial peek at two of them.
*   **Turn Actions:** Draw from the deck or discard pile, then discard a card by either swapping with a hand card or discarding the drawn card directly.
*   **Matching:** Discarding a card creates an opportunity for any player to match its rank with a card from their hand.
*   **Special Abilities (K, Q, J):** Kings, Queens, and Jacks have unique abilities (peeking at cards, swapping cards) that trigger when discarded or matched as a pair.
*   **"Calling Check":** Players can "Call Check" to signal the final round, or this can occur automatically if a player empties their hand via a match.

## 💻 Technology Stack

This project utilizes a modern technology stack for a robust and interactive experience:

*   **Backend (`server/`):**
    *   Node.js (with native `http` module)
    *   Socket.IO (for WebSocket-based real-time communication)
    *   TypeScript
    *   **XState**: Core game logic, state management, and phase transitions (`game-machine.ts`).
*   **Frontend (`client/`):**
    *   Next.js (latest, using the App Router)
    *   React (latest)
    *   TypeScript
    *   Tailwind CSS (latest, for styling)
    *   **shadcn/ui**: Collection of accessible and customizable UI components, built with Radix UI and Tailwind CSS.
    *   **XState (`@xstate/react`)**: For client-side UI interaction flows, orchestrating complex game actions, and managing all local and server-derived UI state (`uiMachine.ts`).
    *   **Framer Motion**: For all animations, especially `layoutId` for smooth card movements and UI transitions.
    *   Socket.IO Client: For real-time communication with the backend.
*   **Shared Code (`shared-types/`):**
    *   TypeScript types, interfaces, and enums utilized by both `client` and `server` to ensure data consistency and type safety. Key types include `ClientCheckGameState`, `GameMachineContext`, `Card` (with a mandatory `id: string`), `PlayerActionType`, etc.
*   **Development Environment:**
    *   npm for package management in each sub-project.
    *   Hot-reloading for both server and client development.

## 📁 Project Structure (Monorepo)

```
check-the-card-game-v2/
├── client/                 # Next.js Frontend Application
│   ├── app/                # App Router: layouts, pages, global styles
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Client-side utility functions, constants
│   ├── machines/           # XState machines for UI logic
│   ├── public/             # Static assets
│   ├── next.config.ts      # Next.js configuration
│   ├── tsconfig.json       # TypeScript configuration
│   └── package.json        # Dependencies and scripts
├── docs/                   # Project documentation
├── server/                 # Node.js Socket.IO Game Server
│   ├── src/                # TypeScript source files
│   │   ├── index.ts        # Main server entry point, Socket.IO setup
│   │   ├── game-machine.ts # XState machine for core game logic
│   │   ├── state-redactor.ts # Redacts server state for clients
│   │   └── lib/            # Utility functions (e.g., deck-utils.ts)
│   ├── tsconfig.json       # TypeScript configuration
│   └── package.json        # Dependencies and scripts
├── shared-types/           # Shared TypeScript Interfaces & Types
│   ├── src/
│   │   └── index.ts        # Main export for shared types
│   ├── tsconfig.json       # TypeScript configuration
│   └── package.json        # Dependencies and scripts
├── .gitignore
└── README.md               # This file
```

## ✨ Key Architectural Decisions

*   **Server-Authoritative Game State**: The backend `server/` (specifically its XState `game-machine.ts`) is the single source of truth for all game logic and state.
*   **XState for All Client-Side State**: The `client/` uses a single, root XState machine (`uiMachine.ts`) to manage all client-side state. This includes complex UI interaction sequences (e.g., multi-step abilities), orchestrating game actions, and holding the `ClientCheckGameState` received from the server. This provides a robust and centralized state management solution.
*   **Framer Motion for All Animations**: All visual animations, especially card movements (using `layoutId`), transitions, and UI effects, are handled by Framer Motion, driven by states from the `uiMachine`.
*   **shadcn/ui for Core UI Components**: Base UI elements (buttons, modals, inputs) are built using shadcn/ui for speed, consistency, and accessibility, styled with Tailwind CSS.
*   **Robust Error Recovery Mechanism**: Both client and server implement sophisticated error recovery mechanisms using XState's error handling capabilities:
    *   **Server-side**: Handles edge cases like empty deck, disconnections, and other errors with automatic retry and recovery strategies.
    *   **Client-side**: Implements automatic reconnection attempts with configurable parameters and clear user feedback.
    *   **Bidirectional Error Communication**: Errors on either side are properly communicated and logged for debugging.

## ⚙️ Setup and Installation

1.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd check-the-card-game-v2
    ```

2.  **Install Dependencies:**
    From the project root, this command installs all dependencies for the server, client, and shared packages.
    ```bash
    npm install
    ```

3.  **Build All Packages:**
    This command builds all packages in the correct order, ensuring `shared-types` is available for the client and server.
    ```bash
    npm run build
    ```

4.  **Managing UI Components (shadcn/ui):**
    The initial setup is complete. To add *new* `shadcn/ui` components, navigate to the client directory:
    ```bash
    cd client
    npx shadcn@latest add <component_name>
    cd ..
    ```

## ▶️ How to Run the Game

### Development Mode

Run the following command from the project root (`check-the-card-game-v2/`):
```bash
npm run dev
```
*   The server will start on `http://localhost:8000`.
*   The client will start on `http://localhost:3000`.

Access the game by opening your browser to `http://localhost:3000`.

### Production Mode

1.  **Build the Application:**
    From the project root:
    ```bash
    npm run build
    ```

2.  **Start the Production Server:**
    From the project root:
    ```bash
    npm start
    ```
    This command will start both the Next.js frontend and the Node.js backend server.

## 🚀 Deployment

This project is designed for a split deployment:

*   **Frontend (`client`):** Deploy as a Next.js site on **Vercel**.
*   **Backend (`server`):** Deploy as a Node.js Web Service on **Render**.

You will need to set the environment variables in the respective hosting provider's dashboard. The `NEXT_PUBLIC_WEBSOCKET_URL` on Vercel must point to the public URL of your Render service.

## 🔧 Environment Variables

Create `.env` files in the `server` and `client` directories for local development.

*   **Client (`client/.env.local`):**
    *   `NEXT_PUBLIC_WEBSOCKET_URL`: Full URL of the backend Socket.IO server. (Defaults to `http://localhost:8000` for local development).
    *   `NEXT_PUBLIC_MAX_RECONNECT_ATTEMPTS`: Maximum number of client-side reconnection attempts (default: `3`).
    *   `NEXT_PUBLIC_RECONNECT_INTERVAL_MS`: Interval between client-side reconnection attempts in milliseconds (default: `5000`).

*   **Server (`server/.env`):**
    *   `PORT`: Port for the backend server (default: `8000`).
    *   `CORS_ORIGIN`: The client URL for CORS validation (default: `http://localhost:3000`).
    *   `MAX_PLAYERS`: The maximum number of players in a game (default: `4`).
    *   `CARDS_PER_PLAYER`: The number of cards dealt to each player (default: `4`).
    *   `PEEK_DURATION_MS`: Duration of the initial card peek phase in milliseconds (default: `10000`).
    *   `MATCHING_STAGE_DURATION_MS`: Duration of the matching stage in milliseconds (default: `5000`).
    *   `RECONNECT_TIMEOUT_MS`: Timeout for player reconnection attempts in milliseconds (default: `30000`).
    *   `MAX_RETRIES`: Maximum number of retries for server-side error recovery (default: `3`).

### Example Environment Files

**Client `.env.local` Example:**
```
# The full URL of your deployed Node.js backend server.
# For local development, this points to your local server.
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:8000

# --- Error Recovery Configuration ---
# Maximum number of client-side reconnection attempts
NEXT_PUBLIC_MAX_RECONNECT_ATTEMPTS=3
# Interval between client-side reconnection attempts (milliseconds)
NEXT_PUBLIC_RECONNECT_INTERVAL_MS=5000
```

**Server `.env` Example:**
```
# The URL of the client application for Cross-Origin Resource Sharing
CORS_ORIGIN=http://localhost:3000

# The port the server will run on (Render sets this automatically in production)
PORT=8000

# --- Game Rules & Configuration ---
# The maximum number of players allowed in a game.
MAX_PLAYERS=4
# The number of cards dealt to each player at the start of a round.
CARDS_PER_PLAYER=4

# --- Game Pacing (in Milliseconds) ---
# Duration of the initial card peek phase.
PEEK_DURATION_MS=10000
# Duration of the matching stage after a card is discarded.
MATCHING_STAGE_DURATION_MS=5000

# --- Error Recovery Configuration ---
# Timeout for player reconnection attempts (milliseconds)
RECONNECT_TIMEOUT_MS=30000
# Maximum number of retries for server-side recovery
MAX_RETRIES=3
```

## 📝 Current Development Status

*   **Backend Refactor (Completed):** The backend uses XState (`game-machine.ts`) for all authoritative game logic.
*   **Frontend Architecture (Completed):** The frontend has been architected using Next.js, TypeScript, and a single root XState machine (`uiMachine.ts`) for all client-side state orchestration.
*   **Core UI Components (In Progress):** Development is focused on refining UI components, animations, and ensuring all game phases are fully represented in the UI.
*   **Error Recovery (Completed):** Both client and server implement robust error handling and recovery mechanisms using XState's error states and transitions.
*   **Game Logic Testing (Completed):** Comprehensive test suite for the game-machine.ts implementation, verifying behavior against game rules for all core mechanics, special abilities, and error recovery paths. Tests follow XState best practices and behavior-driven development principles.

## 🧪 Testing Approach

This project follows a behavior-driven testing approach:

*   **Test-First Philosophy:** Tests are written against the specification in GAME_RULES.md, not the implementation.
*   **XState Actor Testing:** Tests use XState's actor model to verify state transitions and context updates.
*   **Key Test Areas:** Core game flow, special abilities (K/Q/J), error recovery, edge cases.
*   **Independent Verification:** When discrepancies are found between tests and implementation, the implementation is adjusted to match the expected behavior defined in the tests.

Run the test suite with:
```bash
npm run test
```

---
Happy Gaming and Coding!
