import {
  fetchDatasetSummaries,
  fetchPartenariatsMobilites,
  fetchPartenariatsHorsMobilites,
  fetchMemoires,
  fetchPfe,
  fetchP45,
  fetchPfeFrance,
  fetchTheses,
} from '$lib/data/api'
import type { PageServerLoad } from './$types'
import type { Partenariat, GlobePoint, GeoPoint, CountryZone } from '$lib/data/types'
import geoPointsCsv from '../../static/data/geo_points.csv?raw'
import geoAreasCsv from '../../static/data/geo_areas.csv?raw'

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes }
    else if (char === ',' && !inQuotes) { result.push(current); current = '' }
    else { current += char }
  }
  result.push(current)
  return result
}

function loadGeoPoints(): Omit<GeoPoint, 'titles'>[] {
  const lines = geoPointsCsv.trim().split('\n')
  return lines.slice(1).flatMap((line) => {
    const [name, type, city, province, country, continent, latStr, lonStr] = parseCSVLine(line)
    const lat = parseFloat(latStr)
    const lon = parseFloat(lonStr)
    if (!isFinite(lat) || !isFinite(lon)) return []
    return [{ name, type, city, province, country, continent, lat, lon }]
  })
}

const DATASET_LOCATION_FIELDS: Record<string, string[]> = {
  memoires:  ['City 1', 'City 2', 'City 3', 'City 4', 'Institution', 'Institution (full name)'],
  pfe:       ['City 1', 'City 2', 'City 3', 'City 4', 'Institution', 'Institution (full name)'],
  p45:       ['City 1', 'City 2', 'City 3', 'City 4', 'Institution'],
  pfe_france: ['City'],
  theses:    ['City 1', 'City 2', 'City 3', 'City 4', 'Institution'],
}

const DATASET_PERSON_FIELD: Record<string, string> = {
  memoires:   'Student 1',
  pfe:        'Student 1',
  p45:        'Supervisor 1',
  pfe_france: 'Student 1',
  theses:     'Student 1',
}

function buildTitleMap(
  datasets: Array<{ rows: Record<string, unknown>[]; key: string }>
): Map<string, Array<{ title: string; dataset: string; person: string; record: Record<string, unknown> }>> {
  const map = new Map<string, Array<{ title: string; dataset: string; person: string; record: Record<string, unknown> }>>()
  for (const { rows, key } of datasets) {
    const fields = DATASET_LOCATION_FIELDS[key] ?? []
    const personField = DATASET_PERSON_FIELD[key] ?? 'Student 1'
    for (const row of rows) {
      const title = String(row['Title'] ?? '')
      if (!title) continue
      const person = String(row[personField] ?? '')
      const locations = fields.map((f) => row[f]).filter((v): v is string => typeof v === 'string' && v !== '')
      for (const loc of new Set(locations)) {
        if (!map.has(loc)) map.set(loc, [])
        map.get(loc)!.push({ title, dataset: key, person, record: row })
      }
    }
  }
  return map
}

function parseGeoAreas(): Map<string, { nameEN: string; isoNumeric: string }> {
  const map = new Map<string, { nameEN: string; isoNumeric: string }>()
  const lines = geoAreasCsv.trim().split('\n')
  for (const line of lines.slice(1)) {
    const [nameFR, nameEN, level, , isoNumeric] = parseCSVLine(line)
    if (level !== 'country' || !isoNumeric) continue
    map.set(nameFR, { nameEN, isoNumeric })
  }
  return map
}

const DATASET_COUNTRY_FIELDS: Record<string, string[]> = {
  memoires:   ['Country 1', 'Country 2', 'Country 3', 'Country 4'],
  pfe:        ['Country 1', 'Country 2', 'Country 3', 'Country 4'],
  p45:        ['Country 1', 'Country 2', 'Country 3', 'Country 4'],
  pfe_france: [],
  theses:     ['Country 1', 'Country 2', 'Country 3', 'Country 4'],
}

function buildCountryZones(
  datasets: Array<{ rows: Record<string, unknown>[]; key: string }>,
  geoPointNames: Set<string>,
  geoAreas: Map<string, { nameEN: string; isoNumeric: string }>
): CountryZone[] {
  const byCountry = new Map<string, Array<{ title: string; dataset: string; person: string; record: Record<string, unknown> }>>()

  for (const { rows, key } of datasets) {
    const locationFields = DATASET_LOCATION_FIELDS[key] ?? []
    const countryFields = DATASET_COUNTRY_FIELDS[key] ?? []
    const personField = DATASET_PERSON_FIELD[key] ?? 'Student 1'

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

type StatItem = { label: string; dataset: string; record: Record<string, unknown> }

function computeRecordStats(
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
    const locationFields = DATASET_LOCATION_FIELDS[key] ?? []
    const countryFields = DATASET_COUNTRY_FIELDS[key] ?? []
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

function parseGlobePoints(rows: Partenariat[], type: GlobePoint['type']): GlobePoint[] {
  return rows.flatMap((row) => {
    const raw = row['Geographic coordinates']
    if (!raw) return []
    const [latStr, lonStr] = raw.split(',')
    const lat = parseFloat(latStr?.trim())
    const lon = parseFloat(lonStr?.trim())
    if (!isFinite(lat) || !isFinite(lon)) return []
    return [{
      lat,
      lon,
      institution: row['Institution (full name)'] ?? row['Institution'] ?? '',
      city: row['City'] ?? '',
      country: row['Country'] ?? '',
      programme: row['Programme'] ?? '',
      type,
      record: row as unknown as Record<string, unknown>,
    }]
  })
}

export const load: PageServerLoad = async () => {
  const basePoints = loadGeoPoints()

  try {
    const [datasets, mobilites, horsMobilites, memoires, pfe, p45, pfeFrance, theses] =
      await Promise.all([
        fetchDatasetSummaries(),
        fetchPartenariatsMobilites(),
        fetchPartenariatsHorsMobilites(),
        fetchMemoires(),
        fetchPfe(),
        fetchP45(),
        fetchPfeFrance(),
        fetchTheses(),
      ])

    const allDatasets = [
      { rows: memoires as unknown as Record<string, unknown>[], key: 'memoires' },
      { rows: pfe as unknown as Record<string, unknown>[], key: 'pfe' },
      { rows: p45 as unknown as Record<string, unknown>[], key: 'p45' },
      { rows: pfeFrance as unknown as Record<string, unknown>[], key: 'pfe_france' },
      { rows: theses as unknown as Record<string, unknown>[], key: 'theses' },
    ]

    const titleMap = buildTitleMap(allDatasets)

    const geoPoints: GeoPoint[] = basePoints.map((pt) => ({
      ...pt,
      titles: titleMap.get(pt.name) ?? [],
    }))

    const globePoints: GlobePoint[] = [
      ...parseGlobePoints(mobilites, 'mobilites'),
      ...parseGlobePoints(horsMobilites, 'hors_mobilites'),
    ]

    const geoPointNames = new Set(basePoints.map((p) => p.name))
    const geoAreas = parseGeoAreas()
    const countryZones = buildCountryZones(allDatasets, geoPointNames, geoAreas)

    const allPartenariats = [
      { rows: mobilites, key: 'partenariats_mobilites' },
      { rows: horsMobilites, key: 'partenariats_hors_mobilites' },
    ]
    const recordStats = computeRecordStats(allDatasets, geoPoints, countryZones, globePoints.length, allPartenariats)

    return { datasets, sourceError: false, globePoints, geoPoints, countryZones, recordStats }
  } catch {
    return {
      datasets: [],
      sourceError: true,
      globePoints: [],
      geoPoints: basePoints.map((pt) => ({ ...pt, titles: [] })),
      countryZones: [],
      recordStats: { visualised: 0, noGeo: 0, otherMissing: 0, total: 0, noGeoItems: [], otherMissingItems: [] },
    }
  }
}
