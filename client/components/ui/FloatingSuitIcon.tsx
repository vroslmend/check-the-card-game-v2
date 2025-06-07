"use client"

import { ElementType } from "react"

interface FloatingSuitIconProps {
  Icon: ElementType
}

export function FloatingSuitIcon({ Icon }: FloatingSuitIconProps) {
  return <Icon className="h-8 w-8 text-stone-700 dark:text-stone-300" />
} 