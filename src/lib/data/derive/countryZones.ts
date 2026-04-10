import type { CountryZone } from '$lib/data/types'
import { getDataset, type DatasetKey } from '$lib/config/datasets'

export function buildCountryZones(
  datasets: Array<{ rows: Record<string, unknown>[]; key: string }>,
  geoPointNames: Set<string>,
  geoAreas: Map<string, { nameEN: string; isoNumeric: string; parentNameFR: string }>
): CountryZone[] {
  const byCountry = new Map<string, Array<{ title: string; dataset: string; person: string; record: Record<string, unknown> }>>()

  for (const { rows, key } of datasets) {
    const dsConfig = getDataset(key as DatasetKey)
    const locationFields = dsConfig.locationFields ?? []
    const countryFields = dsConfig.countryFields ?? []
    const personField = dsConfig.personField ?? 'Student 1'

    for (const row of rows) {
      const title = String(row['Title'] ?? '')
      if (!title) continue

      // Check if this record already has a city-level geo point
      const hasGeoPoint = locationFields.some((f) => {
        const v = row[f]
        return typeof v === 'string' && v !== '' && geoPointNames.has(v)
      })
      if (hasGeoPoint) continue

      // Collect country values
      const countries = countryFields
        .map((f) => row[f])
        .filter((v): v is string => typeof v === 'string' && v !== '')

      if (!countries.length) continue

      const person = String(row[personField] ?? '')
      for (const country of new Set(countries)) {
        if (!byCountry.has(country)) byCountry.set(country, [])
        byCountry.get(country)!.push({ title, dataset: key, person, record: row })
      }
    }
  }

  const zones: CountryZone[] = []
  for (const [nameFR, titles] of byCountry) {
    const areaInfo = geoAreas.get(nameFR)
    if (!areaInfo) continue
    zones.push({ isoNumeric: areaInfo.isoNumeric, nameFR, nameEN: areaInfo.nameEN, titles })
  }
  return zones
}
