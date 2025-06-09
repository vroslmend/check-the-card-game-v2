"use client"

import { useEffect, useState } from "react"
import { useGameStore } from "@/store/gameStore"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { useRouter } from "next/navigation"
import { SocketEventName, type InitialPlayerSetupData } from "shared-types"
import { toast } from "sonner"
import { Modal } from "../ui/Modal"
import { motion } from "framer-motion"
import Magnetic from "../ui/Magnetic"

interface NewGameModalProps {
  isOpen: boolean
  onClose: () => void
}

export function NewGameModal({ isOpen, onClose }: NewGameModalProps) {
  const [username, setUsername] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const createGame = useGameStore((state) => state.createGame)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      toast.error("Username Required", {
        description: "Please enter a name to create a game.",
      })
      return
    }
    setIsLoading(true)

    try {
      const newGameId = await createGame(username)
      if (newGameId) {
        router.push(`/game/${newGameId}`)
        onClose()
      } else {
        toast.error("Failed to Create Game", {
          description: "An unknown error occurred.",
        })
      }
    } catch (error) {
      toast.error("Failed to Create Game", {
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
      title="Create New Game"
      description="Enter your name to get started."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="username-new" className="font-light text-stone-600 dark:text-stone-400 pl-2">Username</Label>
          <Input
            id="username-new"
            placeholder="Your display name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-full border-stone-200/50 bg-white/50 px-5 py-6 text-lg backdrop-blur-sm dark:border-stone-800/50 dark:bg-stone-900/50"
            autoFocus
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
              {isLoading ? "Creating..." : "Create Game & Enter Lobby"}
            </Button>
          </motion.div>
        </Magnetic>
      </form>
    </Modal>
  )
}