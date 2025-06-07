"use client"

import { cn } from "@/lib/utils"

import { motion } from "framer-motion"
import { CardBack } from "../ui/CardBack"
import { Crown, Clock, CheckCircle, XCircle, Pause } from "lucide-react"
import { ClientPlayerState } from "shared-types"

interface PlayerPodProps {
  player: ClientPlayerState;
  playerId: string;
  isCurrentPlayer: boolean;
  position: number;
}

export function PlayerPod({ player, playerId, isCurrentPlayer, position }: PlayerPodProps) {
  const statusConfig = {
    waiting: {
      color: "text-stone-600 dark:text-stone-400",
      label: "Waiting",
      icon: Pause,
      bgColor: "bg-stone-100/20 dark:bg-stone-900/20",
    },
    playing: {
      color: "text-stone-900 dark:text-stone-100",
      label: "Playing",
      icon: Clock,
      bgColor: "bg-stone-50 dark:bg-stone-900",
    },
    checking: {
      color: "text-stone-900 dark:text-stone-100",
      label: "Check!",
      icon: CheckCircle,
      bgColor: "bg-stone-900/10 dark:bg-stone-100/10",
    },
    folded: {
      color: "text-stone-600 dark:text-stone-400",
      label: "Folded",
      icon: XCircle,
      bgColor: "bg-stone-200/10 dark:bg-stone-800/10",
    },
  }

  const status = player.hasCalledCheck ? "checking" : "playing"; // This will need to be mapped to our actual player status from the game state
  const config = statusConfig[status];
  const StatusIcon = config.icon

  return (
    <motion.div
      className="relative"
      whileHover={{ scale: 1.02, y: -2 }}
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: position * 0.1,
        type: "spring",
        stiffness: 150,
      }}
    >
      <div
        className={cn(
          "flex min-w-[140px] flex-col items-center space-y-3 rounded-lg border border-stone-200/50 p-4 transition-all duration-300 dark:border-stone-800/50",
          config.bgColor,
          isCurrentPlayer && "ring-2 ring-stone-900/30 dark:ring-stone-100/30",
        )}
      >
        {/* Player Name & Status */}
        <div className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-2">
            {isCurrentPlayer && (
              <motion.div
                animate={{
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              >
                <Crown className="h-4 w-4 text-stone-900 dark:text-stone-100" />
              </motion.div>
            )}
            <span className="font-serif text-sm font-light">{player.name}</span>
          </div>

          <div className="flex items-center justify-center gap-1">
            <motion.div
              animate={
                status === "playing"
                  ? {
                      rotate: 360,
                      scale: [1, 1.2, 1],
                    }
                  : status === "checking"
                    ? {
                        scale: [1, 1.3, 1],
                      }
                    : {}
              }
              transition={{
                duration: status === "playing" ? 2 : 1,
                repeat: status === "playing" || status === "checking" ? Number.POSITIVE_INFINITY : 0,
              }}
            >
              <StatusIcon className={`h-3 w-3 ${config.color}`} />
            </motion.div>
            <span className={`text-xs font-light ${config.color}`}>{config.label}</span>
          </div>
        </div>

        {/* Hand Cards */}
        <div className="relative">
          <motion.div
            className="flex gap-1"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.05,
                },
              },
            }}
          >
            {Array.from({ length: Math.min(player.hand.length, 5) }, (_, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, scale: 0.8, rotate: -20 },
                  visible: {
                    opacity: 1,
                    scale: 1,
                    rotate: (i - 2) * 4,
                    x: i * -3,
                  },
                }}
                transition={{
                  duration: 0.4,
                  type: "spring",
                  stiffness: 150,
                  damping: 12,
                }}
                whileHover={{
                  scale: 1.1,
                  rotate: 0,
                  x: 0,
                  zIndex: 10,
                  transition: { duration: 0.2 },
                }}
              >
                <CardBack size="sm" layoutId={`opponent-${playerId}-card-${i}`} />
              </motion.div>
            ))}
          </motion.div>

          {/* Card Count Indicator */}
          {player.hand.length > 5 && (
            <motion.span
              className="absolute -right-2 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-stone-100 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-400"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              +{player.hand.length - 5}
            </motion.span>
          )}
        </div>

        {/* Current Player Pulse */}
        {isCurrentPlayer && (
          <motion.div
            className="absolute -right-2 -top-2"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-900 text-stone-100 shadow-lg dark:bg-stone-100 dark:text-stone-900">
              <Clock className="h-3 w-3" />
            </div>
          </motion.div>
        )}

        {/* Status Glow */}
        {(status === "checking" || status === "playing") && (
          <motion.div
            className={cn(
              "absolute -z-10 inset-0 rounded-lg blur-xl",
              status === "checking"
                ? "bg-stone-900/20 dark:bg-stone-100/20"
                : "bg-stone-900/10 dark:bg-stone-100/10",
            )}
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          />
        )}
      </div>
    </motion.div>
  )
} 