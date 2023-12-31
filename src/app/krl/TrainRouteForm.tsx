'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'

import PenaltyNotification from '@/components/PenaltyNotification'
import Spinner from '@/components/Spinner'

import { HOURS, KRL_REGION } from '../constants'
import {
  IStationState,
  KRLStation,
  IFareResponse,
  IKRLSchedule,
  IKRLScheduleResponse,
} from '../types'
import {
  convertToTitleCase,
  formatToRupiah,
  getCurrentTimeInHHMM,
  convertTimeToHHMM,
} from '../utils'

interface ITrainRouteFormProps {
  stations: IStationState
}

const ALL_STATIONS = 'Semua Jurusan'
const FROM_NOW = 'Sekarang'

function TrainRouteForm({ stations }: ITrainRouteFormProps) {
  const [region, setRegion] = useState<keyof IStationState>(
    Object.keys(stations)[0]
  )
  const [originStation, setOriginStation] = useState<KRLStation | null>(null)
  const [destinationStation, setDestinationStation] =
    useState<KRLStation | null>(null)

  const [isLoadingFare, setIsLoadingFare] = useState(false)
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false)

  const [fare, setFare] = useState<number | null>(null)
  const [schedule, setSchedule] = useState<IKRLSchedule[] | []>([])
  const [time, setTime] = useState<typeof HOURS[number] | 'Sekarang'>(FROM_NOW)
  const [lastStationOptions, setLastStationOptions] = useState<string[]>([])
  const [selectedLastStation, setSelectedLastStation] = useState(ALL_STATIONS)

  const stationList: KRLStation[] = useMemo(() => {
    if (region !== null) {
      return stations[region]
    }

    return []
  }, [region, stations])

  useEffect(() => {
    setOriginStation(null)
    setDestinationStation(null)
    setFare(null)
    setSchedule([])
    setLastStationOptions([])
    setSelectedLastStation(ALL_STATIONS)
  }, [region])

  useEffect(() => {
    async function getFare(
      originStation: KRLStation | null,
      destinationStation: KRLStation | null
    ) {
      try {
        setIsLoadingFare(true)
        if (originStation && destinationStation) {
          const res = await fetch(
            `/api/fare?` +
              new URLSearchParams({
                from: originStation.sta_id,
                to: destinationStation.sta_id,
              })
          )
          const resJSON: IFareResponse = await res.json()
          setFare(resJSON.data[0].fare)
        }
      } catch (error) {
        console.error(error)
        setFare(null)
      } finally {
        setIsLoadingFare(false)
      }
    }
    getFare(originStation, destinationStation)
  }, [originStation, destinationStation])

  useEffect(() => {
    async function getSchedule(originStation: KRLStation | null) {
      try {
        if (originStation !== null) {
          setSelectedLastStation(ALL_STATIONS)
          setIsLoadingSchedule(true)
          const res = await fetch(
            `/api/schedule?` +
              new URLSearchParams({
                station_id: originStation.sta_id,
                time_from: time === FROM_NOW ? getCurrentTimeInHHMM() : time,
              })
          )
          const resJSON: IKRLScheduleResponse = await res.json()
          const lastStationsResponse = resJSON.data.map(
            (schedule) => schedule.dest
          )
          const noDuplicateStations = [...new Set(lastStationsResponse)].sort(
            (a, b) => {
              const nameA = a.toLowerCase()
              const nameB = b.toLowerCase()

              if (nameA < nameB) {
                return -1
              }
              if (nameA > nameB) {
                return 1
              }
              return 0
            }
          )
          setSchedule(resJSON.data)
          setLastStationOptions(noDuplicateStations)
        }
      } catch (error) {
        console.error(error)
        setSchedule([])
      } finally {
        setIsLoadingSchedule(false)
      }
    }

    getSchedule(originStation)
  }, [originStation, time])

  const filteredSchedule = useMemo(() => {
    if (selectedLastStation === ALL_STATIONS) {
      return schedule
    }
    return schedule.filter((schedule) => schedule.dest === selectedLastStation)
  }, [schedule, selectedLastStation])

  useEffect(() => {
    setTime(FROM_NOW)
  }, [originStation])

  function getTrainRoutePicture(region: keyof IStationState) {
    switch (region) {
      case KRL_REGION.YOGYAKARTA:
        return '/rute_krl_yogyakarta.png'
      case KRL_REGION.JABODETABEK:
      default:
        return '/rute_krl_jabodetabek.png'
    }
  }

  return (
    <div className="mt-4 w-full">
      <div className="mt-4">
        <label htmlFor="region" className="block">
          Area
        </label>
        <select
          name="region"
          onChange={(e) => setRegion(e.target.value)}
          className="w-full rounded bg-slate-100 px-4 py-2"
          value={region || 'Pilih Wilayah'}
        >
          {Object.keys(stations).map((region, index) => (
            <option key={index} value={region} className="py-2">
              {convertToTitleCase(region)}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2">
        <label htmlFor="originStation" className="block">
          Stasiun Asal
        </label>
        <select
          name="originStation"
          onChange={(e) => {
            setOriginStation(
              stationList.find(
                (station) => station.sta_id === e.target.value
              ) || null
            )
          }}
          className="w-full rounded bg-slate-100 px-4 py-2"
          value={originStation?.sta_id || 'Pilih Stasiun Asal'}
        >
          <option disabled className="py-2">
            Pilih Stasiun Asal
          </option>
          {stationList.map((station) => (
            <option
              key={station.sta_id}
              value={station.sta_id}
              className="py-2"
            >
              {convertToTitleCase(station.sta_name)}
            </option>
          ))}
        </select>
      </div>
      {originStation !== null ? (
        <>
          <div className="mt-2">
            <label htmlFor="originStation" className="block">
              Stasiun Tujuan
            </label>
            <select
              name="destinationStation"
              onChange={(e) => {
                setDestinationStation(
                  stationList.find(
                    (station) => station.sta_id === e.target.value
                  ) || null
                )
              }}
              className="w-full rounded bg-slate-100 px-4 py-2"
              value={destinationStation?.sta_id || 'Pilih Stasiun Tujuan'}
            >
              <option disabled>Pilih Stasiun Tujuan</option>
              {stationList.map((station) => (
                <option key={station.sta_id} value={station.sta_id}>
                  {convertToTitleCase(station.sta_name)}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex flex-col items-center">
            <p className="text-lg">Tarif:</p>
            {isLoadingFare ? (
              <Spinner className="mt-2" />
            ) : (
              <>
                <p
                  className={`text-2xl ${fare !== null ? 'text-red-500' : ''}`}
                >
                  <strong>{fare !== null ? formatToRupiah(fare) : '-'}</strong>
                </p>
                {originStation.sta_name === destinationStation?.sta_name ? (
                  <PenaltyNotification />
                ) : null}
              </>
            )}
          </div>
          {originStation ? (
            <>
              <hr className="mt-4 rounded border-t-2 border-gray-200" />
              <div className="flex w-full flex-col items-center">
                <h2 className="mt-2 text-center text-xl font-medium">
                  Jadwal KRL{' '}
                  <strong>{convertToTitleCase(originStation?.sta_name)}</strong>
                </h2>
                <Link
                  href={getTrainRoutePicture(region)}
                  target="_blank"
                  className="mb-4 text-blue-500"
                >
                  Lihat peta rute
                </Link>
                <div className="w-full">
                  <label htmlFor="time" className="block">
                    Jurusan KRL
                  </label>
                  <select
                    name="lastStation"
                    onChange={(e) => {
                      setSelectedLastStation(e.target.value)
                    }}
                    className="w-full rounded bg-slate-100 px-4 py-2"
                    value={selectedLastStation}
                  >
                    <option value={ALL_STATIONS}>Semua Jurusan</option>
                    {lastStationOptions.map((station) => (
                      <option key={station} value={station}>
                        {convertToTitleCase(station)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-2 w-full">
                  <label htmlFor="time" className="block">
                    Waktu Keberangkatan dari
                  </label>
                  <select
                    name="time"
                    onChange={(e) => {
                      setTime(e.target.value)
                    }}
                    className="w-full rounded bg-slate-100 px-4 py-2"
                    value={time}
                  >
                    <option value={FROM_NOW}>{FROM_NOW}</option>
                    {HOURS.map((hour, index) => (
                      <option key={index} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                </div>
                {isLoadingSchedule ? (
                  <Spinner className="mt-2" />
                ) : filteredSchedule.length === 0 ? (
                  <p className="mt-4">Tidak ada jadwal</p>
                ) : (
                  <>
                    <small className="mt-4 self-start text-sm">
                      *Estimasi tiba di <strong>stasiun akhir</strong>
                    </small>
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="py-1 text-left">Jurusan</th>
                          <th className="py-1">Berangkat</th>
                          <th className="py-1">Tiba*</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSchedule.map((schedule) => (
                          <tr key={schedule.train_id}>
                            <td className="py-1 text-left">
                              {convertToTitleCase(schedule.dest)}
                            </td>
                            <td className="py-1 text-center">
                              {convertTimeToHHMM(schedule.time_est)}
                            </td>
                            <td className="py-1 text-center">
                              {convertTimeToHHMM(schedule.dest_time)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default TrainRouteForm
