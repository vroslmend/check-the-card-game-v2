"use client"

import { useState, useEffect } from "react"
import { GameScreen } from "@/components/game-ui/GameScreen"

interface GamePageProps {
  params: {
    id: string
  }
}

export default function GamePage({ params }: GamePageProps) {
  const { id } = params
  const [isLoading, setIsLoading] = useState(true)

  // Simulate loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <div className="space-y-4 text-center">
          <div className="text-3xl font-serif font-light tracking-tight">
            <span className="inline-block animate-pulse">Loading Game...</span>
          </div>
          <p className="font-light text-stone-600 dark:text-stone-400">Preparing your experience</p>
        </div>
      </div>
    )
  }

  return <GameScreen gameId={id} />
}
