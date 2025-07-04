"use client";

import { ThemeProvider } from "next-themes";
import { CursorProvider } from "@/components/providers/CursorProvider";
import CustomCursor from "@/components/ui/CustomCursor";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { Toaster } from "@/components/ui/sonner";
import {
  GameUIActorContext,
  type UIMachineActorRef,
} from "@/context/GameUIContext";
import { uiMachine, type UIMachineInput } from "@/machines/uiMachine";
import { usePathname, useRouter } from "next/navigation";
import logger from "@/lib/logger";
import { socket } from "@/lib/socket";
import { useEffect, useRef } from "react";
import { createActor } from "xstate";
import {
  SocketEventName,
  type ClientCheckGameState,
  type PlayerActionType,
} from "shared-types";
import { DeviceProvider } from "@/context/DeviceContext";

// ============================================================================
//  EFFECTS BRIDGE COMPONENT – connects the actor to sockets and routing
// ============================================================================
function UIMachineEffects({ actor }: { actor: UIMachineActorRef }) {
  const router = useRouter();

  useEffect(() => {
    type EmittedEvent = Parameters<Parameters<typeof actor.on>[1]>[0];

    const socketSub = actor.on("EMIT_TO_SOCKET", (emitted: EmittedEvent) => {
      if (emitted.type !== "EMIT_TO_SOCKET") return;
      if (emitted.eventName === SocketEventName.PLAYER_ACTION) {
        socket.emit(
          emitted.eventName,
          emitted.payload as { type: PlayerActionType; payload?: any },
        );
      } else {
        logger.warn(
          { event: emitted },
          "Unhandled socket event emitted from UI machine",
        );
      }
    });

    const navSub = actor.on("NAVIGATE", (event: EmittedEvent) => {
      if (event.type !== "NAVIGATE") return;
      router.push(event.path);
    });

    // Socket → Actor bridges
    const gs = (g: ClientCheckGameState) =>
      actor.send({ type: "CLIENT_GAME_STATE_UPDATED", gameState: g });
    const lg = (m: any) => actor.send({ type: "NEW_GAME_LOG", logMessage: m });
    const cm = (m: any) =>
      actor.send({ type: "NEW_CHAT_MESSAGE", chatMessage: m });
    const pk = (d: { hand: any[] }) =>
      actor.send({ type: "INITIAL_PEEK_INFO", hand: d.hand });
    const pr = (d: any) => actor.send({ type: "ABILITY_PEEK_RESULT", ...d });
    const er = (e: { message: string }) =>
      actor.send({ type: "ERROR_RECEIVED", error: e.message });
    const ce = (err: any) =>
      actor.send({
        type: "CONNECTION_ERROR",
        message: err.message ?? "connection error",
      });
    const il = (l: any[]) =>
      actor.send({ type: "INITIAL_LOGS_RECEIVED", logs: l });
    const onConnect = () =>
      actor.send({
        type: "CONNECT",
        recovered: (socket as { recovered?: boolean }).recovered === true,
      });
    const onDisconnect = () => actor.send({ type: "DISCONNECT" });

    socket.on(SocketEventName.GAME_STATE_UPDATE, gs);
    socket.on(SocketEventName.SERVER_LOG_ENTRY, lg);
    socket.on(SocketEventName.NEW_CHAT_MESSAGE, cm);
    socket.on(SocketEventName.INITIAL_PEEK_INFO, pk);
    socket.on(SocketEventName.ABILITY_PEEK_RESULT, pr);
    socket.on(SocketEventName.ERROR_MESSAGE, er);
    socket.on(SocketEventName.INITIAL_LOGS, il);
    socket.on("connect", onConnect);
    socket.on("connect_error", ce);
    socket.on("disconnect", onDisconnect);

    if (!socket.connected) socket.connect();
    else onConnect();

    // manager-level reconnect failure event (no args)
    const rf = () =>
      actor.send({ type: "CONNECTION_ERROR", message: "reconnection failed" });
    socket.io?.on("reconnect_failed", rf);

    return () => {
      socketSub.unsubscribe();
      navSub.unsubscribe();
      socket.off(SocketEventName.GAME_STATE_UPDATE, gs);
      socket.off(SocketEventName.SERVER_LOG_ENTRY, lg);
      socket.off(SocketEventName.NEW_CHAT_MESSAGE, cm);
      socket.off(SocketEventName.INITIAL_PEEK_INFO, pk);
      socket.off(SocketEventName.ABILITY_PEEK_RESULT, pr);
      socket.off(SocketEventName.ERROR_MESSAGE, er);
      socket.off(SocketEventName.INITIAL_LOGS, il);
      socket.off("connect", onConnect);
      socket.off("connect_error", ce);
      socket.off("disconnect", onDisconnect);
      socket.io?.off("reconnect_failed", rf);
    };
  }, [actor, router]);

  return null;
}

// ============================================================================
//  MAIN PROVIDER COMPONENT – guarantees single actor instance via useRef
// ============================================================================
export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const actorRef = useRef<UIMachineActorRef | null>(null);

  if (actorRef.current === null) {
    const getInitialInput = (): UIMachineInput => {
      let initial: UIMachineInput = {};

      // Capture gameId from URL when landing directly on game page
      if (pathname.startsWith("/game/")) {
        const id = pathname.split("/").pop();
        if (id) initial.gameId = id;
      }

      // Restore session only when we're on a game route; prevents endless
      // re-join attempts from the landing page when the saved game no longer exists.
      if (pathname.startsWith("/game/") && typeof window !== "undefined") {
        try {
          const sessionJSON =
            sessionStorage.getItem("playerSession") ?? // prefer sessionStorage first
            localStorage.getItem("playerSession");
          const session = sessionJSON ? JSON.parse(sessionJSON) : null;
          if (
            session?.playerId &&
            (!initial.gameId || initial.gameId === session.gameId)
          ) {
            initial.localPlayerId = session.playerId;
            if (!initial.gameId) initial.gameId = session.gameId;
          }
        } catch (e) {
          logger.error(
            { error: e },
            "Error reading playerSession from storage",
          );
        }
      }

      logger.info(
        { initial },
        "Creating UI machine actor (singleton via useRef)",
      );
      return initial;
    };

    actorRef.current = createActor(uiMachine, {
      input: getInitialInput(),
    }).start();
  }

  const actor = actorRef.current!;

  // Hydration path removed: we now rely on automatic rejoin for state after refresh

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <DeviceProvider>
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
      </DeviceProvider>
    </ThemeProvider>
  );
}
