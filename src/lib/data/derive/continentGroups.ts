import type { Partenariat, GeoPoint, ContinentGroup, ContinentRecord } from '$lib/data/types'
import type { SearchItem, Dataset } from '$lib/search/index'
import { getDataset, type DatasetKey } from '$lib/config/datasets'

// The Continent field in NocoDB is a single text column, but authors
// sometimes list multiple continents in it (e.g. "Antarctique / Arctique"
// for a memoire about polar architecture). We split on the common
// separators and trim. Lenient — unknown tokens fall through to ad-hoc
// buckets so bad data stays visible in the UI instead of being silently
// dropped.
export function parseContinents(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[/;,&]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function buildContinentGroups(
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
    const dsConfig = getDataset(key as DatasetKey)
    const personField = dsConfig.personField ?? 'Student 1'
    const countryFields = dsConfig.countryFields ?? []
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
