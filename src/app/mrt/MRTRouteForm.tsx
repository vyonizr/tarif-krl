'use client'
import { useState, useEffect, useMemo } from 'react'
import { IMRTStation, IOfficialMRTStation, IMRTRoute, IMRTStop } from '../types'
import Spinner from '../Spinner'
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
            ? selectedLastStation === 'Lebak Bulus'
              ? schedule.jadwal_lb_biasa
              : schedule.jadwal_hi_biasa
            : selectedLastStation === 'Lebak Bulus'
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
      return correctedTime.split(/,\s|\t|(?<!\d)(?=\d{2}:)/) || []
    }

    return []
  }

  console.log(passedStations, '<== passedStations')

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
              stations.find(
                (station) => String(station.id) === e.target.value
              ) || null
            )
          }}
          className='w-full py-2 px-4 bg-slate-100 rounded'
          value={originStation?.id || 'Pilih Stasiun Asal'}
        >
          <option disabled className='py-2'>
            Pilih Stasiun Asal
          </option>
          {stations.map((station) => (
            <option key={station.id} value={station.id} className='py-2'>
              {station.name}
            </option>
          ))}
        </select>
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
                    stations.find(
                      (station) => String(station.id) === e.target.value
                    ) || null
                  )
                }}
                className='w-full py-2 px-4 bg-slate-100 rounded'
                value={destinationStation?.id || 'Pilih Stasiun Tujuan'}
              >
                <option disabled>Pilih Stasiun Tujuan</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name}
                  </option>
                ))}
              </select>
            </div>
            <div className='mt-4 flex flex-col items-center'>
              <p className='text-lg'>Tarif:</p>
              {isLoadingFare ? (
                <Spinner />
              ) : (
                <>
                  <p
                    className={`text-2xl ${
                      fare !== null ? 'text-red-500' : ''
                    }`}
                  >
                    <strong>
                      {fare !== null ? formatToRupiah(fare) : '-'}
                    </strong>
                  </p>
                  <p className='text-gray-500 text-center'>
                    {passedStations.length > 0 &&
                    originStation.name !== destinationStation?.name ? (
                      <>
                        <small>
                          Jurusan <strong>{recommendedRoute?.name}</strong>
                          <br />
                        </small>
                        <small>
                          {passedStations.map((station, index) => (
                            <span key={station.id}>
                              {station.stations.name}
                              {index !== passedStations.length - 1 ? ' → ' : ''}
                            </span>
                          ))}
                        </small>
                      </>
                    ) : null}
                  </p>
                </>
              )}
              {originStation.name === destinationStation?.name ? (
                <small className='text-red-500'>
                  (Denda masuk dan keluar di stasiun yang sama)
                </small>
              ) : null}
            </div>
            <hr className='mt-4 border-t-2 border-gray-200 rounded' />
            <h2 className='mt-2 mb-4 text-xl text-center font-medium'>
              Jadwal MRT <strong>{originStation.name}</strong>
            </h2>
            <div className='w-full'>
              <label htmlFor='time' className='block'>
                Jurusan MRT
              </label>
              <select
                name='lastStation'
                onChange={(e) => {
                  setSelectedLastStation(e.target.value)
                }}
                className='w-full py-2 px-4 bg-slate-100 rounded'
                value={selectedLastStation || ''}
                disabled={routeOptions.length <= 1}
              >
                {routeOptions.map((route) => (
                  <option key={route.id} value={route.name}>
                    {route.name}
                  </option>
                ))}
              </select>
            </div>
            <div className='w-full mt-2'>
              <label htmlFor='time' className='block'>
                Waktu Keberangkatan dari
              </label>
              <select
                name='time'
                onChange={(e) => {
                  setTime(e.target.value)
                }}
                className='w-full py-2 px-4 bg-slate-100 rounded'
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
            <div className='mt-4 flex justify-between flex-wrap gap-x-2'>
              <div>
                <input
                  type='radio'
                  id='weekday-radio'
                  name='typeOfDay'
                  value={TYPE_OF_DAY.WEEKDAY}
                  checked={typeOfDay === TYPE_OF_DAY.WEEKDAY}
                  onChange={(e) => {
                    setTypeOfDay(e.target.value)
                  }}
                />
                <label
                  htmlFor='weekday-radio'
                  className='lg:hover:underline cursor-pointer'
                >
                  💼 Senin-Jumat
                </label>
              </div>
              <div>
                <input
                  type='radio'
                  id='weekend-radio'
                  name='typeOfDay'
                  value={TYPE_OF_DAY.WEEKEND}
                  checked={typeOfDay === TYPE_OF_DAY.WEEKEND}
                  onChange={(e) => {
                    setTypeOfDay(e.target.value)
                  }}
                />
                <label
                  htmlFor='weekend-radio'
                  className='lg:hover:underline cursor-pointer'
                >
                  🌴 Akhir Pekan/Libur
                </label>
              </div>
            </div>
            <table className='mt-4 w-full'>
              <thead>
                <tr>
                  <th className='text-left py-1'>Jurusan</th>
                  <th className='py-1'>Berangkat</th>
                </tr>
              </thead>
              <tbody>
                {MRTSchedule.map((schedule, index) => (
                  <tr key={index}>
                    <td className='text-left py-1'>{selectedLastStation}</td>
                    <td className='text-center py-1'>{schedule}</td>
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
