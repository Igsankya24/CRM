/**
 * Normalizes and validates B2B lead inquiry date strings.
 * Discards values pointing to 1970 or earlier, and ignores values in the future.
 * Returns a valid Date object or null if parsing fails.
 */
export function cleanAndParseDate(rawDateStr: string | null | undefined): Date | null {
  if (!rawDateStr) return null

  const trimmed = String(rawDateStr).trim()
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null

  let parsed = new Date(trimmed)

  // Standardize hyphens for compatibility with JS parser in some environments
  if (isNaN(parsed.getTime())) {
    parsed = new Date(trimmed.replace(/-/g, '/'))
  }

  // Handle IndiaMART custom format: "23-JUN-2025 11:01:58"
  if (isNaN(parsed.getTime())) {
    try {
      const parts = trimmed.split(/[\s\-:]+/)
      if (parts.length >= 6) {
        const d = parseInt(parts[0], 10)
        const mon = parts[1].toUpperCase()
        const y = parseInt(parts[2], 10)
        const h = parseInt(parts[3], 10)
        const mi = parseInt(parts[4], 10)
        const s = parseInt(parts[5], 10)
        
        const MONTHS_UPPER = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
        const monthIdx = MONTHS_UPPER.indexOf(mon)
        if (monthIdx !== -1 && !isNaN(d) && !isNaN(y) && !isNaN(h) && !isNaN(mi) && !isNaN(s)) {
          const dateObj = new Date(y, monthIdx, d, h, mi, s)
          if (!isNaN(dateObj.getTime())) {
            parsed = dateObj
          }
        }
      }
    } catch {
      // Keep checking
    }
  }

  if (isNaN(parsed.getTime())) {
    return null
  }

  const time = parsed.getTime()
  const year = parsed.getFullYear()

  // Prevent 1970 or earlier dates (e.g. Unix epoch start or null defaults)
  if (year <= 1970) {
    return null
  }

  // Prevent future timestamps (e.g. more than 1 day in the future)
  const oneDayInFuture = Date.now() + 24 * 60 * 60 * 1000
  if (time > oneDayInFuture) {
    return null
  }

  return parsed
}
