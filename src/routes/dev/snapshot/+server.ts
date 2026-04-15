import { dev } from '$app/environment'
import type { RequestHandler } from './$types'
import { stableStringify } from '$lib/dev/stableStringify'
import { loadGeoPoints } from '$lib/data/geo/loadGeoPoints'
import { parseGeoAreas } from '$lib/data/geo/parseGeoAreas'
import { buildTitleMap } from '$lib/data/derive/titleMap'
import { buildCountryZones } from '$lib/data/derive/countryZones'
import { buildContinentGroups } from '$lib/data/derive/continentGroups'
import { computeRecordStats } from '$lib/data/derive/stats'
import { buildPersonGroups } from '$lib/data/derive/personGroups'
import { parseGlobePoints } from '$lib/data/derive/globePoints'
import { buildTimelineRecords } from '$lib/data/derive/timeline'
import {
  fetchPartenariatsMobilites,
  fetchPartenariatsHorsMobilites,
  fetchMemoires,
  fetchPfe,
  fetchP45,
  fetchPfeFrance,
  fetchTheses,
} from '$lib/data/api'
import type { Partenariat, GeoPoint, Memoire, Pfe, P45, PfeFrance, These } from '$lib/data/types'
import fs from 'fs/promises'
import path from 'path'

const FIXTURES_DIR = path.resolve(process.cwd(), 'fixtures/derivation')
const INPUT_DIR = path.join(FIXTURES_DIR, 'input/nocodb')
const OUTPUT_DIR = path.join(FIXTURES_DIR, 'output')

async function ensureDirs(): Promise<void> {
  await fs.mkdir(INPUT_DIR, { recursive: true })
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
}

function runDerivations(
  memoires: Memoire[],
  pfe: Pfe[],
  p45: P45[],
  pfeFrance: PfeFrance[],
  theses: These[],
  mobilites: Partenariat[],
  horsMobilites: Partenariat[],
) {
  const allDatasets = [
    { rows: memoires as unknown as Record<string, unknown>[], key: 'memoires' },
    { rows: pfe as unknown as Record<string, unknown>[], key: 'pfe' },
    { rows: p45 as unknown as Record<string, unknown>[], key: 'p45' },
    { rows: pfeFrance as unknown as Record<string, unknown>[], key: 'pfe_france' },
    { rows: theses as unknown as Record<string, unknown>[], key: 'theses' },
  ]
  const allPartenariats = [
    { rows: mobilites, key: 'partenariats_mobilites' },
    { rows: horsMobilites, key: 'partenariats_hors_mobilites' },
  ]

  const basePoints = loadGeoPoints()
  const geoAreasResult = parseGeoAreas()
  const { countries: geoAreas, continents: continentEN } = geoAreasResult

  const titleMap = buildTitleMap(allDatasets)
  const geoPoints: GeoPoint[] = basePoints.map((pt) => ({ ...pt, titles: titleMap.get(pt.name) ?? [] }))
  const globePoints = [
    ...parseGlobePoints(mobilites, 'mobilites'),
    ...parseGlobePoints(horsMobilites, 'hors_mobilites'),
  ]
  const geoPointNames = new Set(basePoints.map((p) => p.name))
  const countryZones = buildCountryZones(allDatasets, geoPointNames, geoAreas)
  const { groups, missing: continentMissing, uniqueShown } =
    buildContinentGroups(allDatasets, allPartenariats, geoPoints, geoAreas, continentEN)
  const recordStats = computeRecordStats(allDatasets, geoPoints, countryZones, globePoints.length, allPartenariats)
  const personGroups = buildPersonGroups(allDatasets)
  const { records: timelineRecords, missing: timelineMissing } =
    buildTimelineRecords(memoires, pfeFrance, pfe, p45, theses)

  return {
    basePoints,
    geoAreasResult,
    geoPoints,
    globePoints,
    countryZones,
    continentGroups: { groups, missing: continentMissing, uniqueShown },
    recordStats,
    personGroups,
    timeline: { records: timelineRecords, missing: timelineMissing },
  }
}

async function capture(): Promise<Response> {
  const [mobilites, horsMobilites, memoires, pfe, p45, pfeFrance, theses] = await Promise.all([
    fetchPartenariatsMobilites(),
    fetchPartenariatsHorsMobilites(),
    fetchMemoires(),
    fetchPfe(),
    fetchP45(),
    fetchPfeFrance(),
    fetchTheses(),
  ])

  const derived = runDerivations(memoires, pfe, p45, pfeFrance, theses, mobilites, horsMobilites)
  const { recordStats } = derived

  // Invariant check before writing — a broken invariant means frozen-bad state
  const sum = recordStats.visualised + recordStats.noGeo + recordStats.otherMissing
  if (sum !== recordStats.total) {
    return new Response(
      JSON.stringify({
        error: 'Stats invariant violated: visualised + noGeo + otherMissing !== total',
        visualised: recordStats.visualised,
        noGeo: recordStats.noGeo,
        otherMissing: recordStats.otherMissing,
        total: recordStats.total,
        sum,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const wrote: string[] = []

  // Write NocoDB inputs
  const inputWrites: [string, unknown][] = [
    ['partenariats_mobilites.json', mobilites],
    ['partenariats_hors_mobilites.json', horsMobilites],
    ['memoires.json', memoires],
    ['pfe.json', pfe],
    ['p45.json', p45],
    ['pfe_france.json', pfeFrance],
    ['theses.json', theses],
  ]
  for (const [name, data] of inputWrites) {
    await fs.writeFile(path.join(INPUT_DIR, name), stableStringify(data))
    wrote.push(`input/nocodb/${name}`)
  }

  // Write derivation outputs
  const outputWrites: [string, unknown][] = [
    ['geoPointsParsed.json', derived.basePoints],
    ['geoAreasParsed.json', derived.geoAreasResult],
    ['geoPointsJoined.json', derived.geoPoints],
    ['globePoints.json', derived.globePoints],
    ['countryZones.json', derived.countryZones],
    ['continentGroups.json', derived.continentGroups],
    ['recordStats.json', derived.recordStats],
    ['personGroups.json', derived.personGroups],
    ['timeline.json', derived.timeline],
  ]
  for (const [name, data] of outputWrites) {
    await fs.writeFile(path.join(OUTPUT_DIR, name), stableStringify(data))
    wrote.push(`output/${name}`)
  }

  return new Response(
    JSON.stringify({
      mode: 'capture',
      ok: true,
      wrote,
      invariants: {
        statsSum: `${recordStats.visualised} + ${recordStats.noGeo} + ${recordStats.otherMissing} = ${recordStats.total} ✓`,
      },
      counts: {
        partenariats_mobilites: mobilites.length,
        partenariats_hors_mobilites: horsMobilites.length,
        memoires: memoires.length,
        pfe: pfe.length,
        p45: p45.length,
        pfe_france: pfeFrance.length,
        theses: theses.length,
      },
    }, null, 2),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

async function verify(): Promise<Response> {
  // Read frozen NocoDB inputs
  const readInput = async <T>(name: string): Promise<T> => {
    const raw = await fs.readFile(path.join(INPUT_DIR, name), 'utf-8')
    return JSON.parse(raw) as T
  }

  const [mobilites, horsMobilites, memoires, pfe, p45, pfeFrance, theses] = await Promise.all([
    readInput<Partenariat[]>('partenariats_mobilites.json'),
    readInput<Partenariat[]>('partenariats_hors_mobilites.json'),
    readInput<Memoire[]>('memoires.json'),
    readInput<Pfe[]>('pfe.json'),
    readInput<P45[]>('p45.json'),
    readInput<PfeFrance[]>('pfe_france.json'),
    readInput<These[]>('theses.json'),
  ])

  const derived = runDerivations(memoires, pfe, p45, pfeFrance, theses, mobilites, horsMobilites)

  const outputPairs: [string, unknown][] = [
    ['geoPointsParsed.json', derived.basePoints],
    ['geoAreasParsed.json', derived.geoAreasResult],
    ['geoPointsJoined.json', derived.geoPoints],
    ['globePoints.json', derived.globePoints],
    ['countryZones.json', derived.countryZones],
    ['continentGroups.json', derived.continentGroups],
    ['recordStats.json', derived.recordStats],
    ['personGroups.json', derived.personGroups],
    ['timeline.json', derived.timeline],
  ]

  const diffs: Array<{
    file: string
    firstDivergentLine: number
    expectedLength: number
    actualLength: number
    previewExpected: string
    previewActual: string
  }> = []

  for (const [name, freshValue] of outputPairs) {
    const committed = await fs.readFile(path.join(OUTPUT_DIR, name), 'utf-8')
    const actual = stableStringify(freshValue)
    if (committed === actual) continue

    const committedLines = committed.split('\n')
    const actualLines = actual.split('\n')
    const maxLen = Math.max(committedLines.length, actualLines.length)
    let firstDivergentLine = maxLen
    for (let i = 0; i < maxLen; i++) {
      if (committedLines[i] !== actualLines[i]) {
        firstDivergentLine = i + 1
        break
      }
    }
    const ctx = 2
    const start = Math.max(0, firstDivergentLine - 1 - ctx)
    const end = firstDivergentLine - 1 + ctx + 1

    diffs.push({
      file: `output/${name}`,
      firstDivergentLine,
      expectedLength: committed.length,
      actualLength: actual.length,
      previewExpected: committedLines.slice(start, end).join('\n'),
      previewActual: actualLines.slice(start, end).join('\n'),
    })
  }

  if (diffs.length > 0) {
    return new Response(
      JSON.stringify({ mode: 'verify', ok: false, diffs }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ mode: 'verify', ok: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

export const POST: RequestHandler = async ({ url }) => {
  if (!dev) return new Response('Not available in production', { status: 403 })

  const mode = url.searchParams.get('mode') ?? 'verify'

  try {
    await ensureDirs()

    if (mode === 'capture') return await capture()
    if (mode === 'verify') return await verify()
    return new Response(`Unknown mode: ${mode}. Use ?mode=capture or ?mode=verify`, { status: 400 })
  } catch (err) {
    const e = err as Error
    return new Response(
      JSON.stringify({ error: e.message, stack: e.stack }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
