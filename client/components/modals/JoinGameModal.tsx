"use client"

import { useState } from "react"
import { useGameStore } from "@/store/gameStore"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Modal } from "../ui/Modal"

interface JoinGameModalProps {
  isOpen: boolean
  onClose: () => void
}

export function JoinGameModal({ isOpen, onClose }: JoinGameModalProps) {
  const [username, setUsername] = useState("")
  const [gameIdToJoin, setGameIdToJoin] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { joinGame } = useGameStore()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      toast.error("Username Required", {
        description: "Please enter a name to join a game.",
      })
      return
    }
    if (!gameIdToJoin.trim()) {
      toast.error("Game ID Required", {
        description: "Please enter a Game ID to join.",
      })
      return
    }
    setIsLoading(true)

    try {
      const success = await joinGame(gameIdToJoin, username)
      if (success) {
        toast.success("Joined Game!", {
          description: `You are now entering lobby ${gameIdToJoin}.`,
        })
        router.push(`/game/${gameIdToJoin}`)
        onClose()
      }
      // Note: The joinGame function in the store should handle errors and show toasts.
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Join Existing Game"
      description="Enter your name and the lobby ID to join your friends."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="username-join">Your Name</Label>
          <Input
            id="username-join"
            placeholder="Enter your display name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="gameId-join">Lobby ID</Label>
          <Input
            id="gameId-join"
            placeholder="Enter lobby ID from a friend"
            value={gameIdToJoin}
            onChange={(e) => setGameIdToJoin(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Joining Lobby..." : "Join & Enter"}
        </Button>
      </form>
    </Modal>
  )
} 