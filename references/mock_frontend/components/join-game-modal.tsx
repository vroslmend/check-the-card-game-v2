"use client"

import type React from "react"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Users, Hash } from "lucide-react"
import { Label } from "@/components/ui/label"

interface JoinGameModalProps {
  onClose: () => void
}

export function JoinGameModal({ onClose }: JoinGameModalProps) {
  const [gameCode, setGameCode] = useState("")
  const [username, setUsername] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      onClose()
    }, 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/20 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{
          type: "spring",
          damping: 25,
          stiffness: 400,
          duration: 0.4,
        }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-stone-200/20 bg-white/95 p-8 shadow-2xl backdrop-blur-xl dark:border-stone-800/20 dark:bg-stone-900/95"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div className="absolute right-4 top-4" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </motion.div>

        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              delay: 0.2,
              type: "spring",
              stiffness: 200,
              duration: 0.6,
            }}
            className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 dark:bg-stone-800"
          >
            <Users className="h-8 w-8 text-stone-700 dark:text-stone-300" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-3xl font-light text-stone-900 dark:text-stone-100"
          >
            Join Game
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="font-light text-stone-600 dark:text-stone-400"
          >
            Enter a game code to join
          </motion.p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="space-y-2"
          >
            <Label htmlFor="username" className="font-light">
              Player Name
            </Label>
            <Input
              id="username"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 rounded-2xl border-stone-200 bg-white/60 font-light backdrop-blur-sm transition-all duration-300 focus:bg-white/80 dark:border-stone-800 dark:bg-stone-900/60 dark:focus:bg-stone-900/80"
              required
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="space-y-2"
          >
            <Label htmlFor="gameCode" className="font-light">
              Game Code
            </Label>
            <div className="relative">
              <Hash className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400 transition-colors duration-300" />
              <Input
                id="gameCode"
                placeholder="Enter game code"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                className="h-12 rounded-2xl border-stone-200 bg-white/60 pl-12 font-light backdrop-blur-sm transition-all duration-300 focus:bg-white/80 dark:border-stone-800 dark:bg-stone-900/60 dark:focus:bg-stone-900/80"
                required
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                type="submit"
                disabled={isLoading}
                className="h-12 w-full rounded-2xl bg-stone-900 text-lg font-light text-white transition-all duration-300 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
              >
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                        className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white dark:border-stone-900/30 dark:border-t-stone-900"
                      />
                      Joining Game...
                    </motion.div>
                  ) : (
                    <motion.span key="join" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      Join Game
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>
          </motion.div>
        </form>
      </motion.div>
    </motion.div>
  )
}
