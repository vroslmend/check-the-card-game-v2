"use client"

import { motion } from "framer-motion"
import { PlayerPod } from "./PlayerPod"
import { ClientPlayerState } from "shared-types"

interface OpponentAreaProps {
  players: { id: string, player: ClientPlayerState }[];
  currentPlayerId: string;
}

export function OpponentArea({ players, currentPlayerId }: OpponentAreaProps) {
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
        {players.map(({ id, player }, index) => (
          <motion.div
            key={id}
            variants={{
              hidden: { opacity: 0, y: -20, scale: 0.9 },
              visible: { opacity: 1, y: 0, scale: 1 },
            }}
            transition={{ duration: 0.4, type: "spring", stiffness: 100 }}
          >
            <PlayerPod 
              player={player} 
              playerId={id} 
              isCurrentPlayer={id === currentPlayerId} 
              position={index} 
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
} 