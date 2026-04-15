import { fetchTable } from '$lib/data/nocodb'
import { DATASET_KEYS, getDataset, type DatasetKey } from '$lib/config/datasets'
import { GROUP_FIELDS, GROUP_LABELS, GROUP_ORDER, type FieldGroupKey } from './fields'

// Re-export under the old name so existing importers keep working unchanged
export type Dataset = DatasetKey
export type { FieldGroupKey }

export type SearchItem = {
  id: string
  dataset: Dataset
  label: string
  searchableText: string
  record: Record<string, unknown>
}

export type FieldResult = {
  value: string          // display value, e.g. "Paris" or a title string
  count: number          // number of backing records
  items: SearchItem[]    // passed to openItems() on click
}

export type FieldGroup = {
  key: FieldGroupKey
  label: string          // "Cities", "People", etc.
  results: FieldResult[] // capped at RESULT_CAP, sorted by count desc then value asc
  truncated: number      // extra results not shown (0 if none)
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s.toLocaleLowerCase('fr').normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

let index: SearchItem[] | null = null

export async function initSearch(): Promise<void> {
  const allRows = await Promise.all(
    DATASET_KEYS.map((key) =>
      fetchTable<Record<string, unknown>>(getDataset(key).tableId)
    )
  )

  index = DATASET_KEYS.flatMap((key, i) => {
    const config = getDataset(key)
    return allRows[i].map((row) => ({
      id: String(row['Id'] ?? Math.random()),
      dataset: key,
      label: String(row[config.labelField] ?? ''),
      searchableText: '',   // field kept for type compat; not used by the new search
      record: row,
    }))
  })
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const RESULT_CAP = 8

/**
 * For institutions, the canonical display key is:
 *   Institution (full name)  if present and non-empty
 *   Institution              otherwise
 * This ensures a record that has both fields appears under a single entry.
 */
function institutionCanonical(record: Record<string, unknown>): string {
  return String(record['Institution (full name)'] || record['Institution'] || '')
}

type Bucket = { value: string; itemSet: Set<string>; items: SearchItem[] }

export function search(query: string): FieldGroup[] {
  if (!index || query.trim().length < 2) return []

  const q = norm(query.trim())

  const groupMaps = new Map<FieldGroupKey, Map<string, Bucket>>()
  for (const gk of GROUP_ORDER) groupMaps.set(gk, new Map())

  for (const item of index) {
    const dsKey = item.dataset as DatasetKey

    for (const gk of GROUP_ORDER) {
      const fields = GROUP_FIELDS[gk][dsKey]
      if (!fields) continue

      const bucketMap = groupMaps.get(gk)!

      if (gk === 'institutions') {
        // Deduplicate by canonical (full name || short name) so a record with
        // both fields doesn't create two entries, and so short + full name
        // variants across different records sharing the same institution merge.
        const canonical = institutionCanonical(item.record)
        if (!canonical) continue

        // Only add if at least one institution field matches
        const anyMatch = fields.some((f) => {
          const v = String(item.record[f] ?? '')
          return v !== '' && norm(v).includes(q)
        })
        if (!anyMatch) continue

        const key = norm(canonical)
        if (!bucketMap.has(key)) bucketMap.set(key, { value: canonical, itemSet: new Set(), items: [] })
        const bucket = bucketMap.get(key)!
        if (!bucket.itemSet.has(item.id)) {
          bucket.itemSet.add(item.id)
          bucket.items.push(item)
        }
      } else {
        for (const field of fields) {
          const raw = String(item.record[field] ?? '')
          if (raw === '' || !norm(raw).includes(q)) continue

          const key = norm(raw)
          if (!bucketMap.has(key)) bucketMap.set(key, { value: raw, itemSet: new Set(), items: [] })
          const bucket = bucketMap.get(key)!
          if (!bucket.itemSet.has(item.id)) {
            bucket.itemSet.add(item.id)
            bucket.items.push(item)
          }
        }
      }
    }
  }

  const groups: FieldGroup[] = []

  for (const gk of GROUP_ORDER) {
    const bucketMap = groupMaps.get(gk)!
    if (bucketMap.size === 0) continue

    const sorted = [...bucketMap.values()].sort((a, b) => {
      if (b.items.length !== a.items.length) return b.items.length - a.items.length
      return a.value.localeCompare(b.value, 'fr', { sensitivity: 'base' })
    })

    const total = sorted.length
    groups.push({
      key: gk,
      label: GROUP_LABELS[gk],
      results: sorted.slice(0, RESULT_CAP).map((b) => ({
        value: b.value,
        count: b.items.length,
        items: b.items,
      })),
      truncated: Math.max(0, total - RESULT_CAP),
    })
  }

  return groups
}
