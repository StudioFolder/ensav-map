import { parseCSVLine } from '$lib/data/csv'
import geoAreasCsv from '../../../../static/data/geo_areas.csv?raw'

export function parseGeoAreas(): {
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
