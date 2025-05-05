"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface CustomProgressProps {
  value?: number
  className?: string
}

export function CustomProgress({ value = 0, className }: CustomProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, value))
  
  return (
    <div 
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary", 
        className
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clampedValue}
    >
      <div 
        className="h-full bg-primary transition-all" 
        style={{ width: `${clampedValue}%` }} 
      />
    </div>
  )
}
