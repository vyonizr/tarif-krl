import { parseLrtScheduleHtml } from './htmlParser'

const FIXTURE = `
<div class="tab-pane fade show active" id="pills-station-a" role="tabpanel">
  <h3><i class="fa-solid fa-train"></i> Jam Keberangkatan Hari Biasa</h3>
  <table><tbody>
    <tr><td><small>05:00</small></td><td><small>05:10</small></td></tr>
  </tbody></table>
  <h3><i class="fa-solid fa-train"></i> Jam Keberangkatan Hari Libur</h3>
  <table><tbody>
    <tr><td><small>06:00</small></td></tr>
  </tbody></table>
</div>
<div class="tab-pane fade show " id="pills-station-b" role="tabpanel">
  <h3><i class="fa-solid fa-train"></i> Jam Keberangkatan Hari Biasa</h3>
  <table><tbody>
    <tr><td><small>07:00</small></td></tr>
  </tbody></table>
  <h3><i class="fa-solid fa-train"></i> Jam Keberangkatan Hari Libur</h3>
  <table><tbody>
    <tr><td><small>08:00</small></td><td><small>08:15</small></td></tr>
  </tbody></table>
</div>
`

describe('parseLrtScheduleHtml', () => {
  test('extracts weekday and holiday times per station in document order', () => {
    const result = parseLrtScheduleHtml(FIXTURE)

    expect(result).toEqual([
      { slug: 'station-a', weekday: ['05:00', '05:10'], holiday: ['06:00'] },
      { slug: 'station-b', weekday: ['07:00'], holiday: ['08:00', '08:15'] },
    ])
  })

  test('throws when a station is missing the weekday or holiday heading', () => {
    const broken =
      '<div class="tab-pane fade show" id="pills-station-c" role="tabpanel">' +
      '<h3>Jam Keberangkatan Hari Biasa</h3><small>05:00</small></div>'

    expect(() => parseLrtScheduleHtml(broken)).toThrow(
      'Missing weekday/holiday section for station: station-c'
    )
  })

  test('returns an empty array for a page with no tab panes', () => {
    expect(parseLrtScheduleHtml('<html></html>')).toEqual([])
  })
})
