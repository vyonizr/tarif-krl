'use client'
import { useState, useEffect, useMemo, Fragment } from 'react'

import Spinner from '@/components/Spinner'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

import { IMRTStation, IOfficialMRTStation, IMRTRoute, IMRTStop } from '../types'
import { formatToRupiah, getCurrentTimeInHHMM, getTypeOfDay } from '../utils'
import { SAME_STATION_PENALTY_FARE, HOURS } from '../constants'

interface IMRTRouteFormProps {
  stations: IMRTStation[]
  officialMRTStations: IOfficialMRTStation[]
  routes: IMRTRoute[]
}

const FROM_NOW = 'Sekarang'
const TYPE_OF_DAY = {
  WEEKDAY: 'weekday',
  WEEKEND: 'weekend',
}
const STATIONS = {
  LEBAK_BULUS_GRAB: 'Lebak Bulus Grab',
}

const TYPE_OF_DAY_OPTIONS = [
  { id: 'weekday-radio', value: TYPE_OF_DAY.WEEKDAY, label: '💼 Senin-Jumat' },
  {
    id: 'weekend-radio',
    value: TYPE_OF_DAY.WEEKEND,
    label: '🌴 Akhir Pekan/Libur',
  },
]

export default function MRTRouteForm({
  stations,
  officialMRTStations,
  routes,
}: IMRTRouteFormProps) {
  const [originStation, setOriginStation] = useState<IMRTStation | null>(null)
  const [destinationStation, setDestinationStation] =
    useState<IMRTStation | null>(null)

  const [isLoadingFare, setIsLoadingFare] = useState(false)

  const [fare, setFare] = useState<number | null>(null)
  const [selectedLastStation, setSelectedLastStation] =
    useState<string | null>(null)
  const [typeOfDay, setTypeOfDay] = useState(getTypeOfDay())
  const [time, setTime] = useState<typeof HOURS[number] | 'Sekarang'>(FROM_NOW)
  const [routeOptions, setRouteOptions] = useState<IMRTRoute[]>([])
  const [passedStations, setPassedStations] = useState<IMRTStop[]>([])
  const [recommendedRoute, setRecommendedRoute] =
    useState<IMRTRoute | null>(null)

  useEffect(() => {
    async function getSchedule() {
      try {
        setIsLoadingFare(true)
        if (originStation) {
          const filteredRoute = routes.filter(
            (route) => route.name !== originStation.name
          )
          setRouteOptions(filteredRoute)
          if (destinationStation) {
            if (originStation.id === destinationStation.id) {
              setFare(SAME_STATION_PENALTY_FARE)
            } else {
              const response = await fetch(
                '/api/mrt/fare?' +
                  new URLSearchParams({
                    from: String(originStation.id),
                    to: String(destinationStation.id),
                  })
              )
              const responseJSON = await response.json()
              setFare(responseJSON.fare)
              setPassedStations(responseJSON.passed_stations)
              const designatedRoute = routes.find(
                (route) => route.id === responseJSON.route_id
              )
              if (designatedRoute) {
                setSelectedLastStation(designatedRoute.name)
                setRecommendedRoute(designatedRoute)
              } else {
                setSelectedLastStation(filteredRoute[0].name)
                setRecommendedRoute(null)
              }
            }
          } else {
            setSelectedLastStation(filteredRoute[0].name)
          }
        }
      } catch (error) {
        console.error(error)
        setFare(null)
      } finally {
        setIsLoadingFare(false)
      }
    }

    getSchedule()
  }, [originStation, destinationStation, routes])

  const MRTSchedule = useMemo(() => {
    if (originStation !== null) {
      const schedule = officialMRTStations.find(
        (MRTStation) => MRTStation.nid === originStation.nid
      )
      if (schedule) {
        const scheduleArray = parseStringTimeToArray(
          typeOfDay === 'weekday'
            ? selectedLastStation === STATIONS.LEBAK_BULUS_GRAB
              ? schedule.jadwal_lb_biasa
              : schedule.jadwal_hi_biasa
            : selectedLastStation === STATIONS.LEBAK_BULUS_GRAB
            ? schedule.jadwal_lb_libur
            : schedule.jadwal_hi_libur
        )

        return scheduleArray.filter(
          (scheduledTime) =>
            scheduledTime >= (time === FROM_NOW ? getCurrentTimeInHHMM() : time)
        )
      }
    }

    return []
  }, [officialMRTStations, originStation, typeOfDay, selectedLastStation, time])

  function parseStringTimeToArray(time: string) {
    if (time) {
      const correctedTime = time.replace(/:\s/g, ', ')
      return correctedTime.split(/,\s|\t|(?:^|[^0-9])(?=[0-9]{2}:)/) || []
    }

    return []
  }

  return (
    <div className="w-full mt-4">
      <div>
        <label htmlFor="originStation" className="mb-1 block text-sm">
          Stasiun Asal
        </label>
        <Select
          value={originStation ? String(originStation.id) : undefined}
          onValueChange={(value) => {
            setOriginStation(
              stations.find((s) => String(s.id) === value) || null
            )
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pilih Stasiun Asal" />
          </SelectTrigger>
          <SelectContent>
            {stations.map((station) => (
              <SelectItem key={station.id} value={String(station.id)}>
                {station.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {originStation !== null ? (
          <>
            <div className="mt-3">
              <label htmlFor="destinationStation" className="mb-1 block text-sm">
                Stasiun Tujuan
              </label>
              <Select
                value={destinationStation ? String(destinationStation.id) : undefined}
                onValueChange={(value) => {
                  setDestinationStation(
                    stations.find((s) => String(s.id) === value) || null
                  )
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih Stasiun Tujuan" />
                </SelectTrigger>
                <SelectContent>
                  {stations.map((station) => (
                    <SelectItem key={station.id} value={String(station.id)}>
                      {station.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4 flex flex-col items-center">
              <p className="text-lg">Tarif:</p>
              {isLoadingFare ? (
                <Spinner className="mt-2" />
              ) : (
                <>
                  <p
                    className={`text-2xl font-bold ${
                      fare !== null ? 'text-amber-600' : ''
                    }`}
                  >
                    {fare !== null ? formatToRupiah(fare) : '-'}
                  </p>
                  <p className="text-slate-500 text-center">
                    {passedStations.length > 0 &&
                    originStation.name !== destinationStation?.name ? (
                      <>
                        <small>
                          Jurusan <strong>{recommendedRoute?.name}</strong>
                          <br />
                        </small>
                        <small>
                          {passedStations.map((station, index) => (
                            <Fragment key={station.id}>
                              {station.stations.name}
                              {index !== passedStations.length - 1 ? ' → ' : ''}
                            </Fragment>
                          ))}
                        </small>
                      </>
                    ) : null}
                  </p>
                </>
              )}
            </div>
            <hr className="mt-4 border-t-2 border-slate-200 rounded-control" />
            <h2 className="mt-2 mb-4 text-xl text-center font-medium">
              Jadwal MRT <strong>{originStation.name}</strong>
            </h2>
            <div className="w-full">
              <label htmlFor="lastStation" className="mb-1 block text-sm">
                Jurusan MRT
              </label>
              <Select
                value={selectedLastStation || undefined}
                onValueChange={setSelectedLastStation}
                disabled={routeOptions.length <= 1}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {routeOptions.map((route) => (
                    <SelectItem key={route.id} value={route.name}>
                      {route.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full mt-3">
              <label htmlFor="time" className="mb-1 block text-sm">
                Waktu Keberangkatan dari
              </label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FROM_NOW}>{FROM_NOW}</SelectItem>
                  {HOURS.map((hour) => (
                    <SelectItem key={hour} value={hour}>
                      {hour}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4 flex justify-between flex-wrap gap-x-2">
              {TYPE_OF_DAY_OPTIONS.map((typeOfDayOption) => (
                <div key={typeOfDayOption.id}>
                  <input
                    type="radio"
                    id={typeOfDayOption.id}
                    name="typeOfDay"
                    value={typeOfDayOption.value}
                    checked={typeOfDay === typeOfDayOption.value}
                    onChange={(e) => {
                      setTypeOfDay(e.target.value)
                    }}
                  />
                  <label
                    htmlFor={typeOfDayOption.id}
                    className="lg:hover:underline cursor-pointer"
                  >
                    {typeOfDayOption.label}
                  </label>
                </div>
              ))}
            </div>
            <table className="mt-4 w-full">
              <thead>
                <tr>
                  <th className="text-left py-1">Jurusan</th>
                  <th className="py-1">Berangkat</th>
                </tr>
              </thead>
              <tbody>
                {MRTSchedule.map((schedule, index) => (
                  <tr key={index}>
                    <td className="text-left py-1">{selectedLastStation}</td>
                    <td className="text-center py-1">{schedule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </div>
    </div>
  )
}
