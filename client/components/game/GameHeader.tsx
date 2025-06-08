"use client"

import React from 'react';
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MessageSquare, Settings, Users, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import Link from "next/link"
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';

export const GameHeader = () => {
  const gameId = useGameStore((state) => state.gameId);
  const isSidePanelOpen = useGameStore((state) => state.isSidePanelOpen);
  const toggleSidePanel = useGameStore((state) => state.toggleSidePanel);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Check The Card</h1>
        <div className="h-6 w-px bg-border" />
        <span className="font-mono text-sm text-muted-foreground">{gameId ?? '...'}</span>
      </div>
      <Button variant="outline" size="icon" onClick={toggleSidePanel} className="h-10 w-10">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={isSidePanelOpen ? 'open' : 'closed'}
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 90 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center"
          >
            {isSidePanelOpen ? <PanelLeftClose className="h-5 w-5"/> : <PanelLeftOpen className="h-5 w-5"/>}
          </motion.div>
        </AnimatePresence>
        <span className="sr-only">Toggle side panel</span>
      </Button>
    </header>
  )
} 