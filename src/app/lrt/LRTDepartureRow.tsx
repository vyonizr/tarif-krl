"use client"
import { useState } from "react"
import { ChevronDown, ChevronRight, ArrowRightLeft } from "lucide-react"
import { ILRTJourneyResult, LRTDayType } from "@/lib/lrt/types"
import { LRT_MINUTES_PER_STOP } from "@/lib/lrt/constants"
import { convertTimeToHHMM, calculateMRTETA } from "../utils"

interface LRTDepartureRowProps {
  departureTime: string
  journeyResult: ILRTJourneyResult
  typeOfDay: LRTDayType
  isFirst: boolean
}

export default function LRTDepartureRow({
  departureTime,
  journeyResult,
  typeOfDay,
  isFirst,
}: LRTDepartureRowProps) {
  const [expanded, setExpanded] = useState(false)

  const isTransfer = journeyResult.type === "transfer"
  const leg1 = isTransfer ? journeyResult.legs[0] : journeyResult
  const leg2 = isTransfer ? journeyResult.legs[1] : null

  const depHHMM = convertTimeToHHMM(departureTime)
  const leg1StopCount = leg1.stations.length
  const leg1Arrival = calculateMRTETA(
    depHHMM,
    String((leg1StopCount - 1) * LRT_MINUTES_PER_STOP)
  )

  let connectingDeparture: string | null = null
  let hasConnectingTrain = false
  let finalETA = leg1Arrival

  if (isTransfer && leg2) {
    const leg2Schedule =
      typeOfDay === "holiday" ? leg2.schedule.holiday : leg2.schedule.weekday
    connectingDeparture =
      leg2Schedule.find((t) => convertTimeToHHMM(t) >= leg1Arrival) ?? null
    hasConnectingTrain = connectingDeparture !== null
    if (connectingDeparture) {
      finalETA = calculateMRTETA(
        convertTimeToHHMM(connectingDeparture),
        String((leg2.stations.length - 1) * LRT_MINUTES_PER_STOP)
      )
    }
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full px-3 py-2 text-left text-sm tabular-nums ${
          isFirst && !expanded
            ? "bg-[#E7EEF8] font-semibold text-[#19519A]"
            : ""
        } ${expanded ? "bg-slate-50 font-medium text-slate-800" : ""}`}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <span>{convertTimeToHHMM(departureTime)}</span>
          {hasConnectingTrain || !isTransfer ? (
            <span
              className={
                isFirst && !expanded ? "text-[#19519A]" : "text-slate-400"
              }
            >
              &rarr; tiba {finalETA}
            </span>
          ) : (
            <span className="text-red-400">
              &rarr; tidak ada lanjutan
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-white px-3 pb-3 pt-1">
          <StopTable
            stations={leg1.stations}
            departureTime={departureTime}
            headingTowards={
              isTransfer ? `Arah ${leg1.headingTowards}` : undefined
            }
          />

          {isTransfer && leg2 && (
            <>
              {connectingDeparture ? (
                <>
                  <TransferConnector
                    station={journeyResult.transferStation}
                    eta={leg1Arrival}
                  />
                  <StopTable
                    stations={leg2.stations.slice(1)}
                    departureTime={connectingDeparture}
                    headingTowards={`Arah ${leg2.headingTowards}`}
                  />
                </>
              ) : (
                <div className="py-4 text-center text-sm text-red-500">
                  Tidak ada kereta lanjutan hari ini
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function StopTable({
  stations,
  departureTime,
  headingTowards,
}: {
  stations: { slug: string; name: string }[]
  departureTime: string
  headingTowards?: string
}) {
  const depHHMM = convertTimeToHHMM(departureTime)

  return (
    <div className="py-2">
      {headingTowards && (
        <p className="mb-2 text-xs font-medium text-slate-500">
          {headingTowards}
        </p>
      )}
      {stations.map((st, i) => (
        <div key={st.slug}>
          <div className="grid grid-cols-[20px_1fr_auto] items-start gap-x-3 py-1">
            <div className="relative flex justify-center">
              <div
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white ${
                  i === 0
                    ? "bg-green-500"
                    : i === stations.length - 1
                      ? "bg-red-500"
                      : "bg-slate-400"
                }`}
              />
            </div>
            <div className="min-w-0 text-sm">{st.name}</div>
            <div className="shrink-0 text-sm tabular-nums text-slate-500">
              {i === 0
                ? depHHMM
                : calculateMRTETA(depHHMM, String(i * LRT_MINUTES_PER_STOP))}
            </div>
          </div>
          {i < stations.length - 1 && (
            <div className="grid grid-cols-[20px_1fr_auto] gap-x-3">
              <div className="flex justify-center">
                <div className="h-3 w-0.5 bg-slate-200" />
              </div>
              <div />
              <div />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TransferConnector({
  station,
  eta,
}: {
  station: string
  eta: string
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white">
        <ArrowRightLeft className="h-4 w-4 text-slate-400" />
      </div>
      <div className="text-sm text-slate-500">
        Transit di {station} (perkiraan tiba {eta})
      </div>
    </div>
  )
}
