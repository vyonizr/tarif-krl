"use client"
import { Star, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IStationState, KRLStation, IFavoriteRoute } from "../types"
import { convertToTitleCase } from "../utils"

interface FavoriteRoutesBarProps {
  favorites: IFavoriteRoute[]
  stations: IStationState
  onSelect: (favorite: IFavoriteRoute) => void
  onRemove: (originStationId: string, destinationStationId: string) => void
  isDemo?: boolean
}

function findStationById(
  stations: IStationState,
  stationId: string
): KRLStation | null {
  for (const stationList of Object.values(stations)) {
    const station = stationList.find((s) => s.id === stationId)
    if (station) return station
  }
  return null
}

export default function FavoriteRoutesBar({
  favorites,
  stations,
  onSelect,
  onRemove,
  isDemo = false,
}: FavoriteRoutesBarProps) {
  if (favorites.length === 0) return null

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <p className="text-xs font-medium text-slate-400">
          {isDemo ? "Contoh Favorit" : "Favorit"}
        </p>
        {isDemo && (
          <span className="inline-block rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            Contoh
          </span>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto py-1">
        {favorites.map((fav) => {
          const origin = findStationById(stations, fav.originStationId)
          const destination = findStationById(stations, fav.destinationStationId)
          if (!origin || !destination) return null

          return (
            <Button
              key={`${fav.originStationId}-${fav.destinationStationId}`}
              variant="outline"
              size="default"
              className="shrink-0 gap-1 rounded-full h-10"
              onClick={() => onSelect(fav)}
            >
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-xs">
                {convertToTitleCase(origin.name)} → {convertToTitleCase(destination.name)}
              </span>
              <X
                className="h-3 w-3 text-slate-400 hover:text-slate-600"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(fav.originStationId, fav.destinationStationId)
                }}
              />
            </Button>
          )
        })}
      </div>
    </div>
  )
}
