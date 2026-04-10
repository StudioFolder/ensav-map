import type { Partenariat, GeoPoint, CountryZone } from '$lib/data/types'
import { getDataset, type DatasetKey } from '$lib/config/datasets'

type StatItem = { label: string; dataset: string; record: Record<string, unknown> }

export function computeRecordStats(
  allDatasets: Array<{ rows: Record<string, unknown>[]; key: string }>,
  geoPoints: GeoPoint[],
  countryZones: CountryZone[],
  visualisedPartenariats: number,
  allPartenariats: Array<{ rows: Partenariat[]; key: string }>
): { visualised: number; noGeo: number; otherMissing: number; total: number; noGeoItems: StatItem[]; otherMissingItems: StatItem[] } {
  // Keys of records that are actually rendered on the globe
  const visualisedKeys = new Set<string>()
  for (const pt of geoPoints.filter((p) => p.type !== 'institution')) {
    for (const t of pt.titles) visualisedKeys.add(`${t.dataset}|${t.title}`)
  }
  for (const cz of countryZones) {
    for (const t of cz.titles) visualisedKeys.add(`${t.dataset}|${t.title}`)
  }

  const noGeoItems: StatItem[] = []
  const otherMissingItems: StatItem[] = []
  let noGeo = 0
  let otherMissing = 0
  let visualisedTravaux = 0

  // Partenariats with no valid GPS coordinates
  for (const { rows, key } of allPartenariats) {
    for (const row of rows) {
      const raw = row['Geographic coordinates'] as string | null
      let valid = false
      if (raw) {
        const [latStr, lonStr] = raw.split(',')
        valid = isFinite(parseFloat(latStr?.trim())) && isFinite(parseFloat(lonStr?.trim()))
      }
      if (!valid) {
        otherMissing++
        const label = String(row['Institution (full name)'] ?? row['Institution'] ?? `${key} #${row['Id']}`)
        otherMissingItems.push({ label, dataset: key, record: row as unknown as Record<string, unknown> })
      }
    }
  }

  for (const { rows, key } of allDatasets) {
    const dsConfig = getDataset(key as DatasetKey)
    const locationFields = dsConfig.locationFields ?? []
    const countryFields = dsConfig.countryFields ?? []
    for (const row of rows) {
      const title = String(row['Title'] ?? '')
      const recordKey = `${key}|${title}`
      // Each NocoDB row counted individually — no deduplication by title —
      // so the total matches the NocoDB row count exactly.
      // Rows with no title can never be visualised; they fall through to geo check.
      if (title && visualisedKeys.has(recordKey)) {
        visualisedTravaux++
      } else {
        const hasAnyGeo =
          locationFields.some((f) => typeof row[f] === 'string' && (row[f] as string) !== '') ||
          countryFields.some((f) => typeof row[f] === 'string' && (row[f] as string) !== '')
        const label = title || `${key} #${String(row['Id'] ?? '')}`
        if (hasAnyGeo) {
          otherMissing++
          otherMissingItems.push({ label, dataset: key, record: row })
        } else {
          noGeo++
          noGeoItems.push({ label, dataset: key, record: row })
        }
      }
    }
  }

  const visualised = visualisedTravaux + visualisedPartenariats
  return { visualised, noGeo, otherMissing, total: visualised + noGeo + otherMissing, noGeoItems, otherMissingItems }
}
