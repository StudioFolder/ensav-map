import type { GeoPoint } from '$lib/data/types'
import { parseContinents } from './continentGroups'

/** Builds a map from `${datasetKey}|${id}` → set of FR continent names derived from
 *  non-institution geo points. Used by both buildContinentGroups and buildTimelineRecords. */
export function buildGeoPointContinents(geoPoints: GeoPoint[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  for (const pt of geoPoints.filter((p) => p.type !== 'institution')) {
    if (!pt.continent) continue
    for (const t of pt.titles) {
      const k = `${t.dataset}|${t.record['Id']}`
      if (!result.has(k)) result.set(k, new Set())
      result.get(k)!.add(pt.continent)
    }
  }
  return result
}

/** Returns sorted, deduped FR continent names for a single row, unionising:
 *  (a) geo-point continents, (b) Country N field lookups, (c) explicit Continent field. */
export function computeRowContinents(args: {
  row: Record<string, unknown>
  rowKey: string
  countryFields: string[]
  geoPointContinents: Map<string, Set<string>>
  countries: Map<string, { parentNameFR: string }>
}): string[] {
  const { row, rowKey, countryFields, geoPointContinents, countries } = args
  const result = new Set<string>()

  const fromGeo = geoPointContinents.get(rowKey)
  if (fromGeo) for (const c of fromGeo) result.add(c)

  for (const f of countryFields) {
    const v = row[f]
    if (typeof v !== 'string' || v === '') continue
    const country = countries.get(v)
    if (country?.parentNameFR) result.add(country.parentNameFR)
  }

  for (const c of parseContinents(row['Continent'] as string | null | undefined)) result.add(c)

  return [...result].sort()
}
