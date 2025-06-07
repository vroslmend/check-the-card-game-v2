"use client"

import { motion } from "framer-motion"
import { useEffect, useRef } from "react"

interface LogEntry {
  id: string
  timestamp: string
  type: "game" | "player" | "system"
  message: string
  player?: string
}

interface GameLogProps {
  entries: LogEntry[]
}

export function GameLog({ entries }: GameLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries])

  const getEntryStyle = (type: string) => {
    switch (type) {
      case "game":
        return "text-stone-900 dark:text-stone-100"
      case "player":
        return "text-stone-700 dark:text-stone-300"
      case "system":
        return "text-stone-600 dark:text-stone-400"
      default:
        return "text-stone-700 dark:text-stone-300"
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-stone-200/50 dark:border-stone-800/50">
        <h3 className="text-lg font-serif font-light">Game Activity</h3>
        <p className="text-sm font-light text-stone-600 dark:text-stone-400">{entries.length} entries</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm font-light text-stone-600 dark:text-stone-400">No activity yet</p>
          </div>
        ) : (
          entries.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.02 }}
              className="space-y-1"
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="text-stone-500 dark:text-stone-500">{entry.timestamp}</span>
                {entry.player && <span className="text-stone-600 dark:text-stone-400">{entry.player}</span>}
              </div>
              <p className={`text-sm font-light ${getEntryStyle(entry.type)}`}>{entry.message}</p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
