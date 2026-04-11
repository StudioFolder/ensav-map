<script lang="ts">
  import type { PersonGroup } from '$lib/data/types'
  import type { SearchItem, Dataset } from '$lib/search/index'
  import { DATASET_LABELS } from '$lib/config/datasets'

  let { personGroups, onselect }: {
    personGroups: PersonGroup[]
    onselect: (items: SearchItem[], groupLabel?: string) => void
  } = $props()

  // Returns the last word of a name, used as the sort key (surname)
  function surname(name: string): string {
    const parts = name.trim().split(/\s+/)
    return parts[parts.length - 1]
  }

  const letterSections = $derived.by(() => {
    const sorted = [...personGroups].sort((a, b) =>
      surname(a.name).localeCompare(surname(b.name), 'fr', { sensitivity: 'base' })
    )
    const map = new Map<string, PersonGroup[]>()
    for (const p of sorted) {
      const letter = surname(p.name).charAt(0).toUpperCase()
      if (!map.has(letter)) map.set(letter, [])
      map.get(letter)!.push(p)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'))
  })

  let selectedPerson = $state<string | null>(null)
  let lines = $state<Array<{x1: number; y1: number; x2: number; y2: number; stroke: string}>>([])

  const rolesMap = $derived(new Map(personGroups.map(p => [p.name, p.roles])))

  const connectionCounts = $derived.by(() => {
    const map = new Map<string, { blue: number; amber: number }>()
    for (const [name, connected] of connectionMap) {
      let blue = 0, amber = 0
      for (const cName of connected) {
        const roles = rolesMap.get(cName)
        if (roles?.has('student')) blue++
        else amber++
      }
      map.set(name, { blue, amber })
    }
    return map
  })
  let wrapperEl = $state<HTMLElement | null>(null)

  // Build a graph: person name → Set of names who share at least one record with them
  const connectionMap = $derived.by(() => {
    const byRecord = new Map<string, string[]>()
    for (const person of personGroups) {
      for (const r of person.records) {
        const key = `${r.dataset}|${String(r.record['Id'] ?? r.title)}`
        if (!byRecord.has(key)) byRecord.set(key, [])
        byRecord.get(key)!.push(person.name)
      }
    }
    const graph = new Map<string, Set<string>>()
    for (const names of byRecord.values()) {
      if (names.length < 2) continue
      for (const n of names) {
        if (!graph.has(n)) graph.set(n, new Set())
        for (const m of names) {
          if (m !== n) graph.get(n)!.add(m)
        }
      }
    }
    return graph
  })

  function selectPerson(e: MouseEvent, name: string) {
    e.stopPropagation()
    selectedPerson = selectedPerson === name ? null : name
  }

  $effect(() => {
    if (!selectedPerson || !wrapperEl) { lines = []; return }

    const fromEl = wrapperEl.querySelector<HTMLElement>(`[data-person-icon="${CSS.escape(selectedPerson)}"]`)
    if (!fromEl) { lines = []; return }

    const connected = connectionMap.get(selectedPerson) ?? new Set()
    const wRect = wrapperEl.getBoundingClientRect()

    function center(el: HTMLElement) {
      const r = el.getBoundingClientRect()
      return {
        x: r.left + r.width / 2 - wRect.left,
        y: r.top + r.height / 2 - wRect.top,
      }
    }

    const from = center(fromEl)
    const newLines: typeof lines = []
    const R = 12 // px gap around each icon

    for (const name of connected) {
      const toEl = wrapperEl.querySelector<HTMLElement>(`[data-person-icon="${CSS.escape(name)}"]`)
      if (!toEl) continue
      const to = center(toEl)
      const dx = to.x - from.x
      const dy = to.y - from.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist === 0) continue
      const nx = dx / dist
      const ny = dy / dist
      const roles = rolesMap.get(name)
      const stroke = roles?.has('student') ? '#60a5fa' : '#fbbf24'
      newLines.push({
        x1: from.x + nx * R, y1: from.y + ny * R,
        x2: to.x - nx * R,   y2: to.y - ny * R,
        stroke,
      })
    }
    lines = newLines
  })

  function personClass(name: string): string {
    if (!selectedPerson) return ''
    const connected = connectionMap.get(selectedPerson) ?? new Set()
    if (name === selectedPerson || connected.has(name)) return ''
    return 'opacity-15 pointer-events-none'
  }

  function nameHoverClass(roles: Set<'student' | 'supervisor'>): string {
    if (roles.has('student')) return 'group-hover:text-blue-400 dark:group-hover:text-blue-500'
    return 'group-hover:text-amber-400 dark:group-hover:text-amber-500'
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

<!-- R11: this div is simultaneously the scroll container for the people grid and a click-outside-to-deselect
     backdrop. Converting it to <button> would break overflow-auto scroll behaviour. Keyboard deselection
     is handled by the Escape key in onWindowKeydown on the parent page. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="absolute inset-0 overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
  onclick={() => { selectedPerson = null }}
>
  <!-- relative wrapper stretches to match content; SVG is anchored here -->
  <div class="relative" bind:this={wrapperEl}>

    <!-- SVG lines overlay — covers full content area, pointer-events-none -->
    {#if lines.length > 0}
      <svg class="absolute inset-0 w-full h-full pointer-events-none z-10" aria-hidden="true">
        {#each lines as line}
          <line
            x1={line.x1} y1={line.y1}
            x2={line.x2} y2={line.y2}
            stroke={line.stroke}
            stroke-width="1"
            opacity="0.5"
          />
        {/each}
      </svg>
    {/if}

    <div class="px-8 pt-20 pb-8" style="columns: 240px; column-gap: 1.5rem;">
      {#each letterSections as [letter, persons]}
        <div class="break-inside-avoid mb-1 mt-4 first:mt-0">
          <div class="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600 pb-1 mb-2 border-b border-gray-200 dark:border-gray-800">
            {letter}
          </div>
        </div>
        {#each persons as person}
          <div class="break-inside-avoid mb-3 group transition-opacity duration-200 {personClass(person.name)}">
            <button
              type="button"
              onclick={(e) => selectPerson(e, person.name)}
              class="text-left w-full flex items-baseline gap-1.5"
            >
              <!-- Role icon — anchor for SVG lines -->
              <span data-person-icon={person.name} class="flex items-center shrink-0 self-center">
                {#if person.roles.has('student') && person.roles.has('supervisor')}
                  <!-- Both roles: show both icons -->
                  <svg class="w-3 h-3 text-blue-400 dark:text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                  <svg class="w-3 h-3 text-amber-400 dark:text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 0 3-3h7z"/>
                  </svg>
                {:else if person.roles.has('supervisor')}
                  <!-- Supervisor: open book -->
                  <svg class="w-3 h-3 text-amber-400 dark:text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 0 3-3h7z"/>
                  </svg>
                {:else}
                  <!-- Student: graduation cap -->
                  <svg class="w-3 h-3 text-blue-400 dark:text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                {/if}
              </span>
              <div class="text-sm font-medium text-gray-800 dark:text-gray-200 transition-colors duration-200 leading-snug {nameHoverClass(person.roles)}">
                {person.name}
              </div>
              {#if (connectionCounts.get(person.name)?.blue ?? 0) > 0 || (connectionCounts.get(person.name)?.amber ?? 0) > 0}
                <span class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-baseline gap-0.5 text-[11px] tabular-nums ml-2">
                  {#if (connectionCounts.get(person.name)?.blue ?? 0) > 0}
                    <span class="text-blue-400 dark:text-blue-500">{connectionCounts.get(person.name)!.blue}</span>
                  {/if}
                  {#if (connectionCounts.get(person.name)?.blue ?? 0) > 0 && (connectionCounts.get(person.name)?.amber ?? 0) > 0}
                    <span class="text-gray-300 dark:text-gray-600">·</span>
                  {/if}
                  {#if (connectionCounts.get(person.name)?.amber ?? 0) > 0}
                    <span class="text-amber-400 dark:text-amber-500">{connectionCounts.get(person.name)!.amber}</span>
                  {/if}
                </span>
              {/if}
            </button>
            <div class="mt-0.5 space-y-0.5 pl-[18px]">
              {#each person.records as r, i}
                <button
                  type="button"
                  onclick={() => openRecord(r, i, person.name)}
                  class="cursor-pointer text-left w-full text-xs text-gray-400 dark:text-gray-500 leading-tight line-clamp-1 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <span class="text-gray-300 dark:text-gray-600">{DATASET_LABELS[r.dataset as keyof typeof DATASET_LABELS] ?? r.dataset}</span>
                  {' · '}{r.title}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      {/each}
    </div>

  </div>
</div>
