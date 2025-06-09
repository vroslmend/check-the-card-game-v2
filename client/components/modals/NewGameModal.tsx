"use client"

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from "react"
import { useLocalStorage } from "usehooks-ts"
import { nanoid } from "nanoid"
import { motion } from "framer-motion"
import { socket } from '@/lib/socket'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/Modal"
import { toast } from "sonner"
import { Loader } from "lucide-react"
import { type CreateGameResponse, type InitialPlayerSetupData } from 'shared-types'

interface NewGameModalProps {
  isOpen: boolean
  onClose: () => void
}

export function NewGameModal({ isOpen, onClose }: NewGameModalProps) {
  const router = useRouter()
  const [playerName, setPlayerName] = useLocalStorage("playerName", "", {
    serializer: (value) => value,
    deserializer: (value) => value,
  })
  const [localPlayerId, setLocalPlayerId] = useLocalStorage<string | null>('localPlayerId', null, {
    serializer: (value) => value ?? '',
    deserializer: (value) => value,
  });
  const [isLoading, setIsLoading] = useState(false)
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  // Ensure a player ID exists on component mount if one isn't already there.
  useEffect(() => {
    if (!localPlayerId) {
      setLocalPlayerId(nanoid());
    }
  }, [localPlayerId, setLocalPlayerId]);

  // Manually connect the shared socket when the modal is open
  useEffect(() => {
    if (isOpen) {
      socket.connect();
    }
    return () => {
        // Disconnect when modal closes or we navigate away, but only if we are not in the process of creating a game.
        if (!isLoadingRef.current) {
            socket.disconnect();
        }
    }
  }, [isOpen]);


  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      toast.error("Please enter your name.")
      return
    }
    if (!localPlayerId) {
      toast.error("Player ID could not be generated. Please try again.")
      return
    }

    setIsLoading(true)

    const playerSetupData: InitialPlayerSetupData = {
      id: localPlayerId,
      name: playerName.trim(),
    };

    socket.emit('CREATE_GAME', playerSetupData, (response: CreateGameResponse) => {
        if (response.success && response.gameId) {
            toast.success(`Game ${response.gameId} created! Joining now...`);
            router.push(`/game/${response.gameId}`);
        } else {
            toast.error(response.message || 'Failed to create game. Please try again.');
            setIsLoading(false);
        }
    });
  }

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