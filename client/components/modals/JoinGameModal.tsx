"use client"

import { useRouter } from 'next/navigation'
import { useState, useEffect } from "react"
import { useLocalStorage } from "usehooks-ts"
import { nanoid } from "nanoid"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/Modal"
import { Loader } from "lucide-react"
import { socket } from '@/lib/socket'
import { SocketEventName, type JoinGameResponse } from 'shared-types'
import { toast } from 'sonner'
import { createActor } from 'xstate'
import {
  uiMachine,
  type UIMachineInput,
} from '@/machines/uiMachine'

interface JoinGameModalProps {
  isOpen: boolean
  onClose: () => void
}

export function JoinGameModal({ isOpen, onClose }: JoinGameModalProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false);
  const [playerName, setPlayerName] = useLocalStorage("playerName", "", {
    serializer: v => v,
    deserializer: v => v,
  });
  const [localPlayerId, setLocalPlayerId] = useLocalStorage<string | null>(
    "localPlayerId",
    null,
    {
      serializer: v => (v === null ? "%%NULL%%" : v),
      deserializer: v => (v === "%%NULL%%" ? null : v),
    },
  );
  const [gameId, setGameId] = useState("");

  // Ensure a player ID exists for reuse.
  useEffect(() => {
    if (!localPlayerId) {
      setLocalPlayerId(nanoid());
    }
  }, [localPlayerId, setLocalPlayerId]);

  const handleJoinGame = () => {
    if (playerName.trim() && gameId.trim()) {
      setIsLoading(true);
      if (!socket.connected) {
        socket.connect();
      }
      socket.emit(SocketEventName.JOIN_GAME, { name: playerName.trim(), gameId: gameId.trim() }, (response: JoinGameResponse) => {
        setIsLoading(false);
        if (response.success && response.gameId && response.playerId && response.gameState) {
            const tempActor = createActor(uiMachine, {
              input: {
                gameId: response.gameId,
                localPlayerId: response.playerId,
                gameState: response.gameState,
              } as UIMachineInput,
            });

            // Get the official, serializable snapshot.
            const persistedState = tempActor.getPersistedSnapshot();

            sessionStorage.setItem('localPlayerId', response.playerId);
            sessionStorage.setItem('initialGameState', JSON.stringify(persistedState));
            router.push(`/game/${response.gameId}`);
        } else {
            toast.error(response.message || 'Failed to join game. Please try again.');
        }
      });
    }
  };

  // Cleanup socket connection on modal close/unmount
  useEffect(() => {
    return () => {
        // The UIMachineProvider on the game page will handle disconnection.
    }
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && playerName.trim() && gameId.trim() && !isLoading) {
      handleJoinGame();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Join an Existing Game">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="player-name">Your Name</Label>
          <Input
            id="player-name"
            placeholder="e.g., Jane Doe"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="text-base"
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="game-id">Game ID</Label>
          <Input
            id="game-id"
            placeholder="Enter the game ID"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="text-base"
            onKeyDown={onKeyDown}
          />
        </div>
        <motion.div
          className="flex justify-end pt-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <Button
            size="lg"
            onClick={handleJoinGame}
            disabled={isLoading || !playerName.trim() || !gameId.trim()}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              "Join Game"
            )}
          </Button>
        </motion.div>
      </div>
    </Modal>
  )
}