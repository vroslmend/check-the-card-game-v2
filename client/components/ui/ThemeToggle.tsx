"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="opacity-0">
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      </Button>
    )
  }

  return (
    <motion.div 
      whileHover={{ scale: 1.05 }} 
      whileTap={{ scale: 0.95 }} 
      transition={{ duration: 0.2 }}
      data-cursor-link
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="h-10 w-10 min-w-[40px] flex items-center justify-center rounded-full bg-stone-100/70 hover:bg-stone-100/90 dark:bg-zinc-800/70 dark:hover:bg-zinc-800/90 p-0"
        style={{lineHeight: 1}}
      >
        <motion.div
          initial={false}
          animate={{
            rotate: theme === "dark" ? 0 : 180,
            scale: theme === "dark" ? 1 : 0.8,
          }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            duration: 0.3,
          }}
          className="flex items-center justify-center h-full w-full"
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5 text-stone-300" />
          ) : (
            <Moon className="h-5 w-5 text-stone-700" />
          )}
        </motion.div>
      </Button>
    </motion.div>
  )
} 