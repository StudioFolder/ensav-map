import { fetchDatasetSummaries } from '$lib/data/api'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  const datasets = await fetchDatasetSummaries()
  return { datasets }
}
