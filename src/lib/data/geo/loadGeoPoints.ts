import type { GeoPoint } from '$lib/data/types'
import { parseCSVLine } from '$lib/data/csv'
import geoPointsCsv from '../../../../static/data/geo_points.csv?raw'

export function loadGeoPoints(): Omit<GeoPoint, 'titles'>[] {
  const lines = geoPointsCsv.trim().split('\n')
  return lines.slice(1).flatMap((line) => {
    const [name, type, city, province, country, continent, latStr, lonStr] = parseCSVLine(line)
    const lat = parseFloat(latStr)
    const lon = parseFloat(lonStr)
    if (!isFinite(lat) || !isFinite(lon)) return []
    return [{ name, type, city, province, country, continent, lat, lon }]
  })
}
