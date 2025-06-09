"use client"

import { useState } from "react"
import { useGameStore } from "@/store/gameStore"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Modal } from "../ui/Modal"
import { motion } from "framer-motion"
import Magnetic from "../ui/Magnetic"

interface JoinGameModalProps {
  isOpen: boolean
  onClose: () => void
}

export function JoinGameModal({ isOpen, onClose }: JoinGameModalProps) {
  const [username, setUsername] = useState("")
  const [gameIdToJoin, setGameIdToJoin] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const joinGame = useGameStore((state) => state.joinGame)
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
      } else {
        toast.error("Failed to Join Game", {
          description: "Please check the Lobby ID and try again.",
        })
      }
    } catch (error) {
      toast.error("Failed to Join Game", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      })
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="username-join" className="font-light text-stone-600 dark:text-stone-400 pl-2">Your Name</Label>
          <Input
            id="username-join"
            placeholder="Enter your display name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-full border-stone-200/50 bg-white/50 px-5 py-6 text-lg backdrop-blur-sm dark:border-stone-800/50 dark:bg-stone-900/50"
            autoFocus
            data-cursor-text
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="gameId-join" className="font-light text-stone-600 dark:text-stone-400 pl-2">Lobby ID</Label>
          <Input
            id="gameId-join"
            placeholder="Enter lobby ID from a friend"
            value={gameIdToJoin}
            onChange={(e) => setGameIdToJoin(e.target.value)}
            className="rounded-full border-stone-200/50 bg-white/50 px-5 py-6 text-lg backdrop-blur-sm dark:border-stone-800/50 dark:bg-stone-900/50"
            data-cursor-text
          />
        </div>
        <Magnetic>
          <motion.div
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <Button
              type="submit"
              disabled={isLoading}
              size="lg"
              className="w-full rounded-full bg-stone-900 px-8 py-7 text-lg font-light text-white shadow-lg transition-all duration-300 hover:shadow-2xl dark:bg-stone-100 dark:text-stone-900"
            >
              {isLoading ? "Joining Lobby..." : "Join & Enter"}
            </Button>
          </motion.div>
        </Magnetic>
      </form>
    </Modal>
  )
} 