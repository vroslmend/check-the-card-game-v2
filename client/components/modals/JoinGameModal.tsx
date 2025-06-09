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
import { toast } from "sonner"
import { Loader } from "lucide-react"

interface JoinGameModalProps {
  isOpen: boolean
  onClose: () => void
}

export function JoinGameModal({ isOpen, onClose }: JoinGameModalProps) {
  const router = useRouter()
  const [playerName, setPlayerName] = useLocalStorage("playerName", "", {
    serializer: (value) => value,
    deserializer: (value) => value,
  })
  const [localPlayerId, setLocalPlayerId] = useLocalStorage<string | null>('localPlayerId', null, {
    serializer: (value) => value ?? '',
    deserializer: (value) => value,
  });
  const [gameIdToJoin, setGameIdToJoin] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Ensure a player ID exists on component mount if one isn't already there.
  useEffect(() => {
    if (!localPlayerId) {
      setLocalPlayerId(nanoid());
    }
  }, [localPlayerId, setLocalPlayerId]);

  const handleJoinGame = async () => {
    if (!playerName.trim()) {
      toast.error("Please enter your name.")
      return
    }
    if (!localPlayerId) {
      toast.error("Player ID could not be generated. Please try again.")
      return
    }
    if (!gameIdToJoin.trim() || gameIdToJoin.trim().length !== 6) {
      toast.error("Please enter a valid 6-character Game ID.")
      return
    }

    setIsLoading(true)
    
    // The player ID is now retrieved from localStorage, ensuring persistence.
    // The UIMachineProvider will use this ID to initialize and attempt a rejoin if applicable.
    router.push(`/game/${gameIdToJoin.trim()}`)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Join an Existing Game">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="player-name-join">Your Name</Label>
          <Input
            id="player-name-join"
            placeholder="e.g., Jane Smith"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="game-id">Game ID</Label>
          <Input
            id="game-id"
            placeholder="Enter 6-character ID"
            value={gameIdToJoin}
            onChange={(e) => setGameIdToJoin(e.target.value)}
            maxLength={6}
            className="font-mono text-base tracking-widest"
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
            disabled={isLoading || !playerName.trim() || !gameIdToJoin.trim() || !localPlayerId}
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