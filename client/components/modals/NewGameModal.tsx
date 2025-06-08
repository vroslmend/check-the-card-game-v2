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

interface NewGameModalProps {
  isOpen: boolean
  onClose: () => void
}

export function NewGameModal({ isOpen, onClose }: NewGameModalProps) {
  const [username, setUsername] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const emit = useGameStore((state) => state.emit)
  const gameId = useGameStore((state) => state.gameId)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      toast.error("Username Required", {
        description: "Please enter a name to create a game.",
      })
      return
    }
    setIsLoading(true)

    const playerSetupData: Pick<InitialPlayerSetupData, "name"> = {
      name: username,
    }

    emit(
      SocketEventName.CREATE_GAME,
      playerSetupData,
      (response: { success: boolean; gameId?: string; error?: string }) => {
        setIsLoading(false)
        if (response.success && response.gameId) {
          router.push(`/game/${response.gameId}`)
          onClose()
        } else {
          toast.error("Failed to Create Game", {
            description: response.error || "An unknown error occurred.",
          })
        }
      }
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Game"
      description="Enter your name to get started."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="username-new">Username</Label>
          <Input
            id="username-new"
            placeholder="Your display name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Game & Enter Lobby"}
        </Button>
      </form>
    </Modal>
  )
}