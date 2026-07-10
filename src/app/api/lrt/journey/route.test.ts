/// <reference types="jest" />

import { GET } from './route'

jest.mock('../../../../lib/lrt/adapter', () => ({
  getJourney: jest.fn(),
}))

const { getJourney } = require('../../../../lib/lrt/adapter') as {
  getJourney: jest.Mock
}

beforeEach(() => {
  getJourney.mockReset()
})

function createRequest(params: Record<string, string>): Request {
  const url = new URL('https://example.com/api/lrt/journey')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new Request(url.toString())
}

describe('GET /api/lrt/journey', () => {
  test('returns 200 with a direct journey result', async () => {
    getJourney.mockResolvedValue({
      type: 'direct',
      from: 'harjamukti',
      fromName: 'Harjamukti',
      to: 'taman-mini',
      toName: 'Taman Mini',
      headingTowards: 'Dukuh Atas BNI',
      stations: [
        { slug: 'harjamukti', name: 'Harjamukti' },
        { slug: 'ciracas', name: 'Ciracas' },
        { slug: 'kampung-rambutan', name: 'Kampung Rambutan' },
        { slug: 'taman-mini', name: 'Taman Mini' },
      ],
      schedule: { weekday: ['05:18'], holiday: ['05:35'], capturedAt: '2026-01-01T00:00:00.000Z' },
    })

    const response = await GET(createRequest({ from: 'harjamukti', to: 'taman-mini' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.type).toBe('direct')
    expect(body.data.headingTowards).toBe('Dukuh Atas BNI')
    expect(getJourney).toHaveBeenCalledWith('harjamukti', 'taman-mini')
  })

  test('returns 400 when from param is missing', async () => {
    const response = await GET(createRequest({ to: 'taman-mini' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toEqual({
      status: 400,
      message: 'Parameters "from" and "to" are required',
    })
  })

  test('returns 400 when to param is missing', async () => {
    const response = await GET(createRequest({ from: 'harjamukti' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toEqual({
      status: 400,
      message: 'Parameters "from" and "to" are required',
    })
  })

  test('returns 400 when from and to are the same station', async () => {
    const response = await GET(createRequest({ from: 'cawang', to: 'cawang' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toEqual({
      status: 400,
      message: 'Origin and destination must differ',
    })
  })

  test('returns 400 when from is an unknown station', async () => {
    const response = await GET(createRequest({ from: 'nowhere', to: 'cawang' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toEqual({
      status: 400,
      message: 'Unknown "from" or "to" station',
    })
  })

  test('returns 400 when to is an unknown station', async () => {
    const response = await GET(createRequest({ from: 'cawang', to: 'nowhere' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toEqual({
      status: 400,
      message: 'Unknown "from" or "to" station',
    })
  })

  test('returns 500 when the adapter throws', async () => {
    getJourney.mockRejectedValue(new Error('boom'))

    const response = await GET(createRequest({ from: 'harjamukti', to: 'taman-mini' }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toEqual({ status: 500, message: 'boom' })
  })
})
