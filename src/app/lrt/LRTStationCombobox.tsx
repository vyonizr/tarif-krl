"use client"
import { useState, useRef, useEffect } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { ILRTStation } from "@/lib/lrt/types"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"

interface LRTStationComboboxProps {
  stations: ILRTStation[]
  selectedStation: ILRTStation | null
  onSelect: (station: ILRTStation) => void
  placeholder: string
  disabled?: boolean
}

export default function LRTStationCombobox({
  stations,
  selectedStation,
  onSelect,
  placeholder,
  disabled = false,
}: LRTStationComboboxProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setOpen(!open)
          }
        }}
        disabled={disabled}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-control border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <span className={cn("truncate", !selectedStation && "text-slate-500")}>
          {selectedStation ? selectedStation.name : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-control border border-slate-200 bg-white shadow-lg">
          <Command>
            <CommandInput placeholder="Cari stasiun..." />
            <CommandList>
              <CommandEmpty>Tidak ada stasiun ditemukan.</CommandEmpty>
              <CommandGroup>
                {stations.map((station) => (
                  <CommandItem
                    key={station.slug}
                    value={station.name}
                    onSelect={() => {
                      onSelect(station)
                      setOpen(false)
                    }}
                    className={cn(
                      selectedStation?.slug === station.slug && "bg-slate-50 font-medium"
                    )}
                  >
                    {station.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  )
}
