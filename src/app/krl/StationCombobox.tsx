"use client"
import { useState, useRef, useEffect } from "react"
import { ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { KRLStation } from "@/app/types"

interface StationComboboxProps {
  stations: KRLStation[]
  selectedStation: KRLStation | null
  onSelect: (station: KRLStation) => void
  placeholder: string
  disabled?: boolean
}

export default function StationCombobox({
  stations,
  selectedStation,
  onSelect,
  placeholder,
  disabled = false,
}: StationComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = stations.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setOpen(!open)
            setQuery("")
          }
        }}
        disabled={disabled}
        className={cn(
          "flex h-[44px] w-full items-center justify-between rounded-md border border-slate-200 bg-white px-4 text-left text-sm transition-colors",
          "hover:bg-slate-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <span className={cn("truncate", !selectedStation && "text-slate-500")}>
          {selectedStation ? selectedStation.name : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari stasiun..."
              className="flex h-10 w-full bg-transparent px-2 py-3 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">
                Tidak ada stasiun ditemukan.
              </div>
            ) : (
              filtered.map((station) => (
                <button
                  key={station.id}
                  onClick={() => {
                    onSelect(station)
                    setOpen(false)
                    setQuery("")
                  }}
                  className={cn(
                    "flex w-full items-center px-4 py-2.5 text-left text-sm hover:bg-slate-100",
                    selectedStation?.id === station.id && "bg-slate-50 font-medium"
                  )}
                >
                  {station.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
