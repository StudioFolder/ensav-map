export { TABLE_IDS } from '$lib/config/datasets'

const PROJECT_ID = 'pnsjzr9v75ibh5v'
const BASE_URL = 'https://nocodb.studiofolder.synology.me'

async function nocoFetch(tableId: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString()
  const url = `${BASE_URL}/api/v1/db/data/noco/${PROJECT_ID}/${tableId}?${query}`
  const res = await fetch(url, {
    headers: { 'xc-token': import.meta.env.VITE_NOCODB_TOKEN },
  })
  if (!res.ok) throw new Error(`NocoDB error: ${res.status} ${res.statusText}`)
  return res.json()
}

export async function fetchTable<T>(tableId: string): Promise<T[]> {
  const json = await nocoFetch(tableId, { limit: '300' })
  return json.list as T[]
}

export async function fetchTableCount(tableId: string): Promise<number> {
  const json = await nocoFetch(tableId, { limit: '1' })
  return json.pageInfo?.totalRows ?? 0
}

export async function fetchTableLastUpdated(tableId: string): Promise<string | null> {
  // Fall back to CreatedAt because NocoDB only sets UpdatedAt on edits —
  // freshly-imported tables have UpdatedAt = null on every row.
  const [byUpdated, byCreated] = await Promise.all([
    nocoFetch(tableId, { limit: '1', sort: '-UpdatedAt' }),
    nocoFetch(tableId, { limit: '1', sort: '-CreatedAt' }),
  ])
  const updated = byUpdated.list?.[0]?.UpdatedAt ?? null
  const created = byCreated.list?.[0]?.CreatedAt ?? null
  if (updated && created) return updated > created ? updated : created
  return updated ?? created
}
