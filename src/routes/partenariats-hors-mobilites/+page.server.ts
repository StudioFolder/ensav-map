import { fetchPartenariatsHorsMobilites } from '$lib/data/api'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  const partenariats = await fetchPartenariatsHorsMobilites()
  return { partenariats }
}
