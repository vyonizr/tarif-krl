"use client"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Star, ArrowRightLeft, Train, MapPin } from "lucide-react"

import Spinner from "@/components/Spinner"
import { Button } from "@/components/ui/button"

import {
  ILRTStation,
  ILRTDirectJourney,
  ILRTTransferJourney,
  ILRTJourneyResult,
} from "@/lib/lrt/types"
import { ILRTFavoriteRoute } from "../types"

import { LRT_MINUTES_PER_STOP } from "@/lib/lrt/constants"
import {
  getCurrentTimeInHHMM,
  getTypeOfDay,
  convertTimeToHHMM,
  calculateMRTETA,
} from "../utils"

import LRTStationCombobox from "./LRTStationCombobox"
import LRTFavoriteRoutesBar from "./LRTFavoriteRoutesBar"
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

  function computeDepartureTimes(schedule: { weekday: string[]; holiday: string[] }) {
    const daySchedule = typeOfDay === "holiday" ? schedule.holiday : schedule.weekday
    const currentTime = getCurrentTimeInHHMM()
    return daySchedule
      .filter((t) => convertTimeToHHMM(t) >= currentTime)
      .slice(0, 5)
  }

  function renderDirectLeg(
    leg: ILRTDirectJourney,
    label?: string,
  ) {
    const departureTimes = computeDepartureTimes(leg.schedule)

    if (departureTimes.length === 0) {
      return (
        <div className="rounded-lg border border-slate-200 p-4 text-center text-sm text-slate-500">
          Tidak ada jadwal keberangkatan tersedia.
        </div>
      )
    }

    return (
      <div>
        {label && (
          <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
        )}
        <div className="w-full">
          <p className="mb-1 text-center text-sm font-medium text-slate-700">
            Kereta Berikutnya
          </p>
          <div className="divide-y divide-slate-100">
            {departureTimes.map((t, i) => (
              <div
                key={i}
                data-testid="lrt-departure-row"
                className={`px-3 py-1.5 text-center text-sm tabular-nums ${
                  i === 0
                    ? "rounded-md bg-[#E7EEF8] font-semibold text-[#19519A]"
                    : "text-slate-600"
                }`}
              >
                <div>
                  {convertTimeToHHMM(t)}
                  <span className="text-slate-400">
                    {" "}
                    &rarr; tiba{" "}
                    {calculateMRTETA(
                      convertTimeToHHMM(t),
                      String((leg.stations.length - 1) * LRT_MINUTES_PER_STOP)
                    )}
                  </span>
                </div>
                {(leg.stations.length > 2) && (
                  <div className="mt-1 space-x-1 text-[10px] text-slate-400">
                    {leg.stations.slice(1).map((st, si) => (
                      <span key={st.slug}>
                        {si > 0 && <span className="text-slate-300"> → </span>}
                        <span>
                          {calculateMRTETA(
                            convertTimeToHHMM(t),
                            String((si + 1) * LRT_MINUTES_PER_STOP)
                          )}{" "}
                          {st.name}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

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
          {journeyResult.type === "direct" && (
            <div className="mb-4 rounded-lg border border-blue-200/60 bg-blue-50 p-4">
              <div className="mb-3 grid grid-cols-[20px_1fr] items-center gap-x-3 text-blue-900">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">
                  {journeyResult.fromName} → {journeyResult.toName}
                </span>
              </div>
              <div className="mb-3 grid grid-cols-[20px_1fr] items-center gap-x-3 text-blue-900">
                <ArrowRightLeft className="h-4 w-4" />
                <span className="text-sm">
                  Arah {journeyResult.headingTowards}
                </span>
              </div>
              {renderDirectLeg(journeyResult)}
            </div>
          )}

          {journeyResult.type === "transfer" && (
            <div>
              {journeyResult.legs.map((leg, legIndex) => (
                <div key={legIndex} className="mb-4 rounded-lg border border-blue-200/60 bg-blue-50 p-4">
                  <div className="mb-3 grid grid-cols-[20px_1fr] items-center gap-x-3 text-blue-900">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">
                      {leg.fromName} → {leg.toName}
                    </span>
                  </div>
                  <div className="mb-3 grid grid-cols-[20px_1fr] items-center gap-x-3 text-blue-900">
                    <ArrowRightLeft className="h-4 w-4" />
                    <span className="text-sm">
                      Arah {leg.headingTowards}
                    </span>
                  </div>
                  {renderDirectLeg(leg)}
                </div>
              ))}
              <div className="-mt-3 mb-4 flex justify-center">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                  Transit di {journeyResult.transferStation}
                </span>
              </div>
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
