"use client"

import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useOutsideClick } from '@/hooks/use-outside-click'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  description?: string
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, description }) => {
  const modalRef = useRef<HTMLDivElement>(null)

  useOutsideClick(modalRef, onClose)

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEsc)

    return () => {
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="relative w-full max-w-sm rounded-2xl border border-stone-200/10 bg-white p-8 shadow-2xl dark:bg-zinc-900"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 transition-colors"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col gap-4">
              {(title || description) && (
                <div className="flex flex-col gap-1.5">
                  {title && <h2 className="text-xl font-bold">{title}</h2>}
                  {description && <p className="text-sm text-stone-500 dark:text-stone-400">{description}</p>}
                </div>
              )}
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
} 