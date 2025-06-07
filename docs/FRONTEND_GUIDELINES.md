# Frontend Development Guidelines for "Check!"

This document serves as the authoritative guide and source of truth for the frontend development of the "Check!" card game. Its purpose is to ensure consistency, clarity, and adherence to the established architectural and design decisions.

## 1. Core Philosophy & Design System: "Structural Minimalism"

Our aesthetic is inspired by austere, typography-driven editorial design. The experience is not just 'minimal', it is structural, confident in its use of negative space, and relies on a strong grid and typography as the primary design elements.

### 1.1. Visual Identity

-   **Color Palette:** The UI is strictly monochromatic, using a sophisticated off-white/off-black palette. A single vibrant accent color is used extremely sparingly for focus states. All colors are defined as HSL variables in `client/app/globals.css`.

    -   **Light Theme (Default):**
        -   `--background`: A soft, light gray (`hsl(0 0% 98%)`).
        -   `--foreground`: A dark, desaturated gray (`hsl(240 10% 9%)`).
        -   `--muted-foreground`: Lighter gray for secondary text (`hsl(240 3.8% 46.1%)`).
        -   `--border`: Subtle border for dividers/inputs (`hsl(240 5.9% 90%)`).

    -   **Dark Theme:**
        -   `--background`: A rich, near-black (`hsl(0 0% 9%)`).
        -   `--foreground`: Off-white text (`hsl(0 0% 98%)`).
        -   `--muted-foreground`: Lower-contrast gray for secondary text (`hsl(0 0% 63.9%)`).
        -   `--border`: Subtle dark border (`hsl(0 0% 14.9%)`).

    -   **Shared Colors:**
        -   `--primary` (Accent): A vibrant, clean blue (`hsl(200 98% 45%)`). Used almost exclusively for input focus rings.
        -   `--destructive`: A muted, desaturated red (`hsl(0 72% 51%)`).

-   **Typography:** We use `Geist Sans` and `Geist Mono`. Hierarchy is created through size, weight, and layout position, not color.
    -   **Headings:** `Geist Sans`, `font-bold`.
    -   **Body/UI Text:** `Geist Sans`, `font-normal`.
    -   **Labels/IDs:** `Geist Mono`, often decorated with brackets (e.g., `[Info]`).

-   **Iconography:** `lucide-react` is the sole icon library. Icons are used rarely, as typography and layout should carry the design.

-   **Spacing:** Generous and consistent whitespace is mandatory.

### 1.2. Component Design

-   **Cards (`CardDisplay.tsx`):**
    -   **Appearance:** Typographic. A simple `bg-card` surface with a subtle `border`.
    -   **Content:** Rank and Suit are represented by text and simple glyphs.
    -   **Selection State:** Indicated by a `ring-primary` "halo".

-   **Buttons:** UI "chrome" is avoided. Buttons are presented as plain text.
    -   **Style:** Use `variant="ghost"` or `variant="link"`.
    -   **Aesthetic:** Manually add brackets to the button text (e.g., `[Create Game]`) to define them as interactive elements. Do not rely on background colors or heavy borders.

---

## 2. Layout Architecture

The application uses distinct, full-screen layouts for its primary views.

### 2.1. Landing Page (`/`)

-   **Structure:** A vertical Flexbox layout (`flex flex-col min-h-screen`) that treats the entire viewport as a single canvas.
    -   **Header:** A simple, full-width row with the site title on the left and info links on the right.
    -   **Main (`flex-grow`):** The central area, vertically and horizontally centered. Contains the primary user flow (name input, game actions).
    -   **Footer:** A simple, full-width row with secondary links pushed to the corners.

### 2.2. Game Screen (`/game/[gameId]`) - "Player-Centric" Cockpit View

The game screen is structured to prioritize the local player's experience.

-   **`GameScreen` Container:** The root container uses a vertical Flexbox layout (`flex flex-col h-screen`). It is divided into three sections:

    1.  **Opponent Area (Top, `flex-grow`):** Contains `PlayerPod` components for all opponents.
    2.  **Table Area (Middle, `flex-shrink-0`):** A fixed-height container that holds the `Deck` and `DiscardPile`.
    3.  **Local Player Area (Bottom, `flex-shrink-0`):** The primary interaction "cockpit" containing the player's `HandGrid` and contextual `ActionBar`.

-   **`PlayerPod`:** Represents a player's "seat". Displays name, status, and face-down cards.

-   **`SidePanel` (Log & Chat):** A collapsible panel anchored to the side, containing tabs for the Game Log and Chat Box.

---

## 3. State Management & Data Flow

The frontend has a clear, unidirectional data flow.

-   **Zustand (`/store/gameStore.ts`):**
    -   The client-side cache for all data pushed from the server.
    -   Holds `ClientCheckGameState`, game logs, and chat messages.
    -   **Contains the `socketMiddleware`, which encapsulates all `socket.io-client` logic.** The rest of the app is completely decoupled from the raw socket instance.

-   **XState (`/machines/uiMachine.ts`):**
    -   The **brain** of the frontend UI. It orchestrates all user interaction flows, manages complex UI state (e.g., multi-step abilities, selection states), and dictates when to communicate with the server.
    -   It does **not** hold core game state data; it reads that from the Zustand store.

-   **Data Flow (Client -> Server):**
    1.  A UI component (`Button`) sends a simple event to the `uiMachine` (e.g., `DRAW_CLICKED`).
    2.  The `uiMachine` processes this, and if a server action is needed, it emits an `EMIT_TO_SOCKET` event containing the action name and payload.
    3.  The `UIMachineProvider` is listening for these emitted events and calls the `emit` function from the `useGameStore` hook.
    4.  The `socketMiddleware` in the Zustand store executes the actual `socket.emit()`.

-   **Data Flow (Server -> Client):**
    1.  The `socketMiddleware` has listeners (`socket.on(...)`) for server broadcasts like `gameStateUpdate`.
    2.  When an event is received, the middleware's listener directly calls a setter action in the Zustand store (e.g., `setGameState(data)`).
    3.  UI components are subscribed to the Zustand store and re-render automatically when the data changes.

---

## 4. Animation Philosophy

Animations are key to the "flair" in our minimalist design. They must be **subtle, purposeful, and fluid.**

-   **Technology:** **Framer Motion** is the exclusive library for all animations.
-   **Layout Animations:** The highest priority. Card movements (deck-to-hand, hand-to-discard) **must** use `layoutId` to create a seamless visual transition, not just a fade-out/fade-in.
-   **Enter/Exit Animations:** UI elements (like the `ActionBar`) should gently fade and slide into view.
-   **Micro-interactions:** Interactive elements must have hover (`scale-105`) and press (`scale-95`) effects.
-   **Staggering:** Group animations, like dealing cards, should use `staggerChildren` for a satisfying, cascading effect.

---

## 5. Development Rules

-   **Styling:** All styling must be done with **Tailwind CSS utility classes** in JSX. No new `.css` files should be created. Use the `cn` utility for conditional classes.
-   **Stateless Components:** Components should be as stateless as possible. UI logic belongs in the `uiMachine`, and server data belongs in the `gameStore`.
-   **Code Location:** Adhere to the existing directory structure (`/components`, `/machines`, `/store`, etc.).
-   **Commitment to the Plan:** All future development must adhere to the principles outlined in this document. 