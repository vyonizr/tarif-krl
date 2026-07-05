"use client"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Banknote, ArrowRightLeft } from "lucide-react"

import Spinner from "@/components/Spinner"
import { Button } from "@/components/ui/button"

import { IMRTStation, IMrtFareScheduleResult } from "@/lib/mrt/types"
import { SAME_STATION_PENALTY_FARE } from "@/lib/mrt/constants"
import {
  formatToRupiah,
  getCurrentTimeInHHMM,
  getTypeOfDay,
  convertTimeToHHMM,
  calculateMRTETA,
} from "../utils"

import MRTStationCombobox from "./MRTStationCombobox"
import SwapButton from "../krl/SwapButton"
import TimeSelect from "../krl/TimeSelect"

const FROM_NOW = "Sekarang"

interface MRTRouteFormProps {
  stations: IMRTStation[]
}

export default function MRTRouteForm({ stations }: MRTRouteFormProps) {
  const [originStation, setOriginStation] = useState<IMRTStation | null>(null)
  const [destinationStation, setDestinationStation] =
    useState<IMRTStation | null>(null)
  const [time, setTime] = useState<string>(FROM_NOW)

  const [isLoadingFare, setIsLoadingFare] = useState(false)

  const [fare, setFare] = useState<number | null>(null)
  const [timeEstimation, setTimeEstimation] = useState<number | null>(null)
  const [headingTowards, setHeadingTowards] = useState<string | null>(null)
  const [schedule, setSchedule] = useState<{
    weekdays: string[]
    weekends: string[]
  }>({ weekdays: [], weekends: [] })
  const [fareError, setFareError] = useState(false)

  const fareRequestId = useRef(0)

  const typeOfDay = useMemo(() => getTypeOfDay(), [])

  const fetchFare = useCallback(async () => {
    if (!originStation || !destinationStation) return
    if (originStation.id === destinationStation.id) {
      setFare(SAME_STATION_PENALTY_FARE)
      setTimeEstimation(null)
      setHeadingTowards(null)
      setSchedule({ weekdays: [], weekends: [] })
      setFareError(false)
      return
    }
    const requestId = ++fareRequestId.current
    setIsLoadingFare(true)
    setFareError(false)
    setFare(null)
    setTimeEstimation(null)
    setHeadingTowards(null)
    setSchedule({ weekdays: [], weekends: [] })
    try {
      const res = await fetch(
        "/api/mrt/fare?" +
          new URLSearchParams({
            from: String(originStation.id),
            to: String(destinationStation.id),
          })
      )
      const resJSON = await res.json()
      if (requestId !== fareRequestId.current) return
      if (resJSON.data) {
        const data: IMrtFareScheduleResult = resJSON.data
        setFare(data.fare)
        setTimeEstimation(data.timeEstimation)
        setHeadingTowards(data.headingTowards)
        setSchedule(data.schedule)
      } else {
        setFareError(true)
      }
    } catch {
      if (requestId !== fareRequestId.current) return
      setFareError(true)
    } finally {
      if (requestId === fareRequestId.current) setIsLoadingFare(false)
    }
  }, [originStation, destinationStation])

  useEffect(() => {
    if (!originStation || !destinationStation) {
      setFare(null)
      setTimeEstimation(null)
      setHeadingTowards(null)
      setSchedule({ weekdays: [], weekends: [] })
      setFareError(false)
      return
    }
    fetchFare()
  }, [fetchFare, originStation, destinationStation])

  const handleOriginSelect = useCallback((station: IMRTStation) => {
    setOriginStation(station)
  }, [])

  const handleDestinationSelect = useCallback((station: IMRTStation) => {
    setDestinationStation(station)
  }, [])

  const handleSwap = useCallback(() => {
    setOriginStation(destinationStation)
    setDestinationStation(originStation)
  }, [originStation, destinationStation])

  const departureTimes = useMemo(() => {
    const daySchedule =
      typeOfDay === "weekday" ? schedule.weekdays : schedule.weekends
    const resolvedTime = time === FROM_NOW ? getCurrentTimeInHHMM() : time
    return daySchedule
      .filter((t) => convertTimeToHHMM(t) >= resolvedTime)
      .slice(0, 5)
  }, [schedule, time, typeOfDay])

  const showSameStationNotice =
    originStation &&
    destinationStation &&
    originStation.id === destinationStation.id

  const showLoading =
    !showSameStationNotice &&
    originStation &&
    destinationStation &&
    isLoadingFare

  const showFareError =
    !showSameStationNotice &&
    originStation &&
    destinationStation &&
    fareError &&
    !isLoadingFare

  const showDestinationPrompt = originStation && !destinationStation

  const showInitialPrompt = !originStation

  return (
    <div className="mt-4 w-full">
      <div id="mrt-origin-combobox">
        <label className="mb-1 block text-sm">Stasiun Asal</label>
        <MRTStationCombobox
          stations={stations}
          selectedStation={originStation}
          onSelect={handleOriginSelect}
          placeholder="Pilih Stasiun Asal"
        />
      </div>

      <SwapButton
        id="mrt-swap-button"
        onSwap={handleSwap}
        disabled={!originStation && !destinationStation}
      />

      <div id="mrt-destination-combobox">
        <label className="mb-1 block text-sm">Stasiun Tujuan</label>
        <MRTStationCombobox
          stations={stations}
          selectedStation={destinationStation}
          onSelect={handleDestinationSelect}
          placeholder="Pilih Stasiun Tujuan"
        />
      </div>

      <div className="mt-3" id="mrt-time-select">
        <label className="mb-1 block text-sm">Waktu Keberangkatan</label>
        <TimeSelect value={time} onChange={setTime} />
      </div>

      {showInitialPrompt && (
        <div className="mt-8 text-center text-sm text-slate-500">
          Pilih stasiun asal dan tujuan untuk melihat tarif & jadwal
        </div>
      )}

      {showDestinationPrompt && (
        <div className="mt-8 text-center text-sm text-slate-500">
          Pilih stasiun tujuan untuk melihat tarif & jadwal
        </div>
      )}

      {showLoading && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <Spinner />
          <p className="text-xs text-slate-400">Memuat tarif & jadwal...</p>
        </div>
      )}

      {showFareError && (
        <div className="mt-8">
          <div className="rounded-lg bg-red-50 p-4 text-center">
            <p className="text-sm text-red-600">
              Gagal memuat tarif dan jadwal, coba lagi
            </p>
            <Button onClick={fetchFare} variant="outline" className="mt-3">
              Coba Lagi
            </Button>
          </div>
        </div>
      )}

      {showSameStationNotice && (
        <div className="mt-8 rounded-lg bg-amber-50 p-4 text-center">
          <p className="text-sm text-amber-800">
            Stasiun asal dan tujuan sama. Tap masuk dan keluar di stasiun yang
            sama dikenakan tarif flat{" "}
            <span className="font-semibold">
              {formatToRupiah(SAME_STATION_PENALTY_FARE)}
            </span>
            .
          </p>
        </div>
      )}

      {!showSameStationNotice && !isLoadingFare && fare !== null && (
        <div className="mt-8">
          <div className="mb-4 space-y-1 rounded-lg border border-amber-200/60 bg-amber-50 px-4 py-3 text-amber-900">
            {headingTowards && (
              <div className="grid grid-cols-[20px_1fr] items-center gap-x-3">
                <ArrowRightLeft className="h-4 w-4" />
                <span className="text-sm">Arah {headingTowards}</span>
              </div>
            )}
            <div className="grid grid-cols-[20px_1fr] items-center gap-x-3">
              <Banknote className="h-4 w-4" />
              <span className="text-sm">{formatToRupiah(fare)}</span>
            </div>
          </div>

          {departureTimes.length > 0 && (
            <div className="w-full">
              <p className="mb-1 text-center text-sm font-medium text-slate-700">
                Kereta Berikutnya
              </p>
              <div id="mrt-departure-list" className="divide-y divide-slate-100">
                {departureTimes.map((t, i) => (
                  <div
                    key={i}
                    data-testid="mrt-departure-row"
                    className={`px-3 py-1.5 text-center text-sm tabular-nums ${
                      i === 0
                        ? "rounded-md bg-[#E7EEF8] font-semibold text-[#19519A]"
                        : "text-slate-600"
                    }`}
                  >
                    {convertTimeToHHMM(t)}
                    {timeEstimation !== null && (
                      <span className="text-slate-400">
                        {" "}
                        &rarr; tiba{" "}
                        {calculateMRTETA(convertTimeToHHMM(t), String(timeEstimation))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-center text-xs text-slate-400">
            Data tarif &amp; jadwal bersumber dari{" "}
            <a
              href="https://www.jakartamrt.co.id/rencana-perjalanan"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              MRT Jakarta
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
