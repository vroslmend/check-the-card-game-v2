"use client"

import { motion } from "framer-motion"
import { Clock, Eye, Zap, Trophy, Users, CheckCircle } from "lucide-react"

interface GamePhaseIndicatorProps {
  phase: string
  isPlayerTurn: boolean
  pendingAbility?: any
}

export function GamePhaseIndicator({ phase, isPlayerTurn, pendingAbility }: GamePhaseIndicatorProps) {
  const phaseConfig = {
    initialPeek: {
      icon: Eye,
      label: "Initial Peek",
      description: "Look at your bottom 2 cards",
      color: "text-stone-900 dark:text-stone-100",
    },
    playPhase: {
      icon: Clock,
      label: "Play Phase",
      description: "Draw and discard cards",
      color: "text-stone-900 dark:text-stone-100",
    },
    matchingStage: {
      icon: Users,
      label: "Matching",
      description: "Match the discarded card",
      color: "text-stone-900 dark:text-stone-100",
    },
    abilityResolutionStage: {
      icon: Zap,
      label: "Special Ability",
      description: "Resolve King/Queen/Jack ability",
      color: "text-stone-900 dark:text-stone-100",
    },
    finalTurnsPhase: {
      icon: CheckCircle,
      label: "Final Turns",
      description: "Last chance to improve",
      color: "text-stone-600 dark:text-stone-400",
    },
    scoringPhase: {
      icon: Trophy,
      label: "Scoring",
      description: "Calculating results",
      color: "text-stone-900 dark:text-stone-100",
    },
  }

  const config = phaseConfig[phase] || phaseConfig.playPhase
  const Icon = config.icon

  return (
    <div className="text-right">
      <motion.div
        className="flex items-center justify-end gap-2"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-right">
          <p className="text-xs font-light text-stone-600 dark:text-stone-400">Phase:</p>
          <p className={`text-sm font-light ${config.color}`}>{config.label}</p>
        </div>
        <motion.div
          animate={
            phase === "matchingStage" || phase === "abilityResolutionStage"
              ? {
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1],
                }
              : {}
          }
          transition={{
            duration: 2,
            repeat: phase === "matchingStage" || phase === "abilityResolutionStage" ? Number.POSITIVE_INFINITY : 0,
          }}
        >
          <Icon className={`h-4 w-4 ${config.color}`} />
        </motion.div>
      </motion.div>

      <motion.p
        className={`mt-1 text-xs font-light ${
          isPlayerTurn ? "text-stone-900 dark:text-stone-100" : "text-stone-600 dark:text-stone-400"
        }`}
        animate={isPlayerTurn ? { opacity: [0.7, 1, 0.7] } : {}}
        transition={{ duration: 2, repeat: isPlayerTurn ? Number.POSITIVE_INFINITY : 0 }}
      >
        {isPlayerTurn ? "Your Turn" : "Waiting"}
      </motion.p>

      {pendingAbility && (
        <motion.p
          className="mt-1 text-xs font-light text-stone-900 dark:text-stone-100"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          {pendingAbility.type} Pending
        </motion.p>
      )}

      <p className="mt-1 text-xs font-light text-stone-600 dark:text-stone-400">{config.description}</p>
    </div>
  )
}
