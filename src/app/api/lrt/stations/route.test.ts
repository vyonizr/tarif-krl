/// <reference types="jest" />

import { GET } from './route'

jest.mock('../../../../lib/lrt/adapter', () => ({
  getStations: jest.fn(),
}))

const { getStations } = require('../../../../lib/lrt/adapter') as {
  getStations: jest.Mock
}

beforeEach(() => {
  getStations.mockReset()
})

describe('GET /api/lrt/stations', () => {
  test('returns 200 with the station list in the data envelope', async () => {
    getStations.mockResolvedValue([{ slug: 'cawang', name: 'Cawang' }])

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual([{ slug: 'cawang', name: 'Cawang' }])
    expect(body.error).toBeNull()
  })

  test('returns 500 with an error envelope when the adapter throws', async () => {
    getStations.mockRejectedValue(new Error('read failed'))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.data).toBeNull()
    expect(body.error).toEqual({ status: 500, message: 'read failed' })
  })
})
