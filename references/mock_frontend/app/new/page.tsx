"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export default function NewGame() {
  const [username, setUsername] = useState("")

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Link>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">Create New Game</h1>
          <p className="mt-2 text-sm text-muted-foreground">Set up your game preferences</p>
        </div>
        <div className="space-y-6">
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
            <label htmlFor="gameMode" className="text-sm font-medium">
              Game Mode
            </label>
            <Select defaultValue="standard">
              <SelectTrigger id="gameMode" className="h-12 rounded-md">
                <SelectValue placeholder="Select game mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="blitz">Blitz</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="players" className="text-sm font-medium">
              Max Players
            </label>
            <Select defaultValue="4">
              <SelectTrigger id="players" className="h-12 rounded-md">
                <SelectValue placeholder="Select max players" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 Players</SelectItem>
                <SelectItem value="4">4 Players</SelectItem>
                <SelectItem value="6">6 Players</SelectItem>
                <SelectItem value="8">8 Players</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="private" className="text-sm font-medium">
              Private Game
            </Label>
            <Switch id="private" />
          </div>

          <Button className="h-12 w-full rounded-md">Create Game</Button>
        </div>
      </div>
    </div>
  )
}
