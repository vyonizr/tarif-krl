export type ApiEnvelope<T> =
  | { data: T; error: null }
  | { data: null; error: { status: number; message: string } }

export interface ILRTStation {
  slug: string
  name: string
}

export type LRTDayType = 'weekday' | 'holiday'

export interface ILRTSchedule {
  weekday: string[]
  holiday: string[]
  capturedAt: string
}

export interface ILRTDirectJourney {
  type: 'direct'
  from: string
  fromName: string
  to: string
  toName: string
  headingTowards: string
  schedule: ILRTSchedule
}

export interface ILRTTransferJourney {
  type: 'transfer'
  transferStation: string
  legs: [ILRTDirectJourney, ILRTDirectJourney]
}

export type ILRTJourneyResult = ILRTDirectJourney | ILRTTransferJourney
