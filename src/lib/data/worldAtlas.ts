import * as topojson from 'topojson-client'

const WORLD_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedPromise: Promise<{ land: any; countries: any }> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadWorldAtlas(): Promise<{ land: any; countries: any }> {
  if (cachedPromise) return cachedPromise

  cachedPromise = fetch(WORLD_ATLAS_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`world-atlas fetch failed: ${r.status}`)
      return r.json()
    })
    .then((world) => ({
      land: topojson.feature(world, world.objects.land),
      countries: topojson.feature(world, world.objects.countries),
    }))
    .catch((err) => {
      cachedPromise = null // allow retry
      throw err
    })

  return cachedPromise
}
