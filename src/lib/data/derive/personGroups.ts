import type { PersonGroup } from '$lib/data/types'
import { getDataset, type DatasetKey } from '$lib/config/datasets'

export function buildPersonGroups(
  allDatasets: Array<{ rows: Record<string, unknown>[]; key: string }>
): PersonGroup[] {
  const byName = new Map<string, PersonGroup['records']>()
  for (const { rows, key } of allDatasets) {
    const dsConfig = getDataset(key as DatasetKey)
    for (const row of rows) {
      const title = String(row['Title'] ?? '')
      if (!title) continue
      // Collect names with their role; a name appearing in both keeps first role found
      const toAdd = new Map<string, 'student' | 'supervisor'>()
      for (const field of dsConfig.studentFields ?? []) {
        const v = row[field]
        if (typeof v === 'string' && v.trim() && !toAdd.has(v.trim())) toAdd.set(v.trim(), 'student')
      }
      for (const field of dsConfig.supervisorFields ?? []) {
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
