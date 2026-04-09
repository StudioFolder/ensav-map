import { fetchTable, fetchTableCount, fetchTableLastUpdated } from './nocodb'
import { DATASET_KEYS, getDataset } from '$lib/config/datasets'
import type { Memoire, Pfe, P45, PfeFrance, These, Partenariat } from './types'

export async function fetchMemoires(): Promise<Memoire[]> {
  return fetchTable<Memoire>(getDataset('memoires').tableId)
}

export async function fetchPfe(): Promise<Pfe[]> {
  return fetchTable<Pfe>(getDataset('pfe').tableId)
}

export async function fetchP45(): Promise<P45[]> {
  return fetchTable<P45>(getDataset('p45').tableId)
}

export async function fetchPfeFrance(): Promise<PfeFrance[]> {
  return fetchTable<PfeFrance>(getDataset('pfe_france').tableId)
}

export async function fetchTheses(): Promise<These[]> {
  return fetchTable<These>(getDataset('theses').tableId)
}

export async function fetchPartenariatsMobilites(): Promise<Partenariat[]> {
  return fetchTable<Partenariat>(getDataset('partenariats_mobilites').tableId)
}

export async function fetchPartenariatsHorsMobilites(): Promise<Partenariat[]> {
  return fetchTable<Partenariat>(getDataset('partenariats_hors_mobilites').tableId)
}

export interface DatasetSummary {
  key: string
  label: string
  href: string
  count: number
  lastUpdated: string | null
}

export async function fetchDatasetSummaries(): Promise<DatasetSummary[]> {
  return Promise.all(
    DATASET_KEYS.map(async (key) => {
      const config = getDataset(key)
      const [count, lastUpdated] = await Promise.all([
        fetchTableCount(config.tableId),
        fetchTableLastUpdated(config.tableId),
      ])
      return { key, label: config.label, href: config.href, count, lastUpdated }
    })
  )
}
