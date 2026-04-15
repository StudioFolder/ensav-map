import { getDataset, type DatasetKey } from '$lib/config/datasets'

export function buildTitleMap(
  datasets: Array<{ rows: Record<string, unknown>[]; key: string }>
): Map<string, Array<{ title: string; dataset: string; person: string; record: Record<string, unknown> }>> {
  const map = new Map<string, Array<{ title: string; dataset: string; person: string; record: Record<string, unknown> }>>()
  for (const { rows, key } of datasets) {
    const dsConfig = getDataset(key as DatasetKey)
    const fields = dsConfig.locationFields ?? []
    const personField = dsConfig.personField ?? 'Student 1'
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
