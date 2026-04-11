<script lang="ts">
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  type SortKey = 'index' | 'programme' | 'institution' | 'city' | 'duration' | 'places'
  type SortDir = 'asc' | 'desc'

  let sortKey = $state<SortKey>('index')
  let sortDir = $state<SortDir>('asc')

  function setSort(key: SortKey) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey = key
      sortDir = 'asc'
    }
  }

  function strVal(v: string | null | undefined): string {
    return v?.trim() ?? ''
  }

  function strCompare(a: string, b: string, dir: SortDir): number {
    const emptyA = a === ''
    const emptyB = b === ''
    if (emptyA && emptyB) return 0
    if (emptyA) return 1
    if (emptyB) return -1
    const c = a.localeCompare(b, 'fr', { sensitivity: 'base' })
    return dir === 'asc' ? c : -c
  }

  function numCompare(a: string | null, b: string | null, dir: SortDir): number {
    const na = a !== null && a !== '' ? Number(a) : NaN
    const nb = b !== null && b !== '' ? Number(b) : NaN
    const missingA = isNaN(na)
    const missingB = isNaN(nb)
    if (missingA && missingB) return 0
    if (missingA) return 1
    if (missingB) return -1
    const c = na - nb
    return dir === 'asc' ? c : -c
  }

  const sortedPartenariats = $derived.by(() => {
    const indexed = data.partenariats.map((p, i) => ({ p, i }))
    return indexed.sort((a, b) => {
      const dir = sortDir
      switch (sortKey) {
        case 'index':
          return dir === 'asc' ? a.i - b.i : b.i - a.i
        case 'programme':
          return strCompare(strVal(a.p.Programme), strVal(b.p.Programme), dir)
        case 'institution':
          return strCompare(
            strVal(a.p['Institution (full name)'] ?? a.p.Institution),
            strVal(b.p['Institution (full name)'] ?? b.p.Institution),
            dir
          )
        case 'city':
          return strCompare(strVal(a.p.City), strVal(b.p.City), dir)
        case 'duration':
          return numCompare(a.p['Duration (months)'], b.p['Duration (months)'], dir)
        case 'places':
          return numCompare(a.p['Places Master ENSAV'], b.p['Places Master ENSAV'], dir)
        default:
          return 0
      }
    })
  })

  const maxDuration = 12

  function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (sortKey !== key) return 'none'
    return sortDir === 'asc' ? 'ascending' : 'descending'
  }
</script>

{#snippet chevronIcon(key: SortKey)}
  {#if sortKey === key}
    {#if sortDir === 'asc'}
      <svg width="10" height="7" viewBox="0 0 10 7" fill="none" class="inline-block flex-shrink-0 text-gray-600 dark:text-gray-300" aria-hidden="true">
        <polyline points="1,6 5,1 9,6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    {:else}
      <svg width="10" height="7" viewBox="0 0 10 7" fill="none" class="inline-block flex-shrink-0 text-gray-600 dark:text-gray-300" aria-hidden="true">
        <polyline points="1,1 5,6 9,1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    {/if}
  {:else}
    <svg width="10" height="12" viewBox="0 0 10 12" fill="none" class="inline-block flex-shrink-0 text-gray-300 dark:text-gray-600" aria-hidden="true">
      <polyline points="1,5 5,1 9,5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="1,7 5,11 9,7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  {/if}
{/snippet}

<main class="p-8 max-w-6xl mx-auto">
  <a href="/" class="inline-block mb-6 text-sm text-gray-500 hover:text-gray-800">← Retour</a>
  <h1 class="text-2xl font-bold mb-1">Partenariats — Mobilités</h1>
  <p class="text-sm text-gray-400 mb-8">{data.partenariats.length} entrées</p>

  <div class="overflow-x-auto">
    <table class="w-full text-sm text-left border-collapse">
      <thead>
        <tr class="border-b-2 border-gray-200 dark:border-gray-800">
          <th class="pb-2 pr-6 font-medium text-gray-400 whitespace-nowrap w-10" aria-sort={ariaSort('index')}>
            <button onclick={() => setSort('index')} class="inline-flex items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 font-medium text-gray-400 whitespace-nowrap hover:text-gray-700 dark:hover:text-gray-300">
              {@render chevronIcon('index')}#
            </button>
          </th>
          <th class="pb-2 pr-6 font-medium text-gray-500 whitespace-nowrap" aria-sort={ariaSort('programme')}>
            <button onclick={() => setSort('programme')} class="inline-flex items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 font-medium text-gray-500 whitespace-nowrap hover:text-gray-700 dark:hover:text-gray-300">
              {@render chevronIcon('programme')}Programme
            </button>
          </th>
          <th class="pb-2 pr-6 font-medium text-gray-500 whitespace-nowrap" aria-sort={ariaSort('institution')}>
            <button onclick={() => setSort('institution')} class="inline-flex items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 font-medium text-gray-500 whitespace-nowrap hover:text-gray-700 dark:hover:text-gray-300">
              {@render chevronIcon('institution')}Institution
            </button>
          </th>
          <th class="pb-2 pr-6 font-medium text-gray-500 whitespace-nowrap" aria-sort={ariaSort('city')}>
            <button onclick={() => setSort('city')} class="inline-flex items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 font-medium text-gray-500 whitespace-nowrap hover:text-gray-700 dark:hover:text-gray-300">
              {@render chevronIcon('city')}Ville
            </button>
          </th>
          <th class="pb-2 pr-6 font-medium text-gray-500 whitespace-nowrap" aria-sort={ariaSort('duration')}>
            <button onclick={() => setSort('duration')} class="inline-flex items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 font-medium text-gray-500 whitespace-nowrap hover:text-gray-700 dark:hover:text-gray-300">
              {@render chevronIcon('duration')}Durée (mois)
            </button>
          </th>
          <th class="pb-2 font-medium text-gray-500 whitespace-nowrap" aria-sort={ariaSort('places')}>
            <button onclick={() => setSort('places')} class="inline-flex items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 font-medium text-gray-500 whitespace-nowrap hover:text-gray-700 dark:hover:text-gray-300">
              {@render chevronIcon('places')}Places Master ENSAV
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        {#each sortedPartenariats as { p }, rowIdx}
          <tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/50">
            <td class="py-2 pr-6 text-gray-400 tabular-nums">{rowIdx + 1}</td>
            <td class="py-2 pr-6 text-gray-500 whitespace-nowrap">{p.Programme ?? '—'}</td>
            <td class="py-2 pr-6">
              <span class="block whitespace-nowrap">{p.Institution ?? '—'}</span>
              {#if p['Institution (full name)']}
                <span class="block text-gray-400 dark:text-gray-500">{p['Institution (full name)']}</span>
              {/if}
            </td>
            <td class="py-2 pr-6 text-gray-500 whitespace-nowrap">{p.City ?? '—'}</td>
            <td class="py-2 pr-6">
              {#if p['Duration (months)'] && !isNaN(Number(p['Duration (months)']))}
                {@const n = Number(p['Duration (months)'])}
                {@const pct = Math.round((n / maxDuration) * 100)}
                <span class="inline-flex items-center gap-2">
                  <span class="inline-block w-14 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                    <span class="block h-full bg-gray-400 dark:bg-gray-500 rounded-full" style="width:{pct}%"></span>
                  </span>
                  <span class="tabular-nums text-gray-500">{n}</span>
                </span>
              {:else}
                <span class="text-gray-400">—</span>
              {/if}
            </td>
            <td class="py-2">
              {#if p['Places Master ENSAV'] && !isNaN(Number(p['Places Master ENSAV']))}
                {@const n = Number(p['Places Master ENSAV'])}
                <span class="inline-flex items-center gap-1 flex-wrap">
                  {#each { length: n } as _}
                    <span class="block w-2 h-2 rounded-full bg-black dark:bg-white flex-shrink-0"></span>
                  {/each}
                </span>
              {:else}
                <span class="text-gray-400">—</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</main>
