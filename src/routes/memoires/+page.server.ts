import { fetchMemoires } from '$lib/data/api'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  const memoires = await fetchMemoires()
  return { memoires }
}
