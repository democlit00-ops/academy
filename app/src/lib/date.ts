export function parseLocalDate(date: string | null | undefined): Date | null {
  if (!date) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const parsed = new Date(`${date}T00:00:00`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function getTodayLocalDateString(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

export function formatLocalDate(
  date: string | null | undefined,
  formatter: (date: Date) => string
): string {
  const parsed = parseLocalDate(date)
  if (!parsed) return '--'
  return formatter(parsed)
}