"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MessageSquare, Settings, Users } from "lucide-react"
import Link from "next/link"
import ThemeToggle from "./ThemeToggle"

interface GameHeaderProps {
  gameId: string
  onToggleSidePanel: () => void
  sidePanelOpen: boolean
}

export function GameHeader({ gameId, onToggleSidePanel, sidePanelOpen }: GameHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex h-24 items-center justify-between border-b border-stone-200/50 bg-stone-50/80 px-6 backdrop-blur-sm dark:border-stone-800/50 dark:bg-zinc-950/80"
    >
      <div className="flex items-center gap-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 font-sans text-sm font-light">
            <ArrowLeft className="h-4 w-4" />
            Exit Game
          </Button>
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-2xl font-serif font-light tracking-tight">Check</span>
          <span className="text-xs text-stone-600 dark:text-stone-400">{gameId.slice(0, 8)}...</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidePanel}
          className={`text-sm font-light transition-colors ${
            sidePanelOpen
              ? "bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100"
              : "text-stone-600 dark:text-stone-400"
          }`}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          Activity
        </Button>

        <Button variant="ghost" size="sm" className="text-sm font-light text-stone-600 dark:text-stone-400">
          <Users className="mr-2 h-4 w-4" />
          Players
        </Button>

        <Button variant="ghost" size="sm" className="text-sm font-light text-stone-600 dark:text-stone-400">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>

        <ThemeToggle />
      </div>
    </motion.header>
  )
} 