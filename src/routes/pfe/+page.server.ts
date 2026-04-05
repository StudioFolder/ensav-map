import { fetchPfe } from '$lib/data/api'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  const pfe = await fetchPfe()
  return { pfe }
}
