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
import type { Partenariat, GlobePoint, GeoPoint, CountryZone, ContinentGroup, ContinentRecord, PersonGroup, TimelineRecord, Memoire, Pfe, PfeFrance } from '$lib/data/types'
import type { SearchItem, Dataset } from '$lib/search/index'
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

function parseGeoAreas(): {
  countries: Map<string, { nameEN: string; isoNumeric: string; parentNameFR: string }>
  continents: Map<string, string>
} {
  const countries = new Map<string, { nameEN: string; isoNumeric: string; parentNameFR: string }>()
  const continents = new Map<string, string>()
  const lines = geoAreasCsv.trim().split('\n')
  for (const line of lines.slice(1)) {
    const [nameFR, nameEN, level, , isoNumeric, , parentNameFR] = parseCSVLine(line)
    if (level === 'continent') {
      continents.set(nameFR, nameEN)
    } else if (level === 'country' && isoNumeric) {
      countries.set(nameFR, { nameEN, isoNumeric, parentNameFR: parentNameFR ?? '' })
    }
  }
  return { countries, continents }
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
  geoAreas: Map<string, { nameEN: string; isoNumeric: string; parentNameFR: string }>
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

// The Continent field in NocoDB is a single text column, but authors
// sometimes list multiple continents in it (e.g. "Antarctique / Arctique"
// for a memoire about polar architecture). We split on the common
// separators and trim. Lenient — unknown tokens fall through to ad-hoc
// buckets so bad data stays visible in the UI instead of being silently
// dropped.
function parseContinents(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[/;,&]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function buildContinentGroups(
  allDatasets: Array<{ rows: Record<string, unknown>[]; key: string }>,
  allPartenariats: Array<{ rows: Partenariat[]; key: string }>,
  geoPoints: GeoPoint[],
  countries: Map<string, { nameEN: string; isoNumeric: string; parentNameFR: string }>,
  continentEN: Map<string, string>
): { groups: ContinentGroup[]; missing: SearchItem[]; uniqueShown: number } {
  // Per continent: dedup by key, keeping a rich ContinentRecord for each unique entry
  // so the frontend can render tooltips on hover without a second lookup.
  const byContinent = new Map<string, Map<string, ContinentRecord>>()

  // Seed with all known continents so empty ones still appear as 0-count columns
  for (const nameFR of continentEN.keys()) {
    byContinent.set(nameFR, new Map())
  }

  // Running union of every key added to any bucket — the number of distinct
  // records that appear at least once in the continents view.
  const shownKeys = new Set<string>()

  // Resolve a list of FR country names to their EN equivalents via geoAreas;
  // unknown names fall through unchanged so bad data stays visible in the UI.
  const toEN = (frNames: string[]): string[] =>
    frNames.map((fr) => countries.get(fr)?.nameEN ?? fr)

  // geoPoint contributions per row, keyed by `${dataset}|${id}`. For each
  // row we keep a Map<continentFR, Set<countryFR>> so the country-grouped
  // view in ContinentView.svelte can display each dot under the country
  // that placed it on this continent.
  const geoPointMap = new Map<string, Map<string, Set<string>>>()
  const geoPointRecords = new Map<string, Omit<ContinentRecord, 'countriesFR' | 'countriesEN'>>()
  for (const pt of geoPoints.filter((p) => p.type !== 'institution')) {
    if (!pt.continent) continue
    for (const t of pt.titles) {
      const k = `${t.dataset}|${t.record['Id']}`
      if (!geoPointMap.has(k)) geoPointMap.set(k, new Map())
      const cmap = geoPointMap.get(k)!
      if (!cmap.has(pt.continent)) cmap.set(pt.continent, new Set())
      if (pt.country) cmap.get(pt.continent)!.add(pt.country)
      if (!geoPointRecords.has(k)) {
        geoPointRecords.set(k, { dataset: t.dataset, label: t.title, person: t.person, record: t.record })
      }
    }
  }

  const missing: SearchItem[] = []

  // Travaux: union continents from every available source so a row with
  // e.g. Country 1=France / Country 2=USA / Continent=Europe appears under
  // both Europe and North America. Sources considered per row:
  //   (a) every city-level geoPoint that references the row → contributes
  //       (continent, country) from the geoPoint itself
  //   (b) every Country N field resolved via the geoAreas map → contributes
  //       (parentNameFR, country)
  //   (c) the explicit Continent field, parsed with the "/" separator →
  //       contributes the continent with no country (lands in "Unknown")
  for (const { rows, key } of allDatasets) {
    const personField = DATASET_PERSON_FIELD[key] ?? 'Student 1'
    const countryFields = DATASET_COUNTRY_FIELDS[key] ?? []
    rows.forEach((row, index) => {
      const rowKey = `${key}|${row['Id'] ?? `idx${index}`}`
      // continent (FR) → set of country FR names attributable to that continent
      const continentToCountries = new Map<string, Set<string>>()
      const ensure = (c: string): Set<string> => {
        if (!continentToCountries.has(c)) continentToCountries.set(c, new Set())
        return continentToCountries.get(c)!
      }

      const fromGeo = geoPointMap.get(rowKey)
      if (fromGeo) {
        for (const [c, set] of fromGeo) {
          const target = ensure(c)
          for (const co of set) target.add(co)
        }
      }

      for (const f of countryFields) {
        const v = row[f]
        if (typeof v !== 'string' || v === '') continue
        const country = countries.get(v)
        if (country?.parentNameFR) ensure(country.parentNameFR).add(v)
      }

      for (const c of parseContinents(row['Continent'] as string | null | undefined)) {
        ensure(c)
      }

      if (continentToCountries.size === 0) {
        missing.push({
          id: `${key}|${row['Title'] ?? 'untitled'}|${index}`,
          dataset: key as Dataset,
          label: String(row['Title'] ?? '—'),
          searchableText: '',
          record: row,
        })
        return
      }

      const title = String(row['Title'] ?? '—')
      const person = String(row[personField] ?? '')
      const baseRec = geoPointRecords.get(rowKey) ?? { dataset: key, label: title, person, record: row }

      for (const [continent, countrySet] of continentToCountries) {
        const countriesFR = [...countrySet].sort()
        const rec: ContinentRecord = {
          ...baseRec,
          countriesFR,
          countriesEN: toEN(countriesFR),
        }
        if (!byContinent.has(continent)) byContinent.set(continent, new Map())
        const m = byContinent.get(continent)!
        if (!m.has(rowKey)) m.set(rowKey, rec)
        shownKeys.add(rowKey)
      }
    })
  }

  // Partenariats — one unique entry per row (keyed by Id). Rows without a
  // Continent field go into the missing list instead. Multi-continent
  // entries get added to each parsed bucket. The Country field is only
  // attributed to the bucket whose continent matches its parentNameFR;
  // mismatched buckets get an empty country (Unknown).
  for (const { rows, key } of allPartenariats) {
    rows.forEach((row, index) => {
      const r = row as unknown as Record<string, unknown>
      const continents = parseContinents(r['Continent'] as string | null | undefined)
      if (continents.length === 0) {
        missing.push({
          id: `partenariat|${row['Institution'] ?? index}`,
          dataset: key as Dataset,
          label: String(row['Institution (full name)'] ?? row['Institution'] ?? '—'),
          searchableText: '',
          record: r,
        })
        return
      }
      const rowKey = `${key}|${row['Id'] ?? `idx${index}`}`
      const label = String(row['Institution (full name)'] ?? row['Institution'] ?? '—')
      const countryFR = typeof r['Country'] === 'string' ? (r['Country'] as string) : ''
      const countryParent = countryFR ? countries.get(countryFR)?.parentNameFR : undefined
      for (const c of continents) {
        const matches = !!countryFR && countryParent === c
        const countriesFR = matches ? [countryFR] : []
        const rec: ContinentRecord = {
          dataset: key,
          label,
          person: '',
          record: r,
          countriesFR,
          countriesEN: toEN(countriesFR),
        }
        if (!byContinent.has(c)) byContinent.set(c, new Map())
        const m = byContinent.get(c)!
        if (!m.has(rowKey)) m.set(rowKey, rec)
        shownKeys.add(rowKey)
      }
    })
  }

  const groups: ContinentGroup[] = []
  for (const [nameFR, recs] of byContinent) {
    const partenariatRecords: ContinentRecord[] = []
    const travauxRecords: ContinentRecord[] = []
    for (const [k, rec] of recs) {
      if (k.startsWith('partenariats_')) partenariatRecords.push(rec)
      else travauxRecords.push(rec)
    }
    groups.push({
      nameFR,
      nameEN: continentEN.get(nameFR) ?? nameFR,
      count: recs.size,
      partenariatCount: partenariatRecords.length,
      partenariatRecords,
      travauxRecords,
    })
  }
  groups.sort((a, b) => b.count - a.count)
  return { groups, missing, uniqueShown: shownKeys.size }
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

const STUDENT_FIELDS = ['Student 1', 'Student 2', 'Student 3']
const SUPERVISOR_FIELDS = ['Supervisor 1', 'Supervisor 2', 'Supervisor 3']

function buildPersonGroups(
  allDatasets: Array<{ rows: Record<string, unknown>[]; key: string }>
): PersonGroup[] {
  const byName = new Map<string, PersonGroup['records']>()
  for (const { rows, key } of allDatasets) {
    for (const row of rows) {
      const title = String(row['Title'] ?? '')
      if (!title) continue
      // Collect names with their role; a name appearing in both keeps first role found
      const toAdd = new Map<string, 'student' | 'supervisor'>()
      for (const field of STUDENT_FIELDS) {
        const v = row[field]
        if (typeof v === 'string' && v.trim() && !toAdd.has(v.trim())) toAdd.set(v.trim(), 'student')
      }
      for (const field of SUPERVISOR_FIELDS) {
        const v = row[field]
        if (typeof v === 'string' && v.trim() && !toAdd.has(v.trim())) toAdd.set(v.trim(), 'supervisor')
      }
      for (const [name, role] of toAdd) {
        if (!byName.has(name)) byName.set(name, [])
        byName.get(name)!.push({ title, dataset: key, role, record: row })
      }
    }
  }
  return [...byName.entries()]
    .map(([name, records]) => ({
      name,
      roles: new Set(records.map((r) => r.role)) as Set<'student' | 'supervisor'>,
      records,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
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

function parseYear(raw: string | null | undefined): number | null {
  if (!raw) return null
  const match = raw.match(/\d{4}/)
  if (!match) return null
  const y = parseInt(match[0])
  return y >= 1900 && y <= 2100 ? y : null
}

// Parses a date string that may contain month precision (e.g. "2019-09-01").
// Returns a fractional year (mid-month) so the dot lands at the right x position.
function parseDateValue(raw: string | null | undefined): { year: number; month?: number; dateValue: number } | null {
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

function buildTimelineRecords(memoires: Memoire[], pfeFrance: PfeFrance[], pfe: Pfe[]): {
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
  // PFE: month-precise positioning via start_date
  for (const row of pfe) {
    const title = String(row['Title'] ?? '')
    const person = String(row['Student 1'] ?? '')
    const parsed = parseDateValue(row['Start date'])
    if (parsed !== null) {
      records.push({ dateValue: parsed.dateValue, year: parsed.year, month: parsed.month, label: title || '—', dataset: 'pfe', person, record: row as unknown as Record<string, unknown> })
    } else {
      missing.push({ id: `pfe|timeline|${row['Id']}`, dataset: 'pfe' as Dataset, label: title || '—', searchableText: '', record: row as unknown as Record<string, unknown> })
    }
  }
  records.sort((a, b) => a.dateValue - b.dateValue)
  return { records, missing }
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
    const { countries: geoAreas, continents: continentEN } = parseGeoAreas()
    const countryZones = buildCountryZones(allDatasets, geoPointNames, geoAreas)

    const allPartenariats = [
      { rows: mobilites, key: 'partenariats_mobilites' },
      { rows: horsMobilites, key: 'partenariats_hors_mobilites' },
    ]
    const { groups: continentGroups, missing: continentMissing, uniqueShown: continentUniqueShown } =
      buildContinentGroups(allDatasets, allPartenariats, geoPoints, geoAreas, continentEN)

    const recordStats = computeRecordStats(allDatasets, geoPoints, countryZones, globePoints.length, allPartenariats)
    const personGroups = buildPersonGroups(allDatasets)
    const { records: timelineRecords, missing: timelineMissing } = buildTimelineRecords(memoires, pfeFrance, pfe)

    return { datasets, sourceError: false, globePoints, geoPoints, countryZones, continentGroups, continentMissing, continentUniqueShown, recordStats, personGroups, timelineRecords, timelineMissing }
  } catch {
    return {
      datasets: [],
      sourceError: true,
      globePoints: [],
      geoPoints: basePoints.map((pt) => ({ ...pt, titles: [] })),
      countryZones: [],
      continentGroups: [],
      continentMissing: [],
      continentUniqueShown: 0,
      recordStats: { visualised: 0, noGeo: 0, otherMissing: 0, total: 0, noGeoItems: [], otherMissingItems: [] },
      personGroups: [],
      timelineRecords: [],
      timelineMissing: [],
    }
  }
}
