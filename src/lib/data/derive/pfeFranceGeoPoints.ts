import type { PfeFrance, GeoPoint } from '$lib/data/types'

export function parsePfeFranceGeoPoints(rows: PfeFrance[]): GeoPoint[] {
  return rows.flatMap((row) => {
    const r = row as unknown as Record<string, unknown>
    const raw = r['Geographic coordinates']
    if (!raw || typeof raw !== 'string') return []
    const [latStr, lonStr] = raw.split(',')
    const lat = parseFloat(latStr?.trim())
    const lon = parseFloat(lonStr?.trim())
    if (!isFinite(lat) || !isFinite(lon)) return []
    const pickStr = (v: unknown) =>
      typeof v === 'string' && v.trim() !== '' ? v.trim() : ''
    const displayName =
      pickStr(r['Landmark']) ||
      pickStr(r['Neighbourhood']) ||
      pickStr(r['City']) ||
      pickStr(row.Title) ||
      `pfe_france #${row.Id}`
    return [{
      name: displayName,
      type: 'pfe_france_record',
      city: String(r['City'] ?? ''),
      province: '',
      country: 'France',
      continent: 'Europe',
      lat,
      lon,
      titles: [{
        title: String(row.Title ?? ''),
        dataset: 'pfe_france',
        person: String(row['Student 1'] ?? ''),
        record: r,
      }],
    }]
  })
}
