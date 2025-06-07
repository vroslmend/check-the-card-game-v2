"use client"

import { motion } from "framer-motion"
import { PlayerPod } from "./PlayerPod"

interface Player {
  id: string
  name: string
  handSize: number
  isActive: boolean
  status: "waiting" | "playing" | "checking" | "folded"
}

interface OpponentAreaProps {
  players: Player[]
  currentPlayerId: string
}

export function OpponentArea({ players, currentPlayerId }: OpponentAreaProps) {
  const opponents = players.filter((p) => p.id !== "local")

  return (
    <div className="flex h-full items-center justify-center">
      <motion.div
        className="flex flex-wrap items-center justify-center gap-8"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1,
              delayChildren: 0.2,
            },
          },
        }}
      >
        {opponents.map((player, index) => (
          <motion.div
            key={player.id}
            variants={{
              hidden: { opacity: 0, y: -20, scale: 0.9 },
              visible: { opacity: 1, y: 0, scale: 1 },
            }}
            transition={{ duration: 0.4, type: "spring", stiffness: 100 }}
          >
            <PlayerPod player={player} isCurrentPlayer={player.id === currentPlayerId} position={index} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
