// frontend/app/lib/server-game-exports.ts
// Attempt to import and re-export from the server's compiled output.

// @ts-ignore TS2307: Cannot find module or its corresponding type declarations.
// We use ts-ignore here because TypeScript might still complain about the path
// even if the bundler can resolve it. The real test is if Next.js/Turbopack can bundle it.
import { CheckGame as ActualCheckGame } from 'server-game';

// Re-export with a potentially different name if needed, or the same.
export const CheckGame = ActualCheckGame;

// If the above direct import fails at runtime due to CJS/ESM issues,
// a more robust (but complex) approach for CJS interop might be needed,
// such as dynamically importing or using a require if the context allows,
// though that's harder with Next.js App Router server/client components. 