'use client';

import { ThemeProvider } from 'next-themes';
import { CursorProvider } from '@/components/providers/CursorProvider';
import CustomCursor from '@/components/ui/CustomCursor';
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { Toaster } from '@/components/ui/sonner';
import { GameUIActorContext, type UIMachineActorRef } from '@/context/GameUIContext';
import { uiMachine, type UIMachineInput } from '@/machines/uiMachine';
import { usePathname, useRouter } from 'next/navigation';
import logger from '@/lib/logger';
import { socket } from '@/lib/socket';
import { useEffect, useState } from 'react';
import { createActor } from 'xstate';
import { SocketEventName } from 'shared-types';

// The getInitialInput function remains unchanged and is correct.
const getInitialInput = (pathname: string): UIMachineInput => {
    if (typeof window === 'undefined') return {}; 
    try {
        const playerSessionJSON = sessionStorage.getItem('playerSession');
        const initialGameStateJSON = sessionStorage.getItem('initialGameState');
        
        const session = playerSessionJSON ? JSON.parse(playerSessionJSON) : null;
        const initialGameState = initialGameStateJSON ? JSON.parse(initialGameStateJSON) : null;
        const gameIdFromUrl = pathname.split('/').pop();
        
        if (session?.gameId && session?.playerId && initialGameState && session.gameId === gameIdFromUrl) {
            logger.info({ ...session }, "Providers: Will create actor with HYDRATION input.");
            return { 
                gameId: session.gameId, 
                localPlayerId: session.playerId, 
                initialGameState: initialGameState 
            };
        }
        
        if (session?.gameId && session?.playerId && session.gameId === gameIdFromUrl) {
            logger.info({ ...session }, "Providers: Will create actor with REJOIN input.");
            return { gameId: session.gameId, localPlayerId: session.playerId };
        }

        if (pathname.startsWith('/game/')) {
            if (gameIdFromUrl) {
                logger.warn({ gameId: gameIdFromUrl }, "Providers: Will create actor with PROMPT JOIN input.");
                return { gameId: gameIdFromUrl };
            }
        }
    } catch (e) {
        logger.error({ error: e }, "Error creating initial input in Providers");
    }
    
    logger.info("Providers: Will create actor with empty input.");
    return {};
};

function UIMachineEffects({ actor }: { actor: UIMachineActorRef }) {
  const router = useRouter();

  useEffect(() => {
    // Get the full type of the machine's emitted events for strong typing
    type EmittedEvent = Parameters<Parameters<UIMachineActorRef['on']>[1]>[0];

    const socketSubscription = actor.on('EMIT_TO_SOCKET', (emitted: EmittedEvent) => {
      // The `emitted` parameter is now strongly typed
      if (emitted.type !== 'EMIT_TO_SOCKET') return;
      
      const { eventName, payload, ack } = emitted;
      
      if (eventName === SocketEventName.JOIN_GAME && Array.isArray(payload)) {
          socket.emit(eventName, ...payload, ack as any);
          return;
      }
      
      switch (eventName) {
        case SocketEventName.CREATE_GAME:
        case SocketEventName.ATTEMPT_REJOIN:
          if (ack) {
            socket.emit(eventName, payload as any, ack as any);
          } else {
             logger.error({ eventName }, "Socket event expected ack, but none was provided.");
          }
          break;
        case SocketEventName.PLAYER_ACTION:
        case SocketEventName.SEND_CHAT_MESSAGE:
          socket.emit(eventName, payload as any);
          break;
        default:
          logger.warn({ eventName }, 'Unhandled socket event emitted from UI machine');
      }
    });

    const navigationSubscription = actor.on('NAVIGATE', (event: EmittedEvent) => {
        // The `event` parameter is now strongly typed
        if(event.type !== 'NAVIGATE') return;
        router.push(event.path);
    });

    return () => {
      socketSubscription.unsubscribe();
      navigationSubscription.unsubscribe();
    };
  }, [actor, router]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [actor, setActor] = useState<UIMachineActorRef | null>(null);

  useEffect(() => {
    const input = getInitialInput(pathname);
    const newActor = createActor(uiMachine, { input });
    setActor(newActor);
    newActor.start();
    return () => { newActor.stop(); };
  }, [pathname]);

  if (!actor) {
    return null;
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <GameUIActorContext.Provider value={actor}>
        <UIMachineEffects actor={actor} />
        <CursorProvider>
          <SmoothScrollProvider>
            {children}
            <CustomCursor />
          </SmoothScrollProvider>
          <Toaster />
        </CursorProvider>
      </GameUIActorContext.Provider>
    </ThemeProvider>
  );
}