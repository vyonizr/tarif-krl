"use client"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Star, ArrowRightLeft, MapPin } from "lucide-react"

import Spinner from "@/components/Spinner"
import { Button } from "@/components/ui/button"

import { ILRTStation, ILRTJourneyResult } from "@/lib/lrt/types"
import { ILRTFavoriteRoute } from "../types"

import {
  getCurrentTimeInHHMM,
  getTypeOfDay,
  convertTimeToHHMM,
} from "../utils"

import LRTStationCombobox from "./LRTStationCombobox"
import LRTFavoriteRoutesBar from "./LRTFavoriteRoutesBar"
import LRTDepartureRow from "./LRTDepartureRow"
import SwapButton from "../krl/SwapButton"

const STORAGE_KEY = "lrt-favorites"

function getStoredFavorites(): ILRTFavoriteRoute[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ILRTFavoriteRoute[]
  } catch {
    return []
  }
}

function saveFavorites(favorites: ILRTFavoriteRoute[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
  } catch {
    // localStorage not available
  }
}

interface LRTRouteFormProps {
  stations: ILRTStation[]
}

export default function LRTRouteForm({ stations }: LRTRouteFormProps) {
  const [originStation, setOriginStation] = useState<ILRTStation | null>(null)
  const [destinationStation, setDestinationStation] = useState<ILRTStation | null>(null)

  const [isLoadingJourney, setIsLoadingJourney] = useState(false)
  const [journeyResult, setJourneyResult] = useState<ILRTJourneyResult | null>(null)
  const [journeyError, setJourneyError] = useState(false)

  const [favorites, setFavorites] = useState<ILRTFavoriteRoute[]>([])

  const journeyRequestId = useRef(0)

  const typeOfDay = useMemo(() => {
    const base = getTypeOfDay()
    return base === "weekend" ? "holiday" : "weekday"
  }, [])

  useEffect(() => {
    setFavorites(getStoredFavorites())
  }, [])

  const isFavorite = useMemo(() => {
    if (!originStation || !destinationStation) return false
    return favorites.some(
      (f) => f.originSlug === originStation.slug && f.destinationSlug === destinationStation.slug
    )
  }, [favorites, originStation, destinationStation])

  const toggleFavorite = useCallback(() => {
    if (!originStation || !destinationStation) return
    if (isFavorite) {
      const updated = favorites.filter(
        (f) => !(f.originSlug === originStation.slug && f.destinationSlug === destinationStation.slug)
      )
      setFavorites(updated)
      saveFavorites(updated)
    } else {
      const newFav: ILRTFavoriteRoute = {
        originSlug: originStation.slug,
        destinationSlug: destinationStation.slug,
        savedAt: Date.now(),
      }
      const updated = [...favorites, newFav]
      setFavorites(updated)
      saveFavorites(updated)
    }
  }, [favorites, originStation, destinationStation, isFavorite])

  const fetchJourney = useCallback(async () => {
    if (!originStation || !destinationStation) return
    if (originStation.slug === destinationStation.slug) {
      setJourneyResult(null)
      setJourneyError(false)
      return
    }
    const requestId = ++journeyRequestId.current
    setIsLoadingJourney(true)
    setJourneyError(false)
    setJourneyResult(null)
    try {
      const res = await fetch(
        "/api/lrt/journey?" +
          new URLSearchParams({
            from: originStation.slug,
            to: destinationStation.slug,
          })
      )
      const resJSON = await res.json()
      if (requestId !== journeyRequestId.current) return
      if (resJSON.data) {
        setJourneyResult(resJSON.data as ILRTJourneyResult)
      } else {
        setJourneyError(true)
      }
    } catch {
      if (requestId !== journeyRequestId.current) return
      setJourneyError(true)
    } finally {
      if (requestId === journeyRequestId.current) setIsLoadingJourney(false)
    }
  }, [originStation, destinationStation])

  useEffect(() => {
    if (!originStation || !destinationStation) {
      setJourneyResult(null)
      setJourneyError(false)
      return
    }
    if (originStation.slug === destinationStation.slug) {
      setJourneyResult(null)
      setJourneyError(false)
      return
    }
    fetchJourney()
  }, [fetchJourney, originStation, destinationStation])

  const handleOriginSelect = useCallback((station: ILRTStation) => {
    setOriginStation(station)
  }, [])

  const handleDestinationSelect = useCallback((station: ILRTStation) => {
    setDestinationStation(station)
  }, [])

  const handleSwap = useCallback(() => {
    setOriginStation(destinationStation)
    setDestinationStation(originStation)
  }, [originStation, destinationStation])

  const handleFavoriteSelect = useCallback((fav: ILRTFavoriteRoute) => {
    const origin = stations.find((s) => s.slug === fav.originSlug)
    const destination = stations.find((s) => s.slug === fav.destinationSlug)
    if (origin && destination) {
      setOriginStation(origin)
      setDestinationStation(destination)
    }
  }, [stations])

  const handleFavoriteRemove = useCallback((originSlug: string, destinationSlug: string) => {
    const updated = favorites.filter(
      (f) => !(f.originSlug === originSlug && f.destinationSlug === destinationSlug)
    )
    setFavorites(updated)
    saveFavorites(updated)
  }, [favorites])

  const departureTimes = useMemo(() => {
    if (!journeyResult) return []
    const schedule =
      journeyResult.type === "direct"
        ? journeyResult.schedule
        : journeyResult.legs[0].schedule
    const daySchedule =
      typeOfDay === "holiday" ? schedule.holiday : schedule.weekday
    const currentTime = getCurrentTimeInHHMM()
    return daySchedule
      .filter((t) => convertTimeToHHMM(t) >= currentTime)
      .slice(0, 5)
  }, [journeyResult, typeOfDay])

  const showSameStationNotice =
    originStation &&
    destinationStation &&
    originStation.slug === destinationStation.slug

  const showLoading =
    !showSameStationNotice &&
    originStation &&
    destinationStation &&
    isLoadingJourney

  const showJourneyError =
    !showSameStationNotice &&
    originStation &&
    destinationStation &&
    journeyError &&
    !isLoadingJourney

  const showDestinationPrompt = originStation && !destinationStation
  const showInitialPrompt = !originStation

  return (
    <div className="mt-4 w-full">
      {favorites.length > 0 && (
        <div className="mb-4">
          <LRTFavoriteRoutesBar
            favorites={favorites}
            stations={stations}
            onSelect={handleFavoriteSelect}
            onRemove={handleFavoriteRemove}
          />
        </div>
      )}

      <div id="lrt-origin-combobox">
        <label className="mb-1 block text-sm">Stasiun Asal</label>
        <LRTStationCombobox
          stations={stations}
          selectedStation={originStation}
          onSelect={handleOriginSelect}
          placeholder="Pilih Stasiun Asal"
        />
      </div>

      <SwapButton
        id="lrt-swap-button"
        onSwap={handleSwap}
        disabled={!originStation && !destinationStation}
      />

      <div id="lrt-destination-combobox">
        <label className="mb-1 block text-sm">Stasiun Tujuan</label>
        <LRTStationCombobox
          stations={stations}
          selectedStation={destinationStation}
          onSelect={handleDestinationSelect}
          placeholder="Pilih Stasiun Tujuan"
        />
      </div>

      {originStation && destinationStation && originStation.slug !== destinationStation.slug && (
        <div className="mt-3 flex justify-center">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleFavorite}
            className="h-11 w-11 rounded-pill bg-white"
            aria-label={isFavorite ? "Hapus dari favorit" : "Tambah ke favorit"}
          >
            <Star
              className={`h-4 w-4 ${isFavorite ? "fill-amber-400 text-amber-400" : "text-slate-400"}`}
            />
          </Button>
        </div>
      )}

      {showInitialPrompt && (
        <div className="mt-8 text-center text-sm text-slate-500">
          Pilih stasiun asal dan tujuan untuk melihat jadwal
        </div>
      )}

      {showDestinationPrompt && (
        <div className="mt-8 text-center text-sm text-slate-500">
          Pilih stasiun tujuan untuk melihat jadwal
        </div>
      )}

      {showLoading && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <Spinner />
          <p className="text-xs text-slate-400">Memuat jadwal...</p>
        </div>
      )}

      {showJourneyError && (
        <div className="mt-8">
          <div className="rounded-lg bg-red-50 p-4 text-center">
            <p className="text-sm text-red-600">
              Gagal memuat jadwal, coba lagi
            </p>
            <Button onClick={fetchJourney} variant="outline" className="mt-3">
              Coba Lagi
            </Button>
          </div>
        </div>
      )}

      {showSameStationNotice && (
        <div className="mt-8 rounded-lg bg-amber-50 p-4 text-center">
          <p className="text-sm text-amber-800">
            Stasiun asal dan tujuan sama.
          </p>
        </div>
      )}

      {!showSameStationNotice && !isLoadingJourney && journeyResult && (
        <div className="mt-8">
          <div className="mb-4 rounded-lg border border-blue-200/60 bg-blue-50 px-4 py-3 text-blue-900">
            <div className="grid grid-cols-[20px_1fr] items-center gap-x-3">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">
                {journeyResult.type === "direct"
                  ? `${journeyResult.fromName} → ${journeyResult.toName}`
                  : `${journeyResult.legs[0].fromName} → ${journeyResult.legs[1].toName}`}
              </span>
            </div>
            {journeyResult.type === "direct" && (
              <div className="mt-1 grid grid-cols-[20px_1fr] items-center gap-x-3">
                <ArrowRightLeft className="h-4 w-4" />
                <span className="text-sm">
                  Arah {journeyResult.headingTowards}
                </span>
              </div>
            )}
          </div>

          {departureTimes.length > 0 ? (
            <div className="w-full">
              <p className="mb-2 text-center text-sm font-medium text-slate-700">
                Kereta Berikutnya
              </p>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                {departureTimes.map((t, i) => (
                  <LRTDepartureRow
                    key={i}
                    departureTime={t}
                    journeyResult={journeyResult}
                    typeOfDay={typeOfDay}
                    isFirst={i === 0}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 p-4 text-center text-sm text-slate-500">
              Tidak ada jadwal keberangkatan tersedia.
            </div>
          )}

          <p className="mt-3 text-center text-xs text-slate-400">
            Jadwal hari libur nasional di luar akhir pekan belum terdeteksi
            otomatis.
          </p>

          <p className="mt-1 text-center text-xs text-slate-400">
            Data jadwal bersumber dari{" "}
            <a
              href="https://lrtjabodebek.kai.id/jadwal-keberangkatan"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              LRT Jabodebek
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
