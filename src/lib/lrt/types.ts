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
}

export interface ILRTDirectJourney {
  type: 'direct'
  from: string
  to: string
  headingTowards: string
  schedule: ILRTSchedule
}

export interface ILRTTransferJourney {
  type: 'transfer'
  transferStation: string
  legs: [ILRTDirectJourney, ILRTDirectJourney]
}

export type ILRTJourneyResult = ILRTDirectJourney | ILRTTransferJourney
