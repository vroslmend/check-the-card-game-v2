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
import { SocketEventName, type CreateGameResponse } from 'shared-types'
import { toast } from 'sonner'
import { createActor } from 'xstate'
import {
  uiMachine,
  type UIMachineInput,
} from '@/machines/uiMachine'

interface NewGameModalProps {
  isOpen: boolean
  onClose: () => void
}

export function NewGameModal({ isOpen, onClose }: NewGameModalProps) {
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

  // Ensure a player ID exists for reuse.
  useEffect(() => {
    if (!localPlayerId) {
      setLocalPlayerId(nanoid());
    }
  }, [localPlayerId, setLocalPlayerId]);

  const handleCreateGame = () => {
    if (playerName.trim()) {
      setIsLoading(true);
      if (!socket.connected) {
      socket.connect();
    }
      socket.emit(SocketEventName.CREATE_GAME, { name: playerName.trim() }, (response: CreateGameResponse) => {
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
            toast.error(response.message || 'Failed to create game. Please try again.');
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start a New Game">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="player-name">Your Name</Label>
          <Input
            id="player-name"
            placeholder="e.g., John Doe"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="text-base"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && playerName.trim() && !isLoading) {
                handleCreateGame();
              }
            }}
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
            onClick={handleCreateGame}
            disabled={isLoading || !playerName.trim()}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Game"
            )}
          </Button>
        </motion.div>
      </div>
    </Modal>
  )
}