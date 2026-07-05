import http from 'node:http'

const PORT = parseInt(process.env.PORT ?? '9322', 10)

const STATIONS = [
  { id: 4, slug: 'stasiun-lebak-bulus', name: 'Lebak Bulus' },
  { id: 5, slug: 'stasiun-asean', name: 'ASEAN Headquarter' },
  { id: 38, slug: 'stasiun-istora-mandiri', name: 'Istora Mandiri' },
  { id: 6, slug: 'bundaran-hi', name: 'Bundaran HI Bank Jakarta' },
]

const SCHEDULES = {
  4: {
    start: 'Lebak Bulus',
    end: 'Bundaran HI Bank Jakarta',
    weekdaysEnd: '05:00:00;06:00:00;07:00:00;12:00:00;18:00:00;23:59:00',
    weekendsEnd: '06:00:00;07:00:00;08:00:00;12:00:00;18:00:00;23:59:00',
  },
  5: {
    start: 'Lebak Bulus',
    end: 'Bundaran HI Bank Jakarta',
    weekdaysStart: '05:05:00;06:05:00;07:05:00;12:05:00;18:05:00;23:59:00',
    weekdaysEnd: '05:05:00;06:05:00;07:05:00;12:05:00;18:05:00;23:59:00',
    weekendsStart: '06:05:00;07:05:00;08:05:00;12:05:00;18:05:00;23:59:00',
    weekendsEnd: '06:05:00;07:05:00;08:05:00;12:05:00;18:05:00;23:59:00',
  },
  38: {
    start: 'Lebak Bulus',
    end: 'Bundaran HI Bank Jakarta',
    weekdaysStart: '05:20:00;06:20:00;07:20:00;12:20:00;18:20:00;23:59:00',
    weekdaysEnd: '05:20:00;06:20:00;07:20:00;12:20:00;18:20:00;23:59:00',
    weekendsStart: '06:20:00;07:20:00;08:20:00;12:20:00;18:20:00;23:59:00',
    weekendsEnd: '06:20:00;07:20:00;08:20:00;12:20:00;18:20:00;23:59:00',
  },
  6: {
    start: 'Lebak Bulus',
    end: 'Bundaran HI Bank Jakarta',
    weekdaysStart: '05:30:00;06:30:00;07:30:00;12:30:00;18:30:00;23:59:00',
    weekendsStart: '06:30:00;07:30:00;08:30:00;12:30:00;18:30:00;23:59:00',
  },
}

function json(res, data) {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function handleDatum(res) {
  json(res, { data: STATIONS })
}

function handleRoute(res, body) {
  const from = parseInt(body.from, 10)
  const to = parseInt(body.to, 10)

  const fromStation = STATIONS.find((s) => s.id === from)
  const toStation = STATIONS.find((s) => s.id === to)

  if (!fromStation || !toStation) {
    res.writeHead(400)
    return json(res, { success: false, message: 'Invalid station ids' })
  }

  const schedule = SCHEDULES[from]

  json(res, {
    success: true,
    data: {
      from: {
        id: from,
        name: fromStation.name,
        object: schedule
          ? { schedule }
          : {},
      },
      to: {
        id: to,
        name: toStation.name,
        object: {},
      },
      integration: {
        cost: 14000,
        timeEstimation: '30',
      },
    },
  })
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      try {
        resolve(JSON.parse(data))
      } catch {
        resolve({})
      }
    })
  })
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    const pathname = url.pathname

    if (pathname.endsWith('/datum')) {
      return handleDatum(res)
    }

    if (req.method === 'POST' && pathname.endsWith('/route')) {
      const body = await parseBody(req)
      return handleRoute(res, body)
    }

    console.error(`[mrt-mock-server] Unknown path: ${req.method} ${pathname}`)
    res.writeHead(404)
    res.end('Not found')
  } catch (e) {
    console.error('[mrt-mock-server] Error:', e)
    res.writeHead(500)
    res.end('Internal error')
  }
})

server.listen(PORT, () => {
  console.log(`[mrt-mock-server] Listening on port ${PORT}`)
})
