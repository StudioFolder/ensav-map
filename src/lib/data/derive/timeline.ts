import type { TimelineRecord, Memoire, Pfe, P45, PfeFrance, These } from '$lib/data/types'
import type { SearchItem, Dataset } from '$lib/search/index'
import { getDataset } from '$lib/config/datasets'
import { computeRowContinents } from './rowContinents'

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

export function buildTimelineRecords(
  memoires: Memoire[],
  pfeFrance: PfeFrance[],
  pfe: Pfe[],
  p45: P45[],
  theses: These[],
  ctx: {
    geoPointContinents: Map<string, Set<string>>
    countries: Map<string, { parentNameFR: string }>
  },
): {
  records: TimelineRecord[]
  missing: SearchItem[]
} {
  const { geoPointContinents, countries } = ctx
  const records: TimelineRecord[] = []
  const missing: SearchItem[] = []

  const memoiresCountryFields = getDataset('memoires').countryFields ?? []
  for (const row of memoires) {
    const rowKey = `memoires|${row['Id']}`
    const title = String(row['Title'] ?? '')
    const year = parseYear(row['Publication year'])
    const person = String(row['Student 1'] ?? '')
    const continents = computeRowContinents({ row: row as unknown as Record<string, unknown>, rowKey, countryFields: memoiresCountryFields, geoPointContinents, countries })
    if (year !== null) {
      // Only year precision — render as a full-year pill so the display honestly
      // reflects that we know only the year, not the month.
      records.push({ dateValue: year, year, endDateValue: year + 1, endYear: year, label: title || '—', dataset: 'memoires', person, record: row as unknown as Record<string, unknown>, continents })
    } else {
      missing.push({ id: `memoires|timeline|${row['Id']}`, dataset: 'memoires' as Dataset, label: title || '—', searchableText: '', record: row as unknown as Record<string, unknown> })
    }
  }

  const pfeFranceCountryFields = getDataset('pfe_france').countryFields ?? []
  for (const row of pfeFrance) {
    const rowKey = `pfe_france|${row['Id']}`
    const title = String(row['Title'] ?? '')
    const year = parseYear(row['Publication year'])
    const person = String(row['Student 1'] ?? '')
    const continents = computeRowContinents({ row: row as unknown as Record<string, unknown>, rowKey, countryFields: pfeFranceCountryFields, geoPointContinents, countries })
    if (year !== null) {
      records.push({ dateValue: year, year, endDateValue: year + 1, endYear: year, label: title || '—', dataset: 'pfe_france', person, record: row as unknown as Record<string, unknown>, continents })
    } else {
      missing.push({ id: `pfe_france|timeline|${row['Id']}`, dataset: 'pfe_france' as Dataset, label: title || '—', searchableText: '', record: row as unknown as Record<string, unknown> })
    }
  }

  // PFE: month-precise positioning via Start date; End date produces a span record.
  // When only a start month is known (no end date), render as a pill spanning that
  // full month so the dot doesn't misrepresent precision we don't have.
  const pfeCountryFields = getDataset('pfe').countryFields ?? []
  for (const row of pfe) {
    const rowKey = `pfe|${row['Id']}`
    const title = String(row['Title'] ?? '')
    const person = String(row['Student 1'] ?? '')
    const continents = computeRowContinents({ row: row as unknown as Record<string, unknown>, rowKey, countryFields: pfeCountryFields, geoPointContinents, countries })
    const parsed = parseDateValue(row['Start date'])
    if (parsed !== null) {
      const endParsed = parseDateValue(row['End date'])
      let spanEnd: { endDateValue: number; endYear: number; endMonth?: number } | Record<string, never> = {}
      if (endParsed !== null) {
        spanEnd = { endDateValue: endParsed.dateValue, endYear: endParsed.year, endMonth: endParsed.month }
      } else if (parsed.month !== undefined) {
        // No end date but month-precise start → pill covering the full month.
        // endYear stays the same year; endMonth = same month so dateLabel collapses to "Mar 2021".
        spanEnd = { endDateValue: parsed.year + parsed.month / 12, endYear: parsed.year, endMonth: parsed.month }
      }
      records.push({
        dateValue: parsed.month !== undefined && endParsed === null
          ? parsed.year + (parsed.month - 1) / 12  // pill: align to month start, not mid-month
          : parsed.dateValue,
        year: parsed.year,
        month: parsed.month,
        ...spanEnd,
        label: title || '—',
        dataset: 'pfe',
        person,
        record: row as unknown as Record<string, unknown>,
        continents,
      })
    } else {
      missing.push({ id: `pfe|timeline|${row['Id']}`, dataset: 'pfe' as Dataset, label: title || '—', searchableText: '', record: row as unknown as Record<string, unknown> })
    }
  }

  // P45: same span logic as PFE — Start date + optional End date
  const p45CountryFields = getDataset('p45').countryFields ?? []
  for (const row of p45) {
    const rowKey = `p45|${row['Id']}`
    const title = String(row['Title'] ?? '')
    const person = String(row['Supervisor 1'] ?? '')
    const continents = computeRowContinents({ row: row as unknown as Record<string, unknown>, rowKey, countryFields: p45CountryFields, geoPointContinents, countries })
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
        continents,
      })
    } else {
      missing.push({ id: `p45|timeline|${row['Id']}`, dataset: 'p45' as Dataset, label: title || '—', searchableText: '', record: row as unknown as Record<string, unknown> })
    }
  }

  // Theses: same span logic — Start date + optional End date
  const thesesCountryFields = getDataset('theses').countryFields ?? []
  for (const row of theses) {
    const rowKey = `theses|${row['Id']}`
    const title = String(row['Title'] ?? '')
    const person = String(row['Student 1'] ?? '')
    const continents = computeRowContinents({ row: row as unknown as Record<string, unknown>, rowKey, countryFields: thesesCountryFields, geoPointContinents, countries })
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
        continents,
      })
    } else {
      missing.push({ id: `theses|timeline|${row['Id']}`, dataset: 'theses' as Dataset, label: title || '—', searchableText: '', record: row as unknown as Record<string, unknown> })
    }
  }

  records.sort((a, b) => a.dateValue - b.dateValue)
  return { records, missing }
}
