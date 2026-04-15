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
import type { GlobePoint, GeoPoint } from '$lib/data/types'
import { loadGeoPoints } from '$lib/data/geo/loadGeoPoints'
import { parseGeoAreas } from '$lib/data/geo/parseGeoAreas'
import { buildTitleMap } from '$lib/data/derive/titleMap'
import { buildCountryZones } from '$lib/data/derive/countryZones'
import { buildContinentGroups } from '$lib/data/derive/continentGroups'
import { computeRecordStats } from '$lib/data/derive/stats'
import { buildPersonGroups } from '$lib/data/derive/personGroups'
import { parseGlobePoints } from '$lib/data/derive/globePoints'
import { buildTimelineRecords } from '$lib/data/derive/timeline'

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
    const { records: timelineRecords, missing: timelineMissing } = buildTimelineRecords(memoires, pfeFrance, pfe, p45, theses)

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
