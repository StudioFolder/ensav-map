import { fetchDatasetSummaries } from '$lib/data/api'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  try {
    const datasets = await fetchDatasetSummaries()
    return { datasets, sourceError: false }
  } catch {
    return { datasets: [], sourceError: true }
  }
}
