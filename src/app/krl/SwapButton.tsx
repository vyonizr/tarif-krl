"use client"
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SwapButtonProps {
  onSwap: () => void
  disabled?: boolean
  children?: React.ReactNode
}

export default function SwapButton({
  onSwap,
  disabled = false,
  children,
}: SwapButtonProps) {
  return (
    <div className="my-2 flex justify-center gap-1">
      <Button
        variant="outline"
        size="icon"
        onClick={onSwap}
        disabled={disabled}
        className="h-[44px] w-[44px] rounded-full bg-white"
        aria-label="Tukar stasiun asal dan tujuan"
      >
        <ArrowUpDown className="h-4 w-4" />
      </Button>
      {children}
    </div>
  )
}
