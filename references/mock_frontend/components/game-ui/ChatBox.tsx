"use client"

import type React from "react"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"
import { useState, useRef, useEffect } from "react"

interface ChatMessage {
  id: string
  timestamp: string
  player: string
  message: string
  isSystem?: boolean
}

interface ChatBoxProps {
  messages: ChatMessage[]
}

export function ChatBox({ messages }: ChatBoxProps) {
  const [newMessage, setNewMessage] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      // TODO: Implement send message logic
      console.log("Sending message:", newMessage)
      setNewMessage("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-stone-200/50 dark:border-stone-800/50">
        <h3 className="text-lg font-serif font-light">Chat</h3>
        <p className="text-sm font-light text-stone-600 dark:text-stone-400">{messages.length} messages</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm font-light text-stone-600 dark:text-stone-400">No messages yet</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.02 }}
              className={`space-y-1 ${message.isSystem ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="text-stone-500 dark:text-stone-500">{message.timestamp}</span>
                <span
                  className={`font-medium ${message.isSystem ? "text-stone-600 dark:text-stone-400" : "text-stone-700 dark:text-stone-300"}`}
                >
                  {message.player}
                </span>
              </div>
              <p className="text-sm font-light text-stone-700 dark:text-stone-300">{message.message}</p>
            </motion.div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-stone-200/50 dark:border-stone-800/50">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="text-sm font-light"
          />
          <Button onClick={handleSendMessage} disabled={!newMessage.trim()} size="sm">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
