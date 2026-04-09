<script lang="ts">
  import type { PersonGroup } from '$lib/data/types'
  import type { SearchItem, Dataset } from '$lib/search/index'

  const DATASET_LABELS: Record<string, string> = {
    partenariats_mobilites: 'Partenariats — Mobilités',
    partenariats_hors_mobilites: 'Partenariats — Hors mobilités',
    pfe: 'PFE',
    pfe_france: 'PFE France 2025',
    memoires: 'Mémoires',
    p45: 'P45',
    theses: 'Thèses',
  }

  let { personGroups, onselect }: {
    personGroups: PersonGroup[]
    onselect: (items: SearchItem[], groupLabel?: string) => void
  } = $props()

  const letterSections = $derived.by(() => {
    const map = new Map<string, PersonGroup[]>()
    for (const p of personGroups) {
      const letter = p.name.charAt(0).toUpperCase()
      if (!map.has(letter)) map.set(letter, [])
      map.get(letter)!.push(p)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'))
  })

  function openPerson(person: PersonGroup) {
    onselect(
      person.records.map((r, i) => ({
        id: `person-${person.name}-${i}`,
        dataset: r.dataset as Dataset,
        label: r.title,
        searchableText: '',
        record: r.record,
      })),
      person.name
    )
  }

  function openRecord(r: PersonGroup['records'][number], idx: number, personName: string) {
    onselect([{
      id: `person-${personName}-${idx}`,
      dataset: r.dataset as Dataset,
      label: r.title,
      searchableText: '',
      record: r.record,
    }])
  }
</script>

<div class="absolute inset-0 overflow-auto">
  <div class="px-8 pt-20 pb-8" style="columns: 240px; column-gap: 1.5rem;">
    {#each letterSections as [letter, persons]}
      <div class="break-inside-avoid mb-1 mt-4 first:mt-0">
        <div class="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600 pb-1 mb-2 border-b border-gray-200 dark:border-gray-800">
          {letter}
        </div>
      </div>
      {#each persons as person}
        <div class="break-inside-avoid mb-3">
          <button
            type="button"
            onclick={() => openPerson(person)}
            class="text-left w-full group flex items-center gap-1.5"
          >
            <!-- Role icon -->
            {#if person.roles.has('student') && person.roles.has('supervisor')}
              <!-- Both roles: show both icons -->
              <svg class="w-3 h-3 shrink-0 text-blue-400 dark:text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
              <svg class="w-3 h-3 shrink-0 text-amber-400 dark:text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 0 3-3h7z"/>
              </svg>
            {:else if person.roles.has('supervisor')}
              <!-- Supervisor: open book -->
              <svg class="w-3 h-3 shrink-0 text-amber-400 dark:text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 0 3-3h7z"/>
              </svg>
            {:else}
              <!-- Student: graduation cap -->
              <svg class="w-3 h-3 shrink-0 text-blue-400 dark:text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            {/if}
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-black dark:group-hover:text-white transition-colors leading-snug">
              {person.name}
            </div>
          </button>
          <div class="mt-0.5 space-y-0.5 pl-[18px]">
            {#each person.records as r, i}
              <button
                type="button"
                onclick={() => openRecord(r, i, person.name)}
                class="cursor-pointer text-left w-full text-xs text-gray-400 dark:text-gray-500 leading-tight line-clamp-1 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <span class="text-gray-300 dark:text-gray-600">{DATASET_LABELS[r.dataset] ?? r.dataset}</span>
                {' · '}{r.title}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    {/each}
  </div>
</div>
