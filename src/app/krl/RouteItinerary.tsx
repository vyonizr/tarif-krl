"use client"
import { useState } from "react"
import { ChevronDown, ChevronRight, ArrowRightLeft, Clock, Banknote, Loader2 } from "lucide-react"
import { IKRLRouteResult, IKRLRouteStop } from "@/lib/krl/types"
import { LegSlot } from "@/app/types"
import {
  formatToRupiah,
  convertTimeToHHMM,
  convertToTitleCase,
  calculateMinutesBetween,
  formatMinutesToDuration,
} from "@/app/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface RouteItineraryProps {
  slots: LegSlot[]
  fare: number | null
  isFareLoading: boolean
  fareError: boolean
  isDemo?: boolean
  onRetryHop?: (index: number) => void
  retryingHopIndexes?: Set<number>
}

function friendlyHopError(status: number): string {
  return status === 404
    ? "Tidak ada kereta yang menghubungkan stasiun ini saat ini."
    : "Gagal memuat kereta, coba lagi."
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
          className="flex min-h-11 items-center gap-1 text-left text-sm text-slate-500"
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

type RenderItem =
  | { kind: "leg"; leg: IKRLRouteResult }
  | { kind: "pending" }
  | { kind: "error"; hopIndex: number; status: number; blocked: boolean }

function buildRenderItems(slots: LegSlot[]): RenderItem[] {
  const items: RenderItem[] = []
  slots.forEach((slot, hopIndex) => {
    if (slot.status === "success") {
      slot.legs.forEach((leg) => items.push({ kind: "leg", leg }))
    } else if (slot.status === "pending") {
      items.push({ kind: "pending" })
    } else {
      items.push({
        kind: "error",
        hopIndex,
        status: slot.error.status,
        blocked: slot.blocked,
      })
    }
  })
  return items
}

function TransferConnector({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white">
        <ArrowRightLeft className="h-4 w-4 text-slate-400" />
      </div>
      <div className="text-sm text-slate-500">
        Pindah ke <span className="font-medium" style={{ color }}>{label}</span>
      </div>
    </div>
  )
}

export default function RouteItinerary({
  slots,
  fare,
  isFareLoading,
  fareError,
  isDemo = false,
  onRetryHop,
  retryingHopIndexes,
}: RouteItineraryProps) {
  if (!slots || slots.length === 0) return null

  const isComplete = slots.every((s) => s.status === "success")
  const resolvedLegs = slots.flatMap((s) => (s.status === "success" ? s.legs : []))

  let summary: {
    durationMinutes: number
    arrivalTime: string
    transferClause: string | null
  } | null = null

  if (isComplete && resolvedLegs.length > 0) {
    const departureTime = resolvedLegs[0].stops[0].time_est
    const lastLeg = resolvedLegs[resolvedLegs.length - 1]
    const arrivalTime = lastLeg.stops[lastLeg.stops.length - 1].time_est
    const durationMinutes = calculateMinutesBetween(departureTime, arrivalTime)

    let transferClause: string | null = null
    if (resolvedLegs.length > 1) {
      const transferStations = resolvedLegs.slice(0, -1).map((leg) => {
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

    summary = { durationMinutes, arrivalTime, transferClause }
  }

  const items = buildRenderItems(slots)

  return (
    <div className="mt-6">
      {isDemo && (
        <div className="mb-3 flex justify-center">
          <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-700">
            Contoh
          </Badge>
        </div>
      )}
      {summary && (
        <div className="mb-4 space-y-1 rounded-lg border border-amber-200/60 bg-amber-50 px-4 py-3 text-amber-900">
          <div className="grid grid-cols-[20px_1fr] items-center gap-x-3">
            <Clock className="h-4 w-4" />
            <span className="text-base font-medium">
              {formatMinutesToDuration(summary.durationMinutes)} (estimasi tiba {convertTimeToHHMM(summary.arrivalTime)} WIB)
            </span>
          </div>
          {summary.transferClause && (
            <div className="grid grid-cols-[20px_1fr] items-center gap-x-3">
              <ArrowRightLeft className="h-4 w-4" />
              <span className="text-sm">{summary.transferClause}</span>
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
          {!isFareLoading && fareError && (
            <div className="grid grid-cols-[20px_1fr] items-center gap-x-3">
              <Banknote className="h-4 w-4" />
              <span className="text-sm text-red-600">
                Gagal memuat tarif, coba lagi
              </span>
            </div>
          )}
        </div>
      )}

      <div>
        {items.map((item, i) => {
          if (item.kind === "leg") {
            const leg = item.leg
            return (
              <div key={`${leg.train_id}-${i}`}>
                {i > 0 && <TransferConnector label={leg.train_name} color={leg.color} />}

                <div className="flex items-center gap-3 py-1">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: leg.color }}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 text-sm font-medium" style={{ color: leg.color }}>
                    {leg.train_name}
                  </div>
                </div>

                <div className="pl-1.5">
                  <ExpandableStops stops={leg.stops} color={leg.color} />
                </div>
              </div>
            )
          }

          if (item.kind === "pending") {
            return (
              <div key={`pending-${i}`}>
                {i > 0 && <TransferConnector label="kereta berikutnya" color="#94a3b8" />}
                <div className="flex items-center gap-3 py-3 text-slate-500">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span className="text-sm">Mengambil data kereta ke-{i + 1} dari KCI...</span>
                </div>
              </div>
            )
          }

          const isRetrying = retryingHopIndexes?.has(item.hopIndex) ?? false

          return (
            <div key={`error-${i}`}>
              {i > 0 && <TransferConnector label="berikutnya" color="#94a3b8" />}
              <div className="rounded-lg bg-red-50 p-4 text-center">
                <p className="text-sm text-red-600">
                  {item.blocked
                    ? "Menunggu kereta sebelumnya berhasil dicari"
                    : friendlyHopError(item.status)}
                </p>
                {!item.blocked && onRetryHop && (
                  <Button
                    onClick={() => onRetryHop(item.hopIndex)}
                    variant="outline"
                    className="mt-3 gap-1.5"
                    disabled={isRetrying}
                  >
                    {isRetrying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Mencari ulang...
                      </>
                    ) : (
                      "Coba Lagi"
                    )}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
