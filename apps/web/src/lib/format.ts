let currency = import.meta.env.VITE_CURRENCY ?? 'BDT'
let businessDateFormat = 'dd MMM yyyy'
let businessTimeZone = 'Asia/Dhaka'

export function setCurrency(value: string) {
  currency = value
}

export function setDateSettings(dateFormat: string, timeZone: string) {
  businessDateFormat = dateFormat
  businessTimeZone = timeZone
}

export function getCurrency() {
  return currency
}

export function formatCurrency(amountMinor: number) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100)
}

export function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  const isCalendarDate = typeof value === 'string' &&
    (/^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/.test(value))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: isCalendarDate ? 'UTC' : businessTimeZone,
    year: 'numeric',
    month: businessDateFormat === 'dd MMM yyyy' ? 'short' : '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  if (businessDateFormat === 'dd MMM yyyy') return `${values.day} ${values.month} ${values.year}`
  if (businessDateFormat === 'MM/dd/yyyy') return `${values.month}/${values.day}/${values.year}`
  if (businessDateFormat === 'yyyy-MM-dd') return `${values.year}-${values.month}-${values.day}`
  return `${values.day}/${values.month}/${values.year}`
}
