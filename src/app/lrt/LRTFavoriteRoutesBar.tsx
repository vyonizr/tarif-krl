"use client"
import { Star, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ILRTStation } from "@/lib/lrt/types"
import { ILRTFavoriteRoute } from "../types"
import { convertToTitleCase } from "../utils"

interface LRTFavoriteRoutesBarProps {
  favorites: ILRTFavoriteRoute[]
  stations: ILRTStation[]
  onSelect: (favorite: ILRTFavoriteRoute) => void
  onRemove: (originSlug: string, destinationSlug: string) => void
  isDemo?: boolean
}

export default function LRTFavoriteRoutesBar({
  favorites,
  stations,
  onSelect,
  onRemove,
  isDemo = false,
}: LRTFavoriteRoutesBarProps) {
  if (favorites.length === 0) return null

  const stationMap = new Map(stations.map((s) => [s.slug, s.name]))

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <p className="text-xs font-medium text-slate-400">
          {isDemo ? "Contoh Favorit" : "Favorit"}
        </p>
        {isDemo && (
          <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-700 text-[10px]">
            Contoh
          </Badge>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto py-1">
        {favorites.map((fav) => {
          const originName = stationMap.get(fav.originSlug)
          const destinationName = stationMap.get(fav.destinationSlug)
          if (!originName || !destinationName) return null

          return (
            <Button
              key={`${fav.originSlug}-${fav.destinationSlug}`}
              variant="outline"
              size="default"
              className="shrink-0 gap-1 rounded-full h-10"
              onClick={() => onSelect(fav)}
            >
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-xs">
                {convertToTitleCase(originName)} → {convertToTitleCase(destinationName)}
              </span>
              <X
                className="h-3 w-3 text-slate-400 hover:text-slate-600"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(fav.originSlug, fav.destinationSlug)
                }}
              />
            </Button>
          )
        })}
      </div>
    </div>
  )
}
