import { cn } from "@/lib/utils"

interface CustomProgressProps {
  value?: number
  className?: string
}

export function CustomProgress({ value = 0, className }: CustomProgressProps) {
  return (
    <div className={cn("relative h-2 w-full overflow-hidden rounded-full bg-gray-200", className)}>
      <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}
