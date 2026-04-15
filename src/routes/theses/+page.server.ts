import { fetchTheses } from '$lib/data/api'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  const theses = await fetchTheses()
  return { theses }
}
