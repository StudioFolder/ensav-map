import { fetchP45 } from '$lib/data/api'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  const p45 = await fetchP45()
  return { p45 }
}
