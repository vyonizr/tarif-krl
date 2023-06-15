'use client'
import { useState, useMemo, useEffect } from 'react'

import { HOURS } from './constants'
import {
  IStationState,
  KRLStation,
  IFareResponse,
  IKRLSchedule,
  IKRLScheduleResponse,
} from './types'
import {
  convertToTitleCase,
  formatToRupiah,
  getCurrentTimeInHHMM,
  convertTimeToHHMM,
} from './utils'
import Spinner from './Spinner'

interface ITrainRouteFormProps {
  stations: IStationState
}

const ALL_STATIONS = 'Semua Jurusan'
const FROM_NOW = 'Sekarang'

function TrainRouteForm({ stations }: ITrainRouteFormProps) {
  const [region, _] = useState<keyof IStationState>(Object.keys(stations)[0])
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
    return stations[region] || []
  }, [region, stations])

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
          const noDuplicateStations = [...new Set(lastStationsResponse)].sort()
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

  return (
    <div className='w-full mt-4'>
      <div>
        <label htmlFor='originStation' className='block'>
          Stasiun Asal
        </label>
        <select
          name='originStation'
          onChange={(e) => {
            setOriginStation(
              stationList.find(
                (station) => station.sta_id === e.target.value
              ) || null
            )
          }}
          className='w-full py-2 px-4 bg-gray-100 rounded'
        >
          <option disabled selected className='py-2'>
            Pilih Stasiun Asal
          </option>
          {stationList.map((station) => (
            <option
              key={station.sta_id}
              value={station.sta_id}
              className='py-2'
            >
              {convertToTitleCase(station.sta_name)}
            </option>
          ))}
        </select>
      </div>
      {originStation !== null ? (
        <>
          <div className='mt-2'>
            <label htmlFor='originStation' className='block'>
              Stasiun Tujuan
            </label>
            <select
              name='destinationStation'
              onChange={(e) => {
                setDestinationStation(
                  stationList.find(
                    (station) => station.sta_id === e.target.value
                  ) || null
                )
              }}
              className='w-full py-2 px-4 bg-gray-100 rounded'
              value={destinationStation?.sta_id}
            >
              <option disabled selected>
                Pilih Stasiun Tujuan
              </option>
              {stationList.map((station) => (
                <option key={station.sta_id} value={station.sta_id}>
                  {convertToTitleCase(station.sta_name)}
                </option>
              ))}
            </select>
          </div>
          <div className='mt-4 flex flex-col items-center'>
            <p className='text-lg'>Tarif:</p>
            <p className={`text-xl ${fare !== null ? 'text-red-500' : ''}`}>
              {isLoadingFare ? (
                <Spinner />
              ) : (
                <strong>{fare !== null ? formatToRupiah(fare) : '-'}</strong>
              )}
            </p>
          </div>
          {originStation ? (
            <>
              <hr className='mt-4' />
              <div className='flex flex-col items-center w-full'>
                <h2 className='mt-2 text-xl text-center font-medium mb-4'>
                  Jadwal KRL{' '}
                  <strong>{convertToTitleCase(originStation?.sta_name)}</strong>
                </h2>
                <div className='w-full'>
                  <label htmlFor='time' className='block'>
                    Waktu Keberangkatan dari
                  </label>
                  <select
                    name='time'
                    onChange={(e) => {
                      setTime(e.target.value)
                    }}
                    className='w-full py-2 px-4 bg-gray-100 rounded'
                    value={time}
                  >
                    <option value={FROM_NOW} selected={time === FROM_NOW}>
                      {FROM_NOW}
                    </option>
                    {HOURS.map((hour, index) => (
                      <option key={index} value={hour} selected={time === hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                </div>
                <div className='w-full mt-2'>
                  <label htmlFor='time' className='block'>
                    Jurusan KRL:
                  </label>
                  <select
                    name='lastStation'
                    onChange={(e) => {
                      setSelectedLastStation(e.target.value)
                    }}
                    className='w-full py-2 px-4 bg-gray-100 rounded'
                    defaultValue={selectedLastStation}
                  >
                    <option value={ALL_STATIONS}>Semua Jurusan</option>
                    {lastStationOptions.map((station) => (
                      <option key={station} value={station}>
                        {convertToTitleCase(station)}
                      </option>
                    ))}
                  </select>
                </div>
                {isLoadingSchedule ? (
                  <Spinner />
                ) : (
                  <table className='mt-4 w-full'>
                    <tr>
                      <th className='py-1'>Waktu Keberangkatan</th>
                      <th className='text-left py-1'>Jurusan</th>
                    </tr>
                    <tbody>
                      {filteredSchedule.map((schedule) => (
                        <tr key={schedule.train_id}>
                          <td className='text-center py-1'>
                            {convertTimeToHHMM(schedule.time_est)}
                          </td>
                          <td className='text-left py-1'>
                            {convertToTitleCase(schedule.dest)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
