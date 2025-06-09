"use client"

import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose?: () => void
  children: React.ReactNode
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  className,
  showCloseButton = true,
  children,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Only use outside click if onClose is provided
  useEffect(() => {
    if (!onClose || !modalRef.current) return;
    
    const handleOutsideClick = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [onClose]);

  useEffect(() => {
    if (!onClose) return;
    
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/20 backdrop-blur-xl"
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-sm rounded-3xl border border-stone-200/20 bg-white/80 p-8 shadow-2xl backdrop-blur-2xl dark:border-stone-800/20 dark:bg-stone-900/80"
          >
            {showCloseButton && onClose && (
              <button
                onClick={onClose}
                className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full bg-stone-900/5 text-stone-500 transition-colors hover:bg-stone-900/10 hover:text-stone-800 dark:bg-stone-100/5 dark:text-stone-400 dark:hover:bg-stone-100/10 dark:hover:text-stone-100"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            )}
            <div className="flex flex-col gap-6">
              {(title || description) && (
                <div className="flex flex-col gap-2 text-center">
                  {title && <h2 className="text-2xl font-light tracking-tight text-stone-900 dark:text-stone-100">{title}</h2>}
                  {description && <p className="text-md font-light leading-relaxed text-stone-600 dark:text-stone-400">{description}</p>}
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