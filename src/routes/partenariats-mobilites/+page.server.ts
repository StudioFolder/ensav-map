import { fetchPartenariatsMobilites } from '$lib/data/api'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  const partenariats = await fetchPartenariatsMobilites()
  return { partenariats }
}
