"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function JoinGame() {
  const [gameCode, setGameCode] = useState("")
  const [username, setUsername] = useState("")

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Link>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">Join Game</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter a game code to join an existing game session</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">
              Your Username
            </label>
            <Input
              id="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 rounded-md"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="gameCode" className="text-sm font-medium">
              Game Code
            </label>
            <Input
              id="gameCode"
              placeholder="Enter game code"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value)}
              className="h-12 rounded-md"
            />
          </div>
          <Button className="h-12 w-full rounded-md">Join Game</Button>
        </div>
      </div>
    </div>
  )
}
