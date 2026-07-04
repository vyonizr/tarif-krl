"use client"
import { useState } from "react"
import { ChevronDown, ChevronRight, ArrowRightLeft, Clock, Banknote } from "lucide-react"
import { IKRLRouteResult, IKRLRouteStop } from "@/lib/krl/types"
import {
  formatToRupiah,
  convertTimeToHHMM,
  convertToTitleCase,
  calculateMinutesBetween,
  formatMinutesToDuration,
} from "@/app/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface RouteItineraryProps {
  legs: IKRLRouteResult[]
  fare: number | null
  isFareLoading: boolean
  fareError: boolean
}

function StopRow({
  stop,
  color,
}: {
  stop: IKRLRouteStop
  color: string
}) {
  return (
    <div className="grid grid-cols-[20px_1fr_auto] items-start gap-x-3 py-1.5">
      <div className="relative flex justify-center">
        <div
          className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-white"
          style={{ backgroundColor: color }}
        />
      </div>
      <div className="min-w-0 text-sm">{stop.station_name}</div>
      <div className="shrink-0 text-sm tabular-nums text-slate-500">
        {convertTimeToHHMM(stop.time_est)}
      </div>
    </div>
  )
}

function VerticalLine({ color }: { color: string }) {
  return (
    <div className="grid grid-cols-[20px_1fr_auto] gap-x-3">
      <div className="flex justify-center">
        <div className="h-4 w-0.5" style={{ backgroundColor: color }} />
      </div>
      <div />
      <div />
    </div>
  )
}

function ExpandableStops({
  stops,
  color,
}: {
  stops: IKRLRouteStop[]
  color: string
}) {
  const [expanded, setExpanded] = useState(false)

  if (stops.length <= 2) {
    return (
      <>
        {stops.map((stop, i) => (
          <StopRow
            key={stop.station_id}
            stop={stop}
            color={color}
          />
        ))}
      </>
    )
  }

  const [first, ...rest] = stops
  const middle = rest.slice(0, -1)
  const last = rest[rest.length - 1]

  return (
    <>
      <StopRow stop={first} color={color} />
      <VerticalLine color={color} />
      <div className="grid grid-cols-[20px_1fr_auto] gap-x-3">
        <div className="flex justify-center">
          <div className="h-4 w-0.5" style={{ backgroundColor: color }} />
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex min-h-[44px] items-center gap-1 text-left text-sm text-slate-500"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          +{middle.length} stasiun
        </button>
        <div />
      </div>
      {expanded && (
        <>
          {middle.map((stop, i) => (
            <div key={stop.station_id}>
              <VerticalLine color={color} />
              <StopRow
                stop={stop}
                color={color}
              />
            </div>
          ))}
        </>
      )}
      <VerticalLine color={color} />
      <StopRow stop={last} color={color} />
    </>
  )
}

export default function RouteItinerary({
  legs,
  fare,
  isFareLoading,
  fareError,
}: RouteItineraryProps) {
  if (!legs || legs.length === 0) return null

  const departureTime = legs[0].stops[0].time_est
  const lastLeg = legs[legs.length - 1]
  const arrivalTime = lastLeg.stops[lastLeg.stops.length - 1].time_est
  const durationMinutes = calculateMinutesBetween(departureTime, arrivalTime)

  let transferClause: string | null = null
  if (legs.length > 1) {
    const transferStations = legs.slice(0, -1).map((leg) => {
      const lastStop = leg.stops[leg.stops.length - 1]
      return convertToTitleCase(lastStop.station_name)
    })

    let nameList: string
    if (transferStations.length === 1) {
      nameList = transferStations[0]
    } else {
      nameList =
        transferStations.slice(0, -1).join(", ") +
        " & " +
        transferStations[transferStations.length - 1]
    }

    transferClause = `${transferStations.length}\u00d7 transit (${nameList})`
  }

  return (
    <div className="mt-6">
      <div className="mb-4 space-y-1 rounded-lg border border-amber-200/60 bg-amber-50 px-4 py-3 text-amber-900">
        <div className="grid grid-cols-[20px_1fr] items-center gap-x-3">
          <Clock className="h-4 w-4" />
          <span className="text-base font-medium">
            {formatMinutesToDuration(durationMinutes)} (estimasi tiba {convertTimeToHHMM(arrivalTime)} WIB)
          </span>
        </div>
        {transferClause && (
          <div className="grid grid-cols-[20px_1fr] items-center gap-x-3">
            <ArrowRightLeft className="h-4 w-4" />
            <span className="text-sm">{transferClause}</span>
          </div>
        )}
        {isFareLoading && (
          <div className="grid grid-cols-[20px_1fr] items-center gap-x-3">
            <Banknote className="h-4 w-4" />
            <Skeleton className="h-5 w-16" />
          </div>
        )}
        {!isFareLoading && fare !== null && !fareError && (
          <div className="grid grid-cols-[20px_1fr] items-center gap-x-3">
            <Banknote className="h-4 w-4" />
            <span className="text-sm">{formatToRupiah(fare)}</span>
          </div>
        )}
      </div>

      <div>
        {legs.map((leg, legIndex) => (
          <div key={`${leg.train_id}-${legIndex}`}>
            {legIndex > 0 && (
              <div className="flex items-center gap-3 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white">
                  <ArrowRightLeft className="h-4 w-4 text-slate-400" />
                </div>
                <div className="text-sm text-slate-500">
                  Pindah ke{" "}
                  <span
                    className="font-medium"
                    style={{ color: leg.color }}
                  >
                    {leg.train_name}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 py-1">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: leg.color }}
              >
                {legIndex + 1}
              </div>
              <div
                className="min-w-0 text-sm font-medium"
                style={{ color: leg.color }}
              >
                {leg.train_name}
              </div>
            </div>

            <div className="pl-1.5">
              <ExpandableStops stops={leg.stops} color={leg.color} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
