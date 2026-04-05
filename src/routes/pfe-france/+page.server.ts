import { fetchPfeFrance } from '$lib/data/api'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  const pfe_france = await fetchPfeFrance()
  return { pfe_france }
}
