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
    *   **Zustand**: For managing the global store of server-sent data (`ClientCheckGameState`, game logs, chat messages).
    *   **XState (`@xstate/react`)**: For client-side UI interaction flows, orchestrating complex game actions, and managing local UI state (`uiMachine.ts`).
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
│   ├── store/              # Zustand global state store
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
*   **Zustand for Server Data**: The `client/` uses a Zustand store to hold the `ClientCheckGameState`, game logs, and chat messages received from the server. This provides an efficient, global, and reactive way for components to access this data.
*   **XState for UI Orchestration**: A client-side XState machine (`uiMachine.ts`) manages complex UI interaction sequences (e.g., multi-step abilities) and orchestrates game actions. It does *not* duplicate game logic but reacts to server state changes and user inputs to manage the UI flow.
*   **Framer Motion for All Animations**: All visual animations, especially card movements (using `layoutId`), transitions, and UI effects, are handled by Framer Motion, driven by states from the `uiMachine` and data from the Zustand store.
*   **shadcn/ui for Core UI Components**: Base UI elements (buttons, modals, inputs) are built using shadcn/ui for speed, consistency, and accessibility, styled with Tailwind CSS.

## ⚙️ Setup and Installation

1.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd check-the-card-game-v2
    ```

2.  **Install All Dependencies:**
    From the project root:
    ```bash
    npm install
    ```

3.  **Build All Packages:**
    It's crucial to build `shared-types` first. The root build script handles this order. From the project root:
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

### Development Mode (For Coding)

1.  **Start Both Server and Client:**
    From the project root (`check-the-card-game-v2/`):
    ```bash
    npm run dev
    ```
    *   Server starts on `http://localhost:8000`.
    *   Client starts on `http://localhost:3000`.

2.  **Access the Game:**
    Open your browser to `http://localhost:3000`.

### Production Mode (After Building)

1.  **Build the Application:**
    From the project root:
    ```bash
    npm run build
    ```

2.  **Start the Production Server:**
    ```bash
    npm start
    ```

## 🔧 Environment Variables

It's recommended to create `.env` files in the `server` and `client` directories for local development.

*   **Client (`client/.env.local`):**
    *   `NEXT_PUBLIC_WEBSOCKET_URL`: URL for the backend Socket.IO server (defaults to `http://localhost:8000` if not set).

*   **Server (`server/.env`):**
    *   `PORT`: Port for the backend server (defaults to `8000`).
    *   `CORS_ORIGIN`: Allowed origin for CORS (defaults to `http://localhost:3000`).
    *   `PEEK_DURATION_MS`: Duration of initial peek phase in milliseconds (default: `10000`).
    *   `TURN_DURATION_MS`: Duration of a player's turn timer in milliseconds (default: `30000`).
    *   `MATCHING_STAGE_DURATION_MS`: Duration of the matching stage in milliseconds (default: `5000`).
    *   `DISCONNECT_GRACE_PERIOD_MS`: Time before a disconnected player is removed (default: `60000`).

## 📝 Current Development Status

*   **Backend Refactor (Completed):** The backend uses XState (`game-machine.ts`) for all authoritative game logic.
*   **Frontend Architecture (Completed):** The frontend has been architected using Next.js, TypeScript, Zustand for server state, and XState (`uiMachine.ts`) for UI orchestration.
*   **Core UI Components (In Progress):** Development is focused on refining UI components, animations, and ensuring all game phases are fully represented in the UI.

---
Happy Gaming and Coding!
