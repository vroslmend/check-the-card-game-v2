# Check! - Online Multiplayer Card Game

## 🃏 Overview

"Check!" is a web-based, free-to-play online multiplayer card game. The primary goal is to have the lowest total card value in your hand at the end of a round. This project is an implementation of the card game featuring real-time multiplayer gameplay using a Node.js/Socket.IO backend and a Next.js/React frontend.

This README provides a comprehensive guide to understanding, setting up, and running the project. For detailed game rules, refer to `GAME_OVERVIEW.md`. For a chronological log of development changes and specific bug fixes, see `PROJECT_NOTES.md`.

## 🚀 Core Objective of the Game

Be the player with the lowest total card value in your hand when a round ends. Aces are low (-1 point), number cards are face value, and J, Q, K are 11, 12, 13 points respectively.

## ✨ Key Game Mechanics

(Refer to `GAME_OVERVIEW.md` for full details)

*   **Hand Management:** Players manage their cards (initially four) in a conceptual grid, with an initial peek at two of them.
*   **Turn Actions:** Draw from the deck or discard pile, then discard a card by either swapping with a hand card or discarding the drawn card directly.
*   **Matching:** Discarding a card creates an opportunity for any player to match its rank with a card from their hand.
*   **Special Abilities (K, Q, J):** Kings, Queens, and Jacks have unique abilities (peeking at cards, swapping cards) that trigger when discarded or matched as a pair. These abilities can be multi-stage and include options to skip stages.
*   **"Calling Check":** Players can manually "Call Check" to signal the final round of turns, or this can occur automatically if a player empties their hand through a successful match.

## 💻 Technology Stack

*   **Frontend:**
    *   Next.js (using the App Router)
    *   React
    *   TypeScript
    *   Tailwind CSS (for styling and UI components)
    *   Socket.IO Client (for real-time communication with the backend)
*   **Backend:**
    *   Node.js (with native `http` module for server creation)
    *   Socket.IO (for WebSocket-based real-time communication)
    *   TypeScript
*   **Shared Code:**
    *   TypeScript types and interfaces located in the `shared-types/` directory, utilized by both frontend and backend to ensure data consistency.
*   **Development Environment:**
    *   npm (Node Package Manager) for managing dependencies and running scripts in each sub-project (`frontend/`, `server/`, `shared-types/`).
    *   Hot-reloading enabled for both server and frontend development.

## 📁 Project Structure

```
check-the-card-game-v2/
├── frontend/               # Next.js UI Application
│   ├── app/                # App Router: layouts, pages, components
│   │   ├── layout.tsx      # Root layout, font & global styles setup
│   │   ├── page.tsx        # Main landing/lobby page, hosts game client
│   │   └── components/     # Reusable React components (GameBoard, Card, etc.)
│   ├── public/             # Static assets (e.g., favicon)
│   ├── next.config.ts      # Next.js configuration
│   ├── tsconfig.json       # TypeScript configuration for frontend
│   └── package.json        # Frontend dependencies and scripts
├── server/                 # Node.js Socket.IO Game Server
│   ├── src/                # TypeScript source files for the server
│   │   ├── index.ts        # Main server entry point, Socket.IO setup, event handlers
│   │   └── game-manager.ts # Core game logic, state management, phase transitions
│   ├── tsconfig.json       # TypeScript configuration for server
│   ├── package.json        # Server dependencies and scripts
│   └── dist/               # (Generated on build) Compiled JavaScript output
├── shared-types/           # Shared TypeScript Interfaces & Types
│   ├── src/
│   │   └── index.ts        # Main export for shared types
│   ├── tsconfig.json       # TypeScript configuration for shared types
│   ├── package.json        # Shared-types dependencies (e.g., typescript itself)
│   └── dist/               # (Generated on build) Compiled JavaScript output (e.g., for CommonJS compatibility if needed)
├── .gitignore
├── GAME_OVERVIEW.md        # Authoritative game rules and mechanics
├── PROJECT_NOTES.md        # Detailed developer log: features, changes, bug fixes
└── README.md               # This file: Project overview and setup guide
```

## ⚙️ Setup and Installation

Follow these steps to set up the project locally.

1.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd check-the-card-game-v2
    ```

2.  **Install Dependencies and Build `shared-types`:**
    This package contains TypeScript definitions crucial for both frontend and backend. Building it ensures type consistency.
    ```bash
    cd shared-types
    npm install
    npm run build # This usually runs `tsc` to compile TypeScript.
    cd ..
    ```

3.  **Install Dependencies and Build the Backend Server:**
    The server needs its dependencies and to be compiled from TypeScript to JavaScript for production or if not using a TS-aware runner like `ts-node` for development.
    ```bash
    cd server
    npm install
    npm run build # Compiles TypeScript to `dist/` folder. For dev, `npm run dev` often handles this via `ts-node-dev` or similar.
    cd ..
    ```

4.  **Install Dependencies for the Frontend Application:**
    ```bash
    cd frontend
    npm install
    # For development (`npm run dev`), Next.js handles compilation. For production, `npm run build` is used.
    cd ..
    ```

## ▶️ How to Run the Game

### Development Mode (Recommended for Local Development)

1.  **Start the Backend Server:**
    Ensure `shared-types` has been built at least once.
    ```bash
    cd server
    npm run dev
    ```
    The server will typically start on `http://localhost:8000`. Monitor the console for the exact port and status messages.

2.  **Start the Frontend Application:**
    In a **new terminal window/tab**, ensure `shared-types` has been built at least once.
    ```bash
    cd frontend
    npm run dev
    ```
    The frontend development server will usually be available at `http://localhost:3000`.

3.  **Access the Game:**
    Open your web browser and navigate to `http://localhost:3000`. You should see the game's main page, where you can create a new game or join an existing one using a Game ID.

### Production-Like Run (Conceptual)

For a more production-like setup (actual deployment may vary based on hosting provider):

1.  **Build All Parts:** Ensure all packages are built.
    ```bash
    cd shared-types && npm run build && cd ..
    cd server && npm run build && cd ..
    cd frontend && npm run build && cd ..
    ```
2.  **Run the Compiled Server:**
    The `server/package.json` should have a `start` script that runs the compiled JavaScript from its `dist/` folder (e.g., `node dist/index.js`).
    ```bash
    cd server
    npm start
    ```
3.  **Serve the Frontend Build:**
    The `frontend/package.json` should have a `start` script that serves the optimized Next.js build.
    ```bash
    cd frontend
    npm start
    ```

## 📝 Development Status & Key Features

*   **Socket.IO Refactor:** The project has been successfully refactored from `boardgame.io` to a custom Node.js/Socket.IO backend, enabling more direct control over real-time communication and game state management.
*   **Core Gameplay Implemented:**
    *   Multiplayer game room creation and joining.
    *   Card dealing, drawing from deck/discard, and discarding with swap.
    *   Matching mechanics for card ranks.
    *   Special card abilities (K, Q, J) with multi-stage resolution (peek & swap) and skip options.
    *   "Call Check" functionality and final turns phase.
    *   End-of-round scoring and winner determination.
    *   Display of final hands at game end.
*   **User Interface:**
    *   Responsive game board display using React and Tailwind CSS.
    *   Client-side state management for UI interactivity.
    *   Visual feedback for game phases, player turns, and card states (including discard pile lock nuances).
    *   End-of-game modal displaying scores and final hands, with a "Play Again" (return to lobby) button.
    *   Revamped lobby/main page UI with improved aesthetics (Plus Jakarta Sans font).
*   **Session Management:** Basic client-side session persistence and reconnection attempts.
*   **Code Quality:** TypeScript used across frontend, backend, and shared types for improved maintainability and type safety.

## 🔧 Environment Variables

*   **Frontend:** The frontend can be configured to connect to a different server URL by setting the `NEXT_PUBLIC_SERVER_URL` environment variable (e.g., in a `.env.local` file in the `frontend` directory). If not set, it defaults to `http://localhost:8000`.
*   **Backend:** The server listens on port 8000 by default. This can be configured via the `PORT` environment variable.

## ☁️ Deployment Considerations

*   **Socket.IO Server Hosting:** If deploying to platforms like Vercel (which have limitations with persistent WebSocket connections on serverless functions), the Socket.IO server will likely need to be hosted separately on a platform that supports long-running Node.js applications (e.g., Heroku, DigitalOcean, AWS EC2/ECS, a dedicated Node.js hosting service).
*   **Frontend Hosting:** The Next.js frontend can be deployed to Vercel, Netlify, or any other platform that supports Next.js applications. Ensure the `NEXT_PUBLIC_SERVER_URL` environment variable is correctly set to point to the deployed Socket.IO server.

## 🎯 Next Steps / Future Goals

*   Comprehensive testing of all game mechanics and edge cases, particularly around multi-player interactions and ability resolutions.
*   Enhanced visual polish, animations (e.g., card movements), and sound effects for a more immersive experience.
*   More robust error handling and user feedback mechanisms across the application.
*   Potential features: persistent player accounts/profiles, leaderboards, game variations/custom rules, AI opponents, improved spectator mode.

---
Happy Gaming and Coding!