import { GET } from './route'

interface MockResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
  clone: () => MockResponse
}

function createFetchResponse(data: unknown, ok = true, status = 200): MockResponse {
  const response: MockResponse = {
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    clone: () => response,
  }
  return response
}

function makeRequest(url: string): Request {
  return new Request(new URL(url).toString())
}

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('GET /api/v1/krl/fare', () => {
  test('returns 200 with fare data for valid params', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        status: 200,
        data: [
          {
            sta_code_from: 'AC',
            sta_name_from: 'ANCOL',
            sta_code_to: 'BPR',
            sta_name_to: 'BOGOR PALEDANG',
            fare: 3000,
            distance: '23.205',
          },
        ],
      })
    )

    const req = makeRequest('http://localhost/api/v1/krl/fare?from=AC&to=BPR')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual([
      { from: 'AC', to: 'BPR', fare: 3000, distance: '23.205' },
    ])
    expect(body.error).toBeNull()
  })

  test('returns 400 when "from" is missing', async () => {
    const req = makeRequest('http://localhost/api/v1/krl/fare?to=BPR')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.data).toBeNull()
    expect(body.error?.message).toBe(
      'Parameters "from" and "to" are required'
    )
  })

  test('returns 400 when "to" is missing', async () => {
    const req = makeRequest('http://localhost/api/v1/krl/fare?from=AC')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.data).toBeNull()
    expect(body.error?.message).toBe(
      'Parameters "from" and "to" are required'
    )
  })

  test('returns 502 on upstream error', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({}, false, 404)
    )

    const req = makeRequest('http://localhost/api/v1/krl/fare?from=AC&to=BPR')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.data).toBeNull()
    expect(body.error).toEqual({
      status: 502,
      message: 'Upstream returned HTTP 404',
    })
  })
})
