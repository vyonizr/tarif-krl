const HOURS = Array.from(
  { length: 24 },
  (_, index) => index.toString().padStart(2, '0') + ':00'
)

const BASE_URL = 'https://api-partner.krl.co.id/krlweb/v1'
const FARE_URL = BASE_URL + '/fare'
const SCHEDULE_URL = BASE_URL + '/schedule'

export { HOURS, FARE_URL, SCHEDULE_URL }
