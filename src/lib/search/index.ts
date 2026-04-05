import Fuse from 'fuse.js'
import { fetchTable, TABLE_IDS } from '$lib/data/nocodb'

export type Dataset =
  | 'memoires'
  | 'pfe'
  | 'pfe_france'
  | 'p45'
  | 'theses'
  | 'partenariats_mobilites'
  | 'partenariats_hors_mobilites'

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

const DATASET_LABELS: Record<Dataset, string> = {
  memoires: 'Mémoires',
  pfe: 'PFE',
  pfe_france: 'PFE France 2025',
  p45: 'P45',
  theses: 'Thèses',
  partenariats_mobilites: 'Partenariats — Mobilités',
  partenariats_hors_mobilites: 'Partenariats — Hors mobilités',
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
  const [memoires, pfe, pfeFrance, p45, theses, mobilites, horsMobilites] =
    await Promise.all([
      fetchTable<Record<string, unknown>>(TABLE_IDS.memoires),
      fetchTable<Record<string, unknown>>(TABLE_IDS.pfe),
      fetchTable<Record<string, unknown>>(TABLE_IDS.pfe_france),
      fetchTable<Record<string, unknown>>(TABLE_IDS.p45),
      fetchTable<Record<string, unknown>>(TABLE_IDS.theses),
      fetchTable<Record<string, unknown>>(TABLE_IDS.partenariats_mobilites),
      fetchTable<Record<string, unknown>>(TABLE_IDS.partenariats_hors_mobilites),
    ])

  index = [
    ...buildItems(memoires, 'memoires', 'Title', [
      'Title', 'Student 1', 'Student 2', 'Student 3',
      'City 1', 'City 2', 'City 3', 'City 4',
      'Country 1', 'Country 2', 'Country 3', 'Country 4',
      'Region', 'Landmark', 'Institution',
    ]),
    ...buildItems(pfe, 'pfe', 'Title', [
      'Title', 'Student 1', 'Student 2', 'Student 3',
      'City 1', 'City 2', 'City 3', 'City 4',
      'Country 1', 'Country 2', 'Country 3', 'Country 4',
      'Region', 'Landmark', 'Institution',
    ]),
    ...buildItems(pfeFrance, 'pfe_france', 'Title', [
      'Title', 'Student 1', 'Student 2', 'Student 3',
      'Supervisor 1', 'Supervisor 2', 'Supervisor 3',
      'City', 'Region', 'Département', 'Landmark', 'Neighbourhood',
    ]),
    ...buildItems(p45, 'p45', 'Title', [
      'Title', 'Supervisor 1', 'Supervisor 2', 'Supervisor 3',
      'City 1', 'City 2', 'City 3', 'City 4',
      'Country 1', 'Country 2', 'Country 3', 'Country 4',
      'Region', 'Institution',
    ]),
    ...buildItems(theses, 'theses', 'Title', [
      'Title', 'Student 1', 'Student 2', 'Student 3',
      'City 1', 'City 2', 'City 3', 'City 4',
      'Country 1', 'Country 2', 'Country 3', 'Country 4',
      'Region', 'Institution',
    ]),
    ...buildItems(mobilites, 'partenariats_mobilites', 'Institution', [
      'Institution', 'Institution (full name)', 'City', 'Country',
    ]),
    ...buildItems(horsMobilites, 'partenariats_hors_mobilites', 'Institution', [
      'Institution', 'Institution (full name)', 'City', 'Country',
    ]),
  ]

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
