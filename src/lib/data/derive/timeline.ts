import type { TimelineRecord, Memoire, Pfe, P45, PfeFrance, These } from '$lib/data/types'
import type { SearchItem, Dataset } from '$lib/search/index'

export function parseYear(raw: string | null | undefined): number | null {
  if (!raw) return null
  const match = raw.match(/\d{4}/)
  if (!match) return null
  const y = parseInt(match[0])
  return y >= 1900 && y <= 2100 ? y : null
}

// Parses a date string that may contain month precision (e.g. "2019-09-01").
// Returns a fractional year (mid-month) so the dot lands at the right x position.
export function parseDateValue(raw: string | null | undefined): { year: number; month?: number; dateValue: number } | null {
  if (!raw) return null
  const iso = raw.match(/(\d{4})-(\d{2})/)
  if (iso) {
    const year = parseInt(iso[1]), month = parseInt(iso[2])
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12)
      return { year, month, dateValue: year + (month - 0.5) / 12 }
  }
  const y = parseYear(raw)
  return y !== null ? { year: y, dateValue: y + 0.5 } : null
}

export function buildTimelineRecords(memoires: Memoire[], pfeFrance: PfeFrance[], pfe: Pfe[], p45: P45[], theses: These[]): {
  records: TimelineRecord[]
  missing: SearchItem[]
} {
  const records: TimelineRecord[] = []
  const missing: SearchItem[] = []
  for (const row of memoires) {
    const title = String(row['Title'] ?? '')
    const year = parseYear(row['Publication year'])
    const person = String(row['Student 1'] ?? '')
    if (year !== null) {
      records.push({ dateValue: year + 0.5 / 12, year, label: title || '—', dataset: 'memoires', person, record: row as unknown as Record<string, unknown> })
    } else {
      missing.push({ id: `memoires|timeline|${row['Id']}`, dataset: 'memoires' as Dataset, label: title || '—', searchableText: '', record: row as unknown as Record<string, unknown> })
    }
  }
  for (const row of pfeFrance) {
    const title = String(row['Title'] ?? '')
    const year = parseYear(row['Publication year'])
    const person = String(row['Student 1'] ?? '')
    if (year !== null) {
      records.push({ dateValue: year + 0.5 / 12, year, label: title || '—', dataset: 'pfe_france', person, record: row as unknown as Record<string, unknown> })
    } else {
      missing.push({ id: `pfe_france|timeline|${row['Id']}`, dataset: 'pfe_france' as Dataset, label: title || '—', searchableText: '', record: row as unknown as Record<string, unknown> })
    }
  }
  // PFE: month-precise positioning via Start date; End date produces a span record
  for (const row of pfe) {
    const title = String(row['Title'] ?? '')
    const person = String(row['Student 1'] ?? '')
    const parsed = parseDateValue(row['Start date'])
    if (parsed !== null) {
      const endParsed = parseDateValue(row['End date'])
      records.push({
        dateValue: parsed.dateValue,
        year: parsed.year,
        month: parsed.month,
        ...(endParsed !== null ? { endDateValue: endParsed.dateValue, endYear: endParsed.year, endMonth: endParsed.month } : {}),
        label: title || '—',
        dataset: 'pfe',
        person,
        record: row as unknown as Record<string, unknown>,
      })
    } else {
      missing.push({ id: `pfe|timeline|${row['Id']}`, dataset: 'pfe' as Dataset, label: title || '—', searchableText: '', record: row as unknown as Record<string, unknown> })
    }
  }
  // P45: same span logic as PFE — Start date + optional End date
  for (const row of p45) {
    const title = String(row['Title'] ?? '')
    const person = String(row['Supervisor 1'] ?? '')
    const parsed = parseDateValue(row['Start date'])
    if (parsed !== null) {
      const endParsed = parseDateValue(row['End date'])
      records.push({
        dateValue: parsed.dateValue,
        year: parsed.year,
        month: parsed.month,
        ...(endParsed !== null ? { endDateValue: endParsed.dateValue, endYear: endParsed.year, endMonth: endParsed.month } : {}),
        label: title || '—',
        dataset: 'p45',
        person,
        record: row as unknown as Record<string, unknown>,
      })
    } else {
      missing.push({ id: `p45|timeline|${row['Id']}`, dataset: 'p45' as Dataset, label: title || '—', searchableText: '', record: row as unknown as Record<string, unknown> })
    }
  }
  // Theses: same span logic — Start date + optional End date
  for (const row of theses) {
    const title = String(row['Title'] ?? '')
    const person = String(row['Student 1'] ?? '')
    const parsed = parseDateValue(row['Start date'])
    if (parsed !== null) {
      const endParsed = parseDateValue(row['End date'])
      records.push({
        dateValue: parsed.dateValue,
        year: parsed.year,
        month: parsed.month,
        ...(endParsed !== null ? { endDateValue: endParsed.dateValue, endYear: endParsed.year, endMonth: endParsed.month } : {}),
        label: title || '—',
        dataset: 'theses',
        person,
        record: row as unknown as Record<string, unknown>,
      })
    } else {
      missing.push({ id: `theses|timeline|${row['Id']}`, dataset: 'theses' as Dataset, label: title || '—', searchableText: '', record: row as unknown as Record<string, unknown> })
    }
  }
  records.sort((a, b) => a.dateValue - b.dateValue)
  return { records, missing }
}
