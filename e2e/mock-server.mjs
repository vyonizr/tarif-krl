import http from 'node:http'

const PORT = parseInt(process.env.PORT ?? '9321', 10)

function json(res, data) {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function createStations() {
  return {
    status: 200,
    message: 'success',
    data: [
      { sta_id: 'WIL0', sta_name: 'AREA JABODETABEK', group_wil: 0, fg_enable: 0 },
      { sta_id: 'JAKK', sta_name: 'JAKARTA KOTA', group_wil: 1, fg_enable: 1 },
      { sta_id: 'MRI', sta_name: 'MANGGARAI', group_wil: 1, fg_enable: 1 },
      { sta_id: 'THB', sta_name: 'TANAH ABANG', group_wil: 1, fg_enable: 1 },
      { sta_id: 'PSMB', sta_name: 'PASAR MINGGU BARU', group_wil: 1, fg_enable: 1 },
      { sta_id: 'DP', sta_name: 'DEPOK', group_wil: 1, fg_enable: 1 },
      { sta_id: 'BOO', sta_name: 'BOGOR', group_wil: 1, fg_enable: 1 },
    ],
  }
}

function createFare(from, to) {
  return {
    status: 200,
    data: [
      {
        sta_code_from: from,
        sta_name_from: from,
        sta_code_to: to,
        sta_name_to: to,
        fare: 3000,
        distance: '12.500',
      },
    ],
  }
}

const trainSchedules = {
  '1151': [
    { train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', station_id: 'JAKK', station_name: 'JAKARTA KOTA', time_est: '10:05:00', transit: '', color: '#E30A16', transit_station: false },
    { train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', station_id: 'MRI', station_name: 'MANGGARAI', time_est: '10:20:00', transit: 'blue', color: '#E30A16', transit_station: true },
    { train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', station_id: 'DP', station_name: 'DEPOK', time_est: '10:45:00', transit: '', color: '#E30A16', transit_station: false },
    { train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', station_id: 'BOO', station_name: 'BOGOR', time_est: '11:15:00', transit: '', color: '#E30A16', transit_station: false },
  ],
  '1801': [
    { train_id: '1801', ka_name: 'COMMUTER LINE CIKARANG', station_id: 'PSMB', station_name: 'PASAR MINGGU BARU', time_est: '09:55:00', transit: '', color: '#0000FF', transit_station: false },
    { train_id: '1801', ka_name: 'COMMUTER LINE CIKARANG', station_id: 'MRI', station_name: 'MANGGARAI', time_est: '10:05:00', transit: 'red', color: '#0000FF', transit_station: true },
    { train_id: '1801', ka_name: 'COMMUTER LINE CIKARANG', station_id: 'THB', station_name: 'TANAH ABANG', time_est: '10:18:00', transit: 'green', color: '#0000FF', transit_station: true },
  ],
}

const defaultSchedules = {
  PSMB: [
    { train_id: '1801', ka_name: 'COMMUTER LINE CIKARANG', route_name: 'CIKARANG', dest: 'Cikarang', time_est: '09:55:00', color: '#0000FF', dest_time: '11:00:00' },
  ],
  MRI: [
    { train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', route_name: 'BOGOR', dest: 'Bogor', time_est: '10:10:00', color: '#E30A16', dest_time: '11:30:00' },
  ],
  THB: [],
  JAKK: [
    { train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', route_name: 'BOGOR', dest: 'Bogor', time_est: '10:05:00', color: '#E30A16', dest_time: '11:30:00' },
  ],
  DP: [],
  BOO: [],
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    const pathname = url.pathname

    if (pathname.includes('/station')) {
      return json(res, createStations())
    }
    if (pathname.includes('/fare')) {
      const from = url.searchParams.get('stacodfrom') ?? ''
      const to = url.searchParams.get('stacodto') ?? ''
      return json(res, createFare(from, to))
    }
    if (pathname.includes('/schedules')) {
      const stationid = url.searchParams.get('stationid') ?? ''
      return json(res, {
        status: 200,
        data: defaultSchedules[stationid] ?? [
          {
            train_id: '1151',
            ka_name: 'COMMUTER LINE BOGOR',
            route_name: 'BOGOR - JAKARTA',
            dest: 'Bogor',
            time_est: '10:05:00',
            color: '#E30A16',
            dest_time: '11:30:00',
          },
        ],
      })
    }
    if (pathname.includes('/train-schedule')) {
      const trainid = url.searchParams.get('trainid') ?? ''
      return json(res, {
        status: 200,
        data: trainSchedules[trainid] ?? [],
      })
    }

    console.error(`[mock-server] Unknown path: ${pathname}`)
    res.writeHead(404)
    res.end('Not found')
  } catch (e) {
    console.error('[mock-server] Error:', e)
    res.writeHead(500)
    res.end('Internal error')
  }
})

server.listen(PORT, () => {
  console.log(`[mock-server] Listening on port ${PORT}`)
})
