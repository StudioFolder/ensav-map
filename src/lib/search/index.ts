import Fuse from 'fuse.js'
import { fetchTable } from '$lib/data/nocodb'
import { DATASET_KEYS, DATASET_LABELS, getDataset, type DatasetKey } from '$lib/config/datasets'

// Re-export under the old name so existing importers keep working unchanged
export type Dataset = DatasetKey

export type SearchItem = {
  id: string
  dataset: Dataset
  label: string
  searchableText: string
  record: Record<string, unknown>
}

export type SearchGroup = {
  dataset: Dataset
  label: string
  results: SearchItem[]
}

function fields(record: Record<string, unknown>, keys: string[]): string {
  return keys
    .map((k) => record[k])
    .filter((v) => v != null && v !== '')
    .join(' ')
}

function buildItems(
  rows: Record<string, unknown>[],
  dataset: Dataset,
  labelKey: string,
  searchKeys: string[]
): SearchItem[] {
  return rows.map((row) => ({
    id: String(row['Id'] ?? Math.random()),
    dataset,
    label: String(row[labelKey] ?? ''),
    searchableText: fields(row, searchKeys),
    record: row,
  }))
}

let index: SearchItem[] | null = null
let fuse: Fuse<SearchItem> | null = null

export async function initSearch(): Promise<void> {
  const allRows = await Promise.all(
    DATASET_KEYS.map((key) =>
      fetchTable<Record<string, unknown>>(getDataset(key).tableId)
    )
  )

  index = DATASET_KEYS.flatMap((key, i) => {
    const config = getDataset(key)
    return buildItems(allRows[i], key, config.labelField, config.searchFields)
  })

  fuse = new Fuse(index, {
    keys: ['searchableText'],
    threshold: 0.3,
    includeScore: true,
  })
}

export function search(query: string): SearchGroup[] {
  if (!fuse || !index || query.trim() === '') return []

  const results = fuse.search(query).map((r) => r.item)

  const grouped = new Map<Dataset, SearchItem[]>()
  for (const item of results) {
    if (!grouped.has(item.dataset)) grouped.set(item.dataset, [])
    grouped.get(item.dataset)!.push(item)
  }

  return [...grouped.entries()].map(([dataset, items]) => ({
    dataset,
    label: DATASET_LABELS[dataset],
    results: items,
  }))
}
