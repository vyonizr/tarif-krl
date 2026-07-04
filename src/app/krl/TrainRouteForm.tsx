"use client"
import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Star, HelpCircle } from "lucide-react"

import PenaltyNotification from "@/components/PenaltyNotification"
import Spinner from "@/components/Spinner"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

import { IStationState, KRLStation, IFareResponse, IFavoriteRoute } from "../types"
import { IKRLRouteResult } from "@/lib/krl/types"
import { getCurrentTimeInHHMM, convertToTitleCase } from "../utils"

import StationCombobox from "./StationCombobox"
import SwapButton from "./SwapButton"
import TimeSelect from "./TimeSelect"
import RouteItinerary from "./RouteItinerary"
import FavoriteRoutesBar from "./FavoriteRoutesBar"
import KRLOnboardingTour from "./KRLOnboardingTour"
import {
  MOCK_ORIGIN_STATION_ID,
  MOCK_DEST_STATION_ID,
  MOCK_ROUTE_LEGS,
  MOCK_FARE,
  createMockFavorites,
} from "./onboarding-data"

interface ITrainRouteFormProps {
  stations: IStationState
  initialFrom?: string
  initialTo?: string
}

interface FormSnapshot {
  region: string
  originStation: KRLStation | null
  destinationStation: KRLStation | null
  routeLegs: IKRLRouteResult[] | null
  routeError: { status: number; message: string } | null
  fare: number | null
  fareError: boolean
  favorites: IFavoriteRoute[]
  time: string
}

const STORAGE_KEY = "krl-prefs"
const FAVORITES_STORAGE_KEY = "krl-favorites"
const ONBOARDING_STORAGE_KEY = "krl-onboarding-seen"
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

function getOnboardingSeen(): boolean {
  if (typeof window === "undefined") return true
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true"
  } catch {
    return true
  }
}

function setOnboardingSeen() {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true")
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

  const [isOnboardingDemo, setIsOnboardingDemo] = useState(false)
  const [onboardingTourOpen, setOnboardingTourOpen] = useState(false)
  const formSnapshotRef = useRef<FormSnapshot | null>(null)

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

  const handleInjectMockData = useCallback(() => {
    formSnapshotRef.current = {
      region,
      originStation,
      destinationStation,
      routeLegs,
      routeError,
      fare,
      fareError,
      favorites,
      time,
    }

    setIsOnboardingDemo(true)

    const mockOrigin = findStationById(stations, MOCK_ORIGIN_STATION_ID)
    const mockDest = findStationById(stations, MOCK_DEST_STATION_ID)

    if (mockOrigin) {
      setRegion(mockOrigin.region)
      setOriginStation(mockOrigin.station)
    }
    if (mockDest) {
      if (!mockOrigin) setRegion(mockDest.region)
      setDestinationStation(mockDest.station)
    }
    setRouteLegs(MOCK_ROUTE_LEGS)
    setRouteError(null)
    setFare(MOCK_FARE)
    setFareError(false)
    setFavorites(createMockFavorites())
  }, [
    region,
    originStation,
    destinationStation,
    routeLegs,
    routeError,
    fare,
    fareError,
    favorites,
    time,
    stations,
  ])

  const handleTourEnd = useCallback(() => {
    const snap = formSnapshotRef.current

    if (snap) {
      setRegion(snap.region)
      setOriginStation(snap.originStation)
      setDestinationStation(snap.destinationStation)
      setRouteLegs(snap.routeLegs)
      setRouteError(snap.routeError)
      setFare(snap.fare)
      setFareError(snap.fareError)
      setFavorites(snap.favorites)
      setTime(snap.time)
    }

    setIsOnboardingDemo(false)
    setOnboardingTourOpen(false)
    setOnboardingSeen()
  }, [])

  useEffect(() => {
    const seen = getOnboardingSeen()
    if (!seen && !initialFrom && !initialTo) {
      setOnboardingTourOpen(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (isOnboardingDemo) return
    if (favoritesMounted.current) {
      saveFavorites(favorites)
    } else {
      favoritesMounted.current = true
    }
  }, [favorites, isOnboardingDemo])

  useEffect(() => {
    if (isOnboardingDemo) return
    const params = new URLSearchParams()
    if (originStation) params.set("from", originStation.id)
    if (destinationStation) params.set("to", destinationStation.id)
    const qs = params.toString()
    const newUrl = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname
    window.history.replaceState(null, "", newUrl)
  }, [originStation, destinationStation, isOnboardingDemo])

  useEffect(() => {
    if (isOnboardingDemo) return
    savePrefs({
      region,
      originStationId: originStation?.id ?? null,
      destinationStationId: destinationStation?.id ?? null,
    })
  }, [region, originStation, destinationStation, isOnboardingDemo])

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
    if (isOnboardingDemo) return
    if (!originStation || !destinationStation) {
      setRouteLegs(null)
      setRouteError(null)
      return
    }
    fetchRoute()
  }, [fetchRoute, originStation, destinationStation, isOnboardingDemo])

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
    if (isOnboardingDemo) return
    if (!originStation || !destinationStation) {
      setFare(null)
      setFareError(false)
      return
    }
    fetchFare()
  }, [fetchFare, originStation, destinationStation, isOnboardingDemo])

  const showRouteItinerary =
    originStation && destinationStation && routeLegs && !routeError

  const showNoRouteError =
    originStation &&
    destinationStation &&
    routeError &&
    !isLoadingRoute

  const showLoading =
    originStation && destinationStation && isLoadingRoute && !isOnboardingDemo

  const showDestinationPrompt =
    originStation && !destinationStation

  const showInitialPrompt =
    !originStation

  return (
    <>
      <KRLOnboardingTour
        run={onboardingTourOpen}
        onInjectMockData={handleInjectMockData}
        onTourEnd={handleTourEnd}
      />

      <div className="mt-4 w-full">
        <div className="flex items-center justify-between">
          <div />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOnboardingTourOpen(true)}
            className="gap-1.5 text-xs text-slate-400 hover:text-slate-600"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Bantuan
          </Button>
        </div>

        <div id="krl-favorites-bar">
          <FavoriteRoutesBar
            favorites={favorites}
            stations={stations}
            onSelect={handleSelectFavorite}
            onRemove={handleRemoveFavorite}
            isDemo={isOnboardingDemo}
          />
        </div>

        <div className="mt-4" id="krl-region-select">
          <label htmlFor="region" className="mb-1 block text-sm">Area</label>
          <Select value={region} onValueChange={handleRegionChange}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {regionKeys.map((r) => (
                <SelectItem key={r} value={r}>
                  {convertToTitleCase(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3" id="krl-origin-combobox">
          <label className="mb-1 block text-sm">Stasiun Asal</label>
          <StationCombobox
            stations={stationList}
            selectedStation={originStation}
            onSelect={handleOriginSelect}
            placeholder="Pilih Stasiun Asal"
          />
        </div>

        <div id="krl-swap-button">
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
                  id="krl-favorite-toggle"
                  onClick={handleToggleFavorite}
                  className="h-11 w-11 rounded-pill bg-white"
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
        </div>

        <div id="krl-destination-combobox">
          <label className="mb-1 block text-sm">Stasiun Tujuan</label>
          <StationCombobox
            stations={stationList}
            selectedStation={destinationStation}
            onSelect={handleDestinationSelect}
            placeholder="Pilih Stasiun Tujuan"
          />
        </div>

        <div className="mt-3" id="krl-time-select">
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
                    variant="outline"
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
          <div id="krl-route-result">
            <RouteItinerary
              legs={routeLegs}
              fare={fare}
              isFareLoading={isLoadingFare}
              fareError={fareError}
              isDemo={isOnboardingDemo}
            />
          </div>
        )}
      </div>
    </>
  )
}
