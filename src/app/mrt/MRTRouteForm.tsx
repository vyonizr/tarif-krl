"use client"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"

import Spinner from "@/components/Spinner"
import { Button } from "@/components/ui/button"

import { IMRTStation, IMrtFareScheduleResult } from "@/lib/mrt/types"
import { SAME_STATION_PENALTY_FARE } from "@/lib/mrt/constants"
import { formatToRupiah, getCurrentTimeInHHMM, getTypeOfDay, convertTimeToHHMM } from "../utils"

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
    return daySchedule.filter((t) => t >= resolvedTime)
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
          <div className="text-center">
            <p className="text-2xl font-bold">{formatToRupiah(fare)}</p>
            {timeEstimation !== null && (
              <p className="mt-1 text-sm text-slate-500">
                ~{timeEstimation} menit
              </p>
            )}
          </div>

          {headingTowards && departureTimes.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-center text-base font-medium">
                Menuju {headingTowards}
              </h2>
              <table className="w-full rounded-control border border-slate-200">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2 text-left text-sm font-medium text-slate-600">
                      Keberangkatan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {departureTimes.map((t, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-200 last:border-b-0"
                    >
                      <td className="px-3 py-2 text-sm text-slate-700">
                        {convertTimeToHHMM(t)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
