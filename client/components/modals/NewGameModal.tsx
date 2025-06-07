"use client"

import type React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spade } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import Modal from "./Modal"
import Magnetic from "../ui/Magnetic"

interface NewGameModalProps {
  onClose: () => void
}

export function NewGameModal({ onClose }: NewGameModalProps) {
  const [username, setUsername] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // Placeholder for actual game creation logic
    setTimeout(() => {
      setIsLoading(false)
      onClose()
    }, 2000)
  }

  return (
    <Modal onClose={onClose}>
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
          <Spade className="h-8 w-8 text-stone-700 dark:text-stone-300" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-3xl font-light text-stone-900 dark:text-stone-100"
        >
          Create New Game
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="font-light text-stone-600 dark:text-stone-400"
        >
          Configure your Check experience
        </motion.p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {[
          {
            id: "username",
            label: "Player Name",
            type: "input",
            placeholder: "Enter your name",
            value: username,
            onChange: setUsername,
            delay: 0.5,
          },
          {
            id: "gameMode",
            label: "Game Mode",
            type: "select",
            defaultValue: "classic",
            options: [
              { value: "classic", label: "Classic Check" },
              { value: "blitz", label: "Blitz Mode" },
              { value: "tournament", label: "Tournament" },
            ],
            delay: 0.6,
          },
          {
            id: "players",
            label: "Max Players",
            type: "select",
            defaultValue: "4",
            options: [
              { value: "2", label: "2 Players" },
              { value: "4", label: "4 Players" },
              { value: "6", label: "6 Players" },
            ],
            delay: 0.7,
          },
        ].map((field) => (
          <motion.div
            key={field.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: field.delay, duration: 0.5 }}
            className="space-y-2"
          >
            <Label htmlFor={field.id} className="font-light">
              {field.label}
            </Label>
            {field.type === "input" ? (
              <Input
                id={field.id}
                placeholder={field.placeholder}
                value={field.value as string}
                onChange={(e) => (field.onChange as (value: string) => void)(e.target.value)}
                className="h-12 rounded-2xl border-stone-200 bg-white/60 font-light backdrop-blur-sm transition-all duration-300 focus:bg-white/80 dark:border-stone-800 dark:bg-stone-900/60 dark:focus:bg-stone-900/80"
                required
              />
            ) : (
              <Select defaultValue={field.defaultValue}>
                <SelectTrigger className="h-12 rounded-2xl border-stone-200 bg-white/60 font-light backdrop-blur-sm transition-all duration-300 hover:bg-white/70 dark:border-stone-800 dark:bg-stone-900/60 dark:hover:bg-stone-900/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="flex items-center justify-between"
        >
          <Label htmlFor="private" className="font-light">
            Private Game
          </Label>
          <Switch id="private" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
          <Magnetic>
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
                      Creating Game...
                    </motion.div>
                  ) : (
                    <motion.span key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      Create Game
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>
          </Magnetic>
        </motion.div>
      </form>
    </Modal>
  )
} 