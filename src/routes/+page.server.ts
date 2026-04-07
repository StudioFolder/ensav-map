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
import type { Partenariat, GlobePoint, GeoPoint } from '$lib/data/types'
import geoPointsCsv from '../../static/data/geo_points.csv?raw'

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

    const titleMap = buildTitleMap([
      { rows: memoires as unknown as Record<string, unknown>[], key: 'memoires' },
      { rows: pfe as unknown as Record<string, unknown>[], key: 'pfe' },
      { rows: p45 as unknown as Record<string, unknown>[], key: 'p45' },
      { rows: pfeFrance as unknown as Record<string, unknown>[], key: 'pfe_france' },
      { rows: theses as unknown as Record<string, unknown>[], key: 'theses' },
    ])

    const geoPoints: GeoPoint[] = basePoints.map((pt) => ({
      ...pt,
      titles: titleMap.get(pt.name) ?? [],
    }))

    const globePoints: GlobePoint[] = [
      ...parseGlobePoints(mobilites, 'mobilites'),
      ...parseGlobePoints(horsMobilites, 'hors_mobilites'),
    ]

    return { datasets, sourceError: false, globePoints, geoPoints }
  } catch {
    return {
      datasets: [],
      sourceError: true,
      globePoints: [],
      geoPoints: basePoints.map((pt) => ({ ...pt, titles: [] })),
    }
  }
}
