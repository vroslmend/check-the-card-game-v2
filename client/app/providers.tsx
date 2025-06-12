'use client';

import { ThemeProvider } from 'next-themes';
import { CursorProvider } from '@/components/providers/CursorProvider';
import CustomCursor from '@/components/ui/CustomCursor';
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { Toaster } from '@/components/ui/sonner';
import { GameUIContext } from '@/context/GameUIContext';
import { type UIMachineInput } from '@/machines/uiMachine';
import { usePathname } from 'next/navigation';
import logger from '@/lib/logger';

// This helper function safely gets the initial input on the client.
const getInitialInput = (pathname: string): UIMachineInput => {
    if (typeof window === 'undefined') return {}; // Guard against server-side execution
    try {
      const playerSessionJSON = sessionStorage.getItem('playerSession');
      if (playerSessionJSON) {
        const session = JSON.parse(playerSessionJSON);
        const gameIdFromUrl = pathname.split('/').pop();
        if (session.gameId && session.playerId && session.gameId === gameIdFromUrl) {
          logger.info({ ...session }, "Providers: Creating actor with REJOIN input.");
          return { gameId: session.gameId, localPlayerId: session.playerId };
        }
      }
      if (pathname.startsWith('/game/')) {
        const gameIdFromUrl = pathname.split('/').pop();
        if (gameIdFromUrl) {
          logger.warn({ gameId: gameIdFromUrl }, "Providers: No session found. Creating actor with PROMPT JOIN input.");
          return { gameId: gameIdFromUrl };
        }
      }
    } catch (e) {
      logger.error({ error: e }, "Error creating initial input in Providers");
    }
    logger.info("Providers: Creating actor with empty input.");
    return {};
};

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Compute the initial input once.
  const initialInput = getInitialInput(pathname);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      {/* The context provider from createActorContext is used here */}
      <GameUIContext.Provider options={{ input: initialInput }}>
        <CursorProvider>
          <SmoothScrollProvider>
            {children}
            <CustomCursor />
          </SmoothScrollProvider>
          <Toaster />
        </CursorProvider>
      </GameUIContext.Provider>
    </ThemeProvider>
  );
}