"use client"
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SwapButtonProps {
  id?: string
  onSwap: () => void
  disabled?: boolean
  children?: React.ReactNode
}

export default function SwapButton({
  id,
  onSwap,
  disabled = false,
  children,
}: SwapButtonProps) {
  return (
    <div className="my-2 flex justify-center gap-1">
      <Button
        id={id}
        variant="outline"
        size="icon"
        onClick={onSwap}
        disabled={disabled}
        className="h-11 w-11 rounded-pill bg-white"
        aria-label="Tukar stasiun asal dan tujuan"
      >
        <ArrowUpDown className="h-4 w-4" />
      </Button>
      {children}
    </div>
  )
}
