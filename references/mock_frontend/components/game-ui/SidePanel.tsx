"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { X, MessageSquare, FileText } from "lucide-react"
import { useState } from "react"
import { GameLog } from "./GameLog"
import { ChatBox } from "./ChatBox"

interface SidePanelProps {
  isOpen: boolean
  onClose: () => void
  gameLog: any[]
  chatMessages: any[]
}

export function SidePanel({ isOpen, onClose, gameLog, chatMessages }: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<"log" | "chat">("log")

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-stone-900/80 backdrop-blur-sm dark:bg-stone-900/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-stone-200/50 bg-stone-50 dark:border-stone-800/50 dark:bg-stone-900"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-200/50 p-4 dark:border-stone-800/50">
              <div className="flex gap-2">
                <Button
                  variant={activeTab === "log" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("log")}
                  className="text-sm font-light"
                >
                  <FileText className="mr-2 h-3 w-3" />
                  Game Log
                </Button>
                <Button
                  variant={activeTab === "chat" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("chat")}
                  className="text-sm font-light"
                >
                  <MessageSquare className="mr-2 h-3 w-3" />
                  Chat
                </Button>
              </div>

              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                {activeTab === "log" ? (
                  <motion.div
                    key="log"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                  >
                    <GameLog entries={gameLog} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                  >
                    <ChatBox messages={chatMessages} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
