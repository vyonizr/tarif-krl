"use client"
import { HOURS } from "@/app/constants"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

const FROM_NOW = "Sekarang"

interface TimeSelectProps {
  value: string
  onChange: (value: string) => void
}

export default function TimeSelect({ value, onChange }: TimeSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full">
        <SelectValue placeholder="Pilih Waktu" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={FROM_NOW}>{FROM_NOW}</SelectItem>
        {HOURS.map((hour) => (
          <SelectItem key={hour} value={hour}>
            {hour}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
