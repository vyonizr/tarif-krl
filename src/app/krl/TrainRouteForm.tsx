"use client"
import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Star } from "lucide-react"

import PenaltyNotification from "@/components/PenaltyNotification"
import Spinner from "@/components/Spinner"
import { Button } from "@/components/ui/button"

import { IStationState, KRLStation, IFareResponse, IFavoriteRoute } from "../types"
import { IKRLRouteResult } from "@/lib/krl/types"
import { getCurrentTimeInHHMM, convertToTitleCase } from "../utils"

import StationCombobox from "./StationCombobox"
import SwapButton from "./SwapButton"
import TimeSelect from "./TimeSelect"
import RouteItinerary from "./RouteItinerary"
import FavoriteRoutesBar from "./FavoriteRoutesBar"

interface ITrainRouteFormProps {
  stations: IStationState
  initialFrom?: string
  initialTo?: string
}

const STORAGE_KEY = "krl-prefs"
const FAVORITES_STORAGE_KEY = "krl-favorites"
const FROM_NOW = "Sekarang"

function findStationById(
  stations: IStationState,
  stationId: string
): { region: string; station: KRLStation } | null {
  for (const [region, stationList] of Object.entries(stations)) {
    const station = stationList.find((s) => s.id === stationId)
    if (station) return { region, station }
  }
  return null
}

function getStoredPrefs(): {
  region: string | null
  originStationId: string | null
  destinationStationId: string | null
} {
  if (typeof window === "undefined")
    return { region: null, originStationId: null, destinationStationId: null }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    /* empty */
  }
  return { region: null, originStationId: null, destinationStationId: null }
}

function savePrefs(prefs: {
  region: string
  originStationId: string | null
  destinationStationId: string | null
}) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* empty */
  }
}

function getStoredFavorites(): IFavoriteRoute[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    /* empty */
  }
  return []
}

function saveFavorites(favorites: IFavoriteRoute[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
  } catch {
    /* empty */
  }
}

export default function TrainRouteForm({
  stations,
  initialFrom,
  initialTo,
}: ITrainRouteFormProps) {
  const initialFromStation = initialFrom
    ? findStationById(stations, initialFrom)
    : null
  const initialToStation = initialTo
    ? findStationById(stations, initialTo)
    : null
  const defaultRegion =
    initialFromStation?.region ?? Object.keys(stations)[0]

  const regionKeys = useMemo(() => Object.keys(stations), [stations])

  const [region, setRegion] = useState<string>(defaultRegion)
  const [originStation, setOriginStation] = useState<KRLStation | null>(
    initialFromStation?.station ?? null
  )
  const [destinationStation, setDestinationStation] =
    useState<KRLStation | null>(initialToStation?.station ?? null)
  const [time, setTime] = useState<string>(FROM_NOW)

  const [isLoadingRoute, setIsLoadingRoute] = useState(false)
  const [isLoadingFare, setIsLoadingFare] = useState(false)

  const [routeLegs, setRouteLegs] = useState<IKRLRouteResult[] | null>(null)
  const [routeError, setRouteError] = useState<{
    status: number
    message: string
  } | null>(null)

  const [fare, setFare] = useState<number | null>(null)
  const [fareError, setFareError] = useState(false)

  const [favorites, setFavorites] = useState<IFavoriteRoute[]>([])
  const favoritesMounted = useRef(false)

  const isFavorited = useMemo(() => {
    if (!originStation || !destinationStation) return false
    return favorites.some(
      (f) =>
        f.originStationId === originStation.id &&
        f.destinationStationId === destinationStation.id
    )
  }, [favorites, originStation, destinationStation])

  const stationList: KRLStation[] = useMemo(() => {
    if (region) {
      return stations[region] || []
    }
    return []
  }, [region, stations])

  const handleRegionChange = useCallback((newRegion: string) => {
    setRegion(newRegion)
    setOriginStation(null)
    setDestinationStation(null)
    setFare(null)
    setRouteLegs(null)
    setRouteError(null)
    setFareError(false)
    setTime(FROM_NOW)
  }, [])

  const handleOriginSelect = useCallback(
    (station: KRLStation) => {
      setOriginStation(station)
      setRouteLegs(null)
      setRouteError(null)
    },
    []
  )

  const handleDestinationSelect = useCallback(
    (station: KRLStation) => {
      setDestinationStation(station)
      setRouteLegs(null)
      setRouteError(null)
    },
    []
  )

  const handleSwap = useCallback(() => {
    setOriginStation(destinationStation)
    setDestinationStation(originStation)
    setRouteLegs(null)
    setRouteError(null)
  }, [originStation, destinationStation])

  const handleToggleFavorite = useCallback(() => {
    if (!originStation || !destinationStation) return

    setFavorites((prev) => {
      const existingIndex = prev.findIndex(
        (f) =>
          f.originStationId === originStation.id &&
          f.destinationStationId === destinationStation.id
      )

      if (existingIndex !== -1) {
        return prev.filter(
          (f) =>
            !(
              f.originStationId === originStation.id &&
              f.destinationStationId === destinationStation.id
            )
        )
      }

      return [
        ...prev,
        {
          originStationId: originStation.id,
          destinationStationId: destinationStation.id,
          region,
          savedAt: Date.now(),
        },
      ]
    })
  }, [originStation, destinationStation, region])

  const handleSelectFavorite = useCallback(
    (favorite: IFavoriteRoute) => {
      const origin = findStationById(stations, favorite.originStationId)
      const destination = findStationById(stations, favorite.destinationStationId)
      if (!origin || !destination) return

      setRegion(favorite.region)
      setOriginStation(origin.station)
      setDestinationStation(destination.station)
    },
    [stations]
  )

  const handleRemoveFavorite = useCallback(
    (originStationId: string, destinationStationId: string) => {
      setFavorites((prev) =>
        prev.filter(
          (f) =>
            !(
              f.originStationId === originStationId &&
              f.destinationStationId === destinationStationId
            )
        )
      )
    },
    []
  )

  useEffect(() => {
    if (initialFrom || initialTo) return

    const prefs = getStoredPrefs()

    let regionToSet: string | null = null
    let originToSet: KRLStation | null = null
    let destToSet: KRLStation | null = null

    if (prefs.originStationId) {
      const found = findStationById(stations, prefs.originStationId)
      if (found) {
        regionToSet = found.region
        originToSet = found.station
      }
    }

    if (prefs.destinationStationId) {
      const found = findStationById(stations, prefs.destinationStationId)
      if (found) {
        destToSet = found.station
        if (!regionToSet) regionToSet = found.region
      }
    }

    if (!regionToSet && prefs.region && stations[prefs.region]) {
      regionToSet = prefs.region
    }

    if (regionToSet) setRegion(regionToSet)
    if (originToSet) setOriginStation(originToSet)
    if (destToSet) setDestinationStation(destToSet)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setFavorites(getStoredFavorites())
  }, [])

  useEffect(() => {
    if (favoritesMounted.current) {
      saveFavorites(favorites)
    } else {
      favoritesMounted.current = true
    }
  }, [favorites])

  useEffect(() => {
    const params = new URLSearchParams()
    if (originStation) params.set("from", originStation.id)
    if (destinationStation) params.set("to", destinationStation.id)
    const qs = params.toString()
    const newUrl = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname
    window.history.replaceState(null, "", newUrl)
  }, [originStation, destinationStation])

  useEffect(() => {
    savePrefs({
      region,
      originStationId: originStation?.id ?? null,
      destinationStationId: destinationStation?.id ?? null,
    })
  }, [region, originStation, destinationStation])

  const routeRequestId = useRef(0)

  const fetchRoute = useCallback(async () => {
    if (!originStation || !destinationStation) return
    const requestId = ++routeRequestId.current
    setIsLoadingRoute(true)
    setRouteLegs(null)
    setRouteError(null)
    try {
      const resolvedTime =
        time === FROM_NOW ? getCurrentTimeInHHMM() : time
      const res = await fetch(
        `/api/v1/krl/route?` +
          new URLSearchParams({
            from: originStation.id,
            to: destinationStation.id,
            time: resolvedTime,
          })
      )
      const json = await res.json()
      if (requestId !== routeRequestId.current) return
      if (json.data) {
        setRouteLegs(json.data.legs)
      } else if (json.error) {
        setRouteError(json.error)
      }
    } catch (error) {
      if (requestId !== routeRequestId.current) return
      setRouteError({ status: 502, message: "Gagal memuat rute, coba lagi" })
    } finally {
      if (requestId === routeRequestId.current) setIsLoadingRoute(false)
    }
  }, [originStation, destinationStation, time])

  useEffect(() => {
    if (!originStation || !destinationStation) {
      setRouteLegs(null)
      setRouteError(null)
      return
    }
    fetchRoute()
  }, [fetchRoute, originStation, destinationStation])

  const fareRequestId = useRef(0)

  const fetchFare = useCallback(async () => {
    if (!originStation || !destinationStation) return
    const requestId = ++fareRequestId.current
    setIsLoadingFare(true)
    setFareError(false)
    try {
      const res = await fetch(
        `/api/v1/krl/fare?` +
          new URLSearchParams({
            from: originStation.id,
            to: destinationStation.id,
          })
      )
      const resJSON: IFareResponse = await res.json()
      if (requestId !== fareRequestId.current) return
      if (resJSON.data) {
        setFare(resJSON.data[0].fare)
      } else {
        setFare(null)
        setFareError(true)
      }
    } catch (error) {
      if (requestId !== fareRequestId.current) return
      console.error(error)
      setFare(null)
      setFareError(true)
    } finally {
      if (requestId === fareRequestId.current) setIsLoadingFare(false)
    }
  }, [originStation, destinationStation])

  useEffect(() => {
    if (!originStation || !destinationStation) {
      setFare(null)
      setFareError(false)
      return
    }
    fetchFare()
  }, [fetchFare, originStation, destinationStation])

  const showRouteItinerary =
    originStation && destinationStation && routeLegs && !routeError

  const showNoRouteError =
    originStation &&
    destinationStation &&
    routeError &&
    !isLoadingRoute

  const showLoading =
    originStation && destinationStation && isLoadingRoute

  const showDestinationPrompt =
    originStation && !destinationStation

  const showInitialPrompt =
    !originStation

  return (
    <div className="mt-4 w-full">
      <FavoriteRoutesBar
        favorites={favorites}
        stations={stations}
        onSelect={handleSelectFavorite}
        onRemove={handleRemoveFavorite}
      />

      <div className="mt-4">
        <label htmlFor="region" className="mb-1 block text-sm">Area</label>
        <select
          name="region"
          onChange={(e) => handleRegionChange(e.target.value)}
          className="h-[44px] w-full rounded-md border border-slate-200 bg-white px-4 py-2 text-sm"
          value={region}
        >
          {regionKeys.map((r) => (
            <option key={r} value={r}>
              {convertToTitleCase(r)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-sm">Stasiun Asal</label>
        <StationCombobox
          stations={stationList}
          selectedStation={originStation}
          onSelect={handleOriginSelect}
          placeholder="Pilih Stasiun Asal"
        />
      </div>

      <SwapButton
        onSwap={handleSwap}
        disabled={!originStation && !destinationStation}
      >
        {originStation &&
          destinationStation &&
          originStation.id !== destinationStation.id && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleToggleFavorite}
              className="h-[44px] w-[44px] rounded-full bg-white"
              aria-label={
                isFavorited ? "Hapus dari favorit" : "Simpan ke favorit"
              }
            >
              <Star
                className="h-4 w-4"
                fill={isFavorited ? "currentColor" : "none"}
              />
            </Button>
          )}
      </SwapButton>

      <div>
        <label className="mb-1 block text-sm">Stasiun Tujuan</label>
        <StationCombobox
          stations={stationList}
          selectedStation={destinationStation}
          onSelect={handleDestinationSelect}
          placeholder="Pilih Stasiun Tujuan"
        />
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-sm">Waktu Keberangkatan</label>
        <TimeSelect value={time} onChange={setTime} />
      </div>

      {originStation?.id === destinationStation?.id && (
        <div className="mt-3 flex justify-center">
          <PenaltyNotification />
        </div>
      )}

      {showInitialPrompt && (
        <div className="mt-8 text-center text-sm text-slate-500">
          Pilih stasiun asal dan tujuan untuk melihat rute
        </div>
      )}

      {showDestinationPrompt && (
        <div className="mt-8 text-center text-sm text-slate-500">
          Pilih stasiun tujuan untuk melihat rute
        </div>
      )}

      {showLoading && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <Spinner />
          <p className="text-xs text-slate-400">Menunggu respons server KRL...</p>
        </div>
      )}

      {showNoRouteError && (
        <div className="mt-8">
          <div className="rounded-lg bg-red-50 p-4 text-center">
            <p className="text-sm text-red-600">
              {routeError.status === 404
                ? "Tidak ada rute ditemukan antara kedua stasiun ini."
                : "Gagal memuat rute, coba lagi"}
            </p>
            {routeError.status !== 404 &&
              originStation?.id !== destinationStation?.id && (
                <Button
                  onClick={fetchRoute}
                  variant="default"
                  size="sm"
                  className="mt-3"
                >
                  Coba Lagi
                </Button>
              )}
          </div>
          {originStation?.id === destinationStation?.id ? null : (
            <RouteItinerary
              legs={[]}
              fare={null}
              isFareLoading={false}
              fareError
            />
          )}
        </div>
      )}

      {showRouteItinerary && (
        <RouteItinerary
          legs={routeLegs}
          fare={fare}
          isFareLoading={isLoadingFare}
          fareError={fareError}
        />
      )}
    </div>
  )
}
