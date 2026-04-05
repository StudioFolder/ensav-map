import { fetchTable, fetchTableCount, fetchTableLastUpdated, TABLE_IDS } from './nocodb'
import type { Memoire, Pfe, P45, PfeFrance, These, Partenariat } from './types'

export async function fetchMemoires(): Promise<Memoire[]> {
  return fetchTable<Memoire>(TABLE_IDS.memoires)
}

export async function fetchPfe(): Promise<Pfe[]> {
  return fetchTable<Pfe>(TABLE_IDS.pfe)
}

export async function fetchP45(): Promise<P45[]> {
  return fetchTable<P45>(TABLE_IDS.p45)
}

export async function fetchPfeFrance(): Promise<PfeFrance[]> {
  return fetchTable<PfeFrance>(TABLE_IDS.pfe_france)
}

export async function fetchTheses(): Promise<These[]> {
  return fetchTable<These>(TABLE_IDS.theses)
}

export async function fetchPartenariatsMobilites(): Promise<Partenariat[]> {
  return fetchTable<Partenariat>(TABLE_IDS.partenariats_mobilites)
}

export async function fetchPartenariatsHorsMobilites(): Promise<Partenariat[]> {
  return fetchTable<Partenariat>(TABLE_IDS.partenariats_hors_mobilites)
}

export interface DatasetSummary {
  key: string
  label: string
  href: string
  count: number
  lastUpdated: string | null
}

const DATASET_META = [
  { key: 'memoires', label: 'Mémoires', href: '/memoires', tableId: TABLE_IDS.memoires },
  { key: 'pfe', label: 'PFE', href: '/pfe', tableId: TABLE_IDS.pfe },
  { key: 'p45', label: 'P45', href: '/p45', tableId: TABLE_IDS.p45 },
  { key: 'partenariats_mobilites', label: 'Partenariats — Mobilités', href: '/partenariats-mobilites', tableId: TABLE_IDS.partenariats_mobilites },
  { key: 'partenariats_hors_mobilites', label: 'Partenariats — Hors mobilités', href: '/partenariats-hors-mobilites', tableId: TABLE_IDS.partenariats_hors_mobilites },
  { key: 'pfe_france', label: 'PFE France 2025', href: '/pfe-france', tableId: TABLE_IDS.pfe_france },
  { key: 'theses', label: 'Thèses', href: '/theses', tableId: TABLE_IDS.theses },
]

export async function fetchDatasetSummaries(): Promise<DatasetSummary[]> {
  return Promise.all(
    DATASET_META.map(async (ds) => {
      const [count, lastUpdated] = await Promise.all([
        fetchTableCount(ds.tableId),
        fetchTableLastUpdated(ds.tableId),
      ])
      return { key: ds.key, label: ds.label, href: ds.href, count, lastUpdated }
    })
  )
}
