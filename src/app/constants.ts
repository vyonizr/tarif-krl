const HOURS = Array.from(
  { length: 24 },
  (_, index) => index.toString().padStart(2, '0') + ':00'
)

export { HOURS }
