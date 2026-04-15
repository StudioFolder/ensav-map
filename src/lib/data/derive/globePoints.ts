import type { Partenariat, GlobePoint } from '$lib/data/types'

export function parseGlobePoints(rows: Partenariat[], type: GlobePoint['type']): GlobePoint[] {
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
