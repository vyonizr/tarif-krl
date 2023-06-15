function getRegionNumber(regionCode: string): number {
  return parseInt(regionCode.replace('WIL', ''))
}

function convertToTitleCase(str: string) {
  if (!str) return ''

  const words = str.toLowerCase().split(' ')

  const titleCaseWords = words.map((word) => {
    const firstLetter = word.charAt(0).toUpperCase()
    const restOfWord = word.slice(1)

    return firstLetter + restOfWord
  })

  return titleCaseWords.join(' ')
}

function formatToRupiah(amount: number) {
  const formatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  })

  return formatter.format(amount)
}

function getNearestEarlierHour() {
  const currentTime = new Date()
  const currentHour = currentTime.getHours()

  const nearestEarlierHour = new Date()
  nearestEarlierHour.setHours(currentHour, 0, 0, 0)

  const formattedHour = nearestEarlierHour
    .getHours()
    .toString()
    .padStart(2, '0')
  const formattedMinute = nearestEarlierHour
    .getMinutes()
    .toString()
    .padStart(2, '0')

  return `${formattedHour}:${formattedMinute}`
}

function convertTimeToHHMM(timeString: string) {
  const parts = timeString.split(':')

  if (parts.length === 3) {
    parts.pop()
  }

  return parts.join(':')
}

function getCurrentTimeInHHMM() {
  const currentTime = new Date()
  const hours = currentTime.getHours().toString().padStart(2, '0')
  const minutes = currentTime.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

export {
  getRegionNumber,
  convertToTitleCase,
  formatToRupiah,
  getNearestEarlierHour,
  convertTimeToHHMM,
  getCurrentTimeInHHMM,
}
