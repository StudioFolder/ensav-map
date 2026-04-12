<script lang="ts">
  import { onMount } from 'svelte'
  import type { PageData } from './$types'
  import { initSearch, search, type FieldGroup, type SearchItem, type Dataset } from '$lib/search/index'
  import { DATASET_KEYS, DATASET_LABELS, DATASETS } from '$lib/config/datasets'
  import RecordDetailModal from '$lib/components/RecordDetailModal.svelte'
  import DatasetFilterCard from '$lib/components/DatasetFilterCard.svelte'
  import { scramble } from '$lib/actions/scramble'
  import Globe from '$lib/components/Globe.svelte'
  import ContinentView from '$lib/components/ContinentView.svelte'
  import PeopleView from '$lib/components/PeopleView.svelte'
  import TimelineView from '$lib/components/TimelineView.svelte'

  let { data }: { data: PageData } = $props()


  const datasets = $derived(
    data.sourceError
      ? DATASET_KEYS.map((key) => ({ key, label: DATASET_LABELS[key], error: true as const, kind: DATASETS[key].kind }))
      : DATASET_KEYS
          .map((key) => data.datasets.find((d) => d.key === key))
          .filter((d): d is (typeof data.datasets)[number] => d !== undefined)
          .map((d) => ({ ...d, error: false as const, nocodbUrl: DATASETS[d.key as keyof typeof DATASETS].nocodbUrl, kind: DATASETS[d.key as keyof typeof DATASETS].kind }))
  )

  let openGroups = $state({ partenariats: false, travaux: false })

  function isGroupAllHidden(keys: string[]): boolean {
    return keys.every(k => hiddenDatasets.has(k))
  }

  function toggleGroup(keys: string[]) {
    const next = new Set(hiddenDatasets)
    if (keys.every(k => next.has(k))) {
      keys.forEach(k => next.delete(k))
    } else {
      keys.forEach(k => next.add(k))
    }
    hiddenDatasets = next
  }

  const LAST_VISIT_KEY = 'ensav_last_visit'
  const THEME_KEY = 'ensav_theme'
  let lastVisit: Date | null = $state(null)
  // Read the theme the blocking script in app.html already applied to <html>,
  // so the Globe is created with the correct palette on the first client render
  // (avoids a canvas/globe mismatch where CSS is dark but the SVG is still light).
  let theme: 'dark' | 'light' = $state(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light'
  )

  let projectionType = $state<'orthographic' | 'naturalEarth' | 'continents' | 'people' | 'timeline'>('orthographic')

  let hiddenDatasets = $state(new Set<string>())

  function toggleDataset(key: string) {
    const next = new Set(hiddenDatasets)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    hiddenDatasets = next
  }

  const visibleGlobePoints = $derived(
    data.globePoints.filter(p =>
      !hiddenDatasets.has(p.type === 'mobilites' ? 'partenariats_mobilites' : 'partenariats_hors_mobilites')
    )
  )

  const visibleGeoPoints = $derived(
    data.geoPoints
      .map(p => ({
        ...p,
        titles: p.type === 'institution' ? p.titles : p.titles.filter(t => !hiddenDatasets.has(t.dataset))
      }))
      .filter(p => p.type === 'institution' || p.titles.length > 0)
  )

  const visibleCountryZones = $derived(
    data.countryZones
      .map(z => ({ ...z, titles: z.titles.filter(t => !hiddenDatasets.has(t.dataset)) }))
      .filter(z => z.titles.length > 0)
  )

  const visibleContinentGroups = $derived(
    data.continentGroups.map(g => {
      const pr = g.partenariatRecords.filter(r => !hiddenDatasets.has(r.dataset))
      const tr = g.travauxRecords.filter(r => !hiddenDatasets.has(r.dataset))
      return { ...g, partenariatRecords: pr, travauxRecords: tr, count: pr.length + tr.length, partenariatCount: pr.length }
    })
  )

  const visiblePersonGroups = $derived(
    data.personGroups
      .map(p => ({ ...p, records: p.records.filter(r => !hiddenDatasets.has(r.dataset)) }))
      .filter(p => p.records.length > 0)
  )

  // Timeline view — visible records (memoires only for now)
  const visibleTimelineRecords = $derived(
    data.timelineRecords.filter(r => !hiddenDatasets.has(r.dataset))
  )
  const visibleTimelineMissing = $derived(
    data.timelineMissing.filter(r => !hiddenDatasets.has(r.dataset))
  )
  const timelineNocoDB = $derived(
    !data.sourceError ? (
      (data.datasets.find(d => d.key === 'memoires')?.count ?? 0) +
      (data.datasets.find(d => d.key === 'pfe_france')?.count ?? 0) +
      (data.datasets.find(d => d.key === 'pfe')?.count ?? 0) +
      (data.datasets.find(d => d.key === 'p45')?.count ?? 0) +
      (data.datasets.find(d => d.key === 'theses')?.count ?? 0)
    ) : 0
  )

  // Continent view — visible totals
  const visibleTotalDots = $derived(
    visibleContinentGroups.reduce((sum, g) => sum + g.count, 0)
  )

  const visibleUniqueShown = $derived.by(() => {
    const seen = new Set<string>()
    for (const g of visibleContinentGroups) {
      for (const r of [...g.partenariatRecords, ...g.travauxRecords]) {
        seen.add(`${r.dataset}|${r.record['Id']}`)
      }
    }
    return seen.size
  })

  const visibleExtraDots = $derived(visibleTotalDots - visibleUniqueShown)

  const visibleMissing = $derived(
    data.continentMissing.filter(item => !hiddenDatasets.has(item.dataset))
  )

  // Globe/map view — visible counts derived from the already-filtered collections
  const visibleVisualisedCount = $derived.by(() => {
    const seen = new Set<string>()
    for (const p of visibleGeoPoints) {
      if (p.type !== 'institution') {
        for (const t of p.titles) seen.add(`${t.dataset}|${t.record['Id']}`)
      }
    }
    for (const z of visibleCountryZones) {
      for (const t of z.titles) seen.add(`${t.dataset}|${t.record['Id']}`)
    }
    for (const p of visibleGlobePoints) {
      seen.add(`${p.type}|${p.record['Id'] ?? p.institution}`)
    }
    return seen.size
  })

  const visibleNoGeoItems = $derived(
    data.recordStats.noGeoItems.filter(it => !hiddenDatasets.has(it.dataset))
  )

  const visibleOtherMissingItems = $derived(
    data.recordStats.otherMissingItems.filter(it => !hiddenDatasets.has(it.dataset))
  )

  let query = $state('')
  let searchReady = $state(false)
  let searchGroups: FieldGroup[] = $state([])
  let debounceTimer: ReturnType<typeof setTimeout>
  let selectedItems: SearchItem[] = $state([])
  let selectedGroupLabel: string | undefined = $state(undefined)

  onMount(async () => {
    const stored = localStorage.getItem(LAST_VISIT_KEY)
    if (stored) lastVisit = new Date(stored)
    localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString())

    try {
      await initSearch()
      searchReady = true
    } catch {
      // NocoDB unreachable — search stays disabled
    }
  })

  function onInput(e: Event) {
    query = (e.target as HTMLInputElement).value
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      searchGroups = search(query)
    }, 200)
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(THEME_KEY, theme)
  }

  function isUpdatedSince(lastUpdated: string | null): boolean {
    if (!lastUpdated || !lastVisit) return false
    return new Date(lastUpdated) > lastVisit
  }

  function openItem(item: SearchItem) {
    selectedItems = [item]
  }

  function openItems(items: SearchItem[], groupLabel?: string) {
    selectedItems = items
    selectedGroupLabel = groupLabel
  }

  function closeItem() {
    selectedItems = []
    selectedGroupLabel = undefined
  }

  let globeFocused = $state(false)
  let globeClearTrigger = $state(0)

  function clearGlobeFocus() {
    globeClearTrigger += 1
  }

  function onWindowKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeItem()
  }



</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="flex h-screen overflow-hidden text-gray-800 dark:text-gray-200 {projectionType === 'naturalEarth' ? 'bg-[#e5e5e5] dark:bg-[#3a3a3a]' : projectionType === 'people' || projectionType === 'timeline' ? 'bg-gray-50 dark:bg-gray-900' : 'bg-gray-200 dark:bg-gray-950'}">

  <!-- Globe — fills remaining horizontal space -->
  <div class="relative flex-1 min-w-0 {projectionType === 'naturalEarth' ? 'bg-[#e5e5e5] dark:bg-[#3a3a3a]' : projectionType === 'people' || projectionType === 'timeline' ? 'bg-gray-50 dark:bg-gray-900' : 'bg-gray-200 dark:bg-gray-950'}">
    {#if projectionType === 'continents'}
      <ContinentView continentGroups={visibleContinentGroups} />
    {:else if projectionType === 'people'}
      <PeopleView personGroups={visiblePersonGroups} onselect={openItems} />
    {:else if projectionType === 'timeline'}
      <TimelineView records={data.timelineRecords} {hiddenDatasets} onselect={openItems} />
    {:else}
      {#key `${projectionType}-${theme}-${[...hiddenDatasets].sort().join(',')}`}
        <Globe points={visibleGlobePoints} geoPoints={visibleGeoPoints} countryZones={visibleCountryZones} {projectionType} {theme} onselect={openItems} onfocuschange={(v) => { globeFocused = v }} clearFocusTrigger={globeClearTrigger} />
      {/key}
    {/if}

    {#if globeFocused && (projectionType === 'orthographic' || projectionType === 'naturalEarth')}
      <button
        type="button"
        onclick={clearGlobeFocus}
        class="absolute top-3 right-3 z-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors flex items-center gap-1.5"
      >
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
        Deselect
      </button>
    {:else if !data.sourceError && projectionType !== 'people'}
      {@const s = data.recordStats}
      <div class="absolute top-3 right-3 z-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-xs tabular-nums space-y-1.5">
        {#if projectionType === 'timeline'}
          <div class="flex justify-between gap-6">
            <span class="text-black/40 dark:text-white/40">Shown</span>
            <span class="text-black/70 dark:text-white/70 font-medium" use:scramble={visibleTimelineRecords.length}></span>
          </div>
          <button
            type="button"
            onclick={() => openItems(visibleTimelineMissing, 'No publication year')}
            class="flex justify-between gap-6 w-full text-left group"
          >
            <span class="text-black/40 dark:text-white/40 group-hover:text-black/90 dark:group-hover:text-white/90 transition-colors">No year</span>
            <span class="text-black/70 dark:text-white/70 group-hover:text-black/90 dark:group-hover:text-white/90 transition-colors" use:scramble={visibleTimelineMissing.length}></span>
          </button>
          <div class="flex justify-between gap-6 border-t border-black/10 dark:border-white/10 pt-1.5">
            <span class="text-black/40 dark:text-white/40">Total</span>
            <span class="text-black/70 dark:text-white/70 font-medium" use:scramble={visibleTimelineRecords.length + visibleTimelineMissing.length}></span>
          </div>
          <div class="flex justify-between gap-6">
            <span class="text-black/40 dark:text-white/40">Total travaux (NocoDB)</span>
            <span class="text-black/70 dark:text-white/70 font-medium" use:scramble={timelineNocoDB}></span>
          </div>
        {:else if projectionType === 'continents'}
          <div class="flex justify-between gap-6">
            <span class="text-black/40 dark:text-white/40">Shown</span>
            <span class="text-black/70 dark:text-white/70 font-medium" use:scramble={visibleTotalDots}></span>
          </div>
          <div class="flex justify-between gap-6">
            <span class="text-black/25 dark:text-white/25">↳ single-continent</span>
            <span class="text-black/40 dark:text-white/40" use:scramble={visibleUniqueShown}></span>
          </div>
          <div class="flex justify-between gap-6">
            <span class="text-black/25 dark:text-white/25">↳ multi-continent</span>
            <span class="text-black/40 dark:text-white/40" use:scramble={visibleExtraDots}></span>
          </div>
          <button
            type="button"
            onclick={() => openItems(visibleMissing, 'No geographic info')}
            class="flex justify-between gap-6 w-full text-left group"
          >
            <span class="text-black/40 dark:text-white/40 group-hover:text-black/90 dark:group-hover:text-white/90 transition-colors">Not shown</span>
            <span class="text-black/70 dark:text-white/70 group-hover:text-black/90 dark:group-hover:text-white/90 transition-colors" use:scramble={visibleMissing.length}></span>
          </button>
          <div class="flex justify-between gap-6 border-t border-black/10 dark:border-white/10 pt-1.5">
            <span class="text-black/40 dark:text-white/40">Total</span>
            <span class="text-black/70 dark:text-white/70 font-medium" use:scramble={visibleTotalDots + visibleMissing.length}></span>
          </div>
          <div class="flex justify-between gap-6">
            <span class="text-black/40 dark:text-white/40">Total (NocoDB)</span>
            <span class="text-black/70 dark:text-white/70 font-medium" use:scramble={s.total}></span>
          </div>
        {:else}
          <div class="flex justify-between gap-6">
            <span class="text-black/40 dark:text-white/40">Visualised</span>
            <span class="text-black/70 dark:text-white/70 font-medium" use:scramble={visibleVisualisedCount}></span>
          </div>
          <button
            type="button"
            onclick={() => openItems(visibleNoGeoItems.map((it) => ({ id: `${it.dataset}|${it.label}`, dataset: it.dataset as Dataset, label: it.label, searchableText: it.label, record: it.record })), 'No geographic info')}
            class="flex justify-between gap-6 w-full text-left group"
          >
            <span class="text-black/40 dark:text-white/40 group-hover:text-black/90 dark:group-hover:text-white/90 transition-colors">No geographic info</span>
            <span class="text-black/70 dark:text-white/70 group-hover:text-black/90 dark:group-hover:text-white/90 transition-colors" use:scramble={visibleNoGeoItems.length}></span>
          </button>
          <button
            type="button"
            onclick={() => openItems(visibleOtherMissingItems.map((it) => ({ id: `${it.dataset}|${it.label}`, dataset: it.dataset as Dataset, label: it.label, searchableText: it.label, record: it.record })), 'Other missing')}
            class="flex justify-between gap-6 w-full text-left group"
          >
            <span class="text-black/40 dark:text-white/40 group-hover:text-black/90 dark:group-hover:text-white/90 transition-colors">Other missing</span>
            <span class="text-black/70 dark:text-white/70 group-hover:text-black/90 dark:group-hover:text-white/90 transition-colors" use:scramble={visibleOtherMissingItems.length}></span>
          </button>
          <div class="flex justify-between gap-6 border-t border-black/10 dark:border-white/10 pt-1.5">
            <span class="text-black/40 dark:text-white/40">Total</span>
            <span class="text-black/70 dark:text-white/70 font-medium" use:scramble={visibleVisualisedCount + visibleNoGeoItems.length + visibleOtherMissingItems.length}></span>
          </div>
        {/if}
      </div>
    {/if}

    <div class="absolute top-3 left-3 z-10 flex items-center gap-1 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-1.5 py-1.5">
      <button
        type="button"
        onclick={() => { projectionType = 'orthographic' }}
        class="px-2.5 py-1 rounded transition-colors {projectionType === 'orthographic' ? 'text-black/80 dark:text-white/80 font-medium' : 'text-black/30 dark:text-white/30 hover:text-black/50 dark:hover:text-white/50'}"
      >Globe</button>
      <span class="text-black/20 dark:text-white/20">/</span>
      <button
        type="button"
        onclick={() => { projectionType = 'naturalEarth' }}
        class="px-2.5 py-1 rounded transition-colors {projectionType === 'naturalEarth' ? 'text-black/80 dark:text-white/80 font-medium' : 'text-black/30 dark:text-white/30 hover:text-black/50 dark:hover:text-white/50'}"
      >Map</button>
      <span class="text-black/20 dark:text-white/20">/</span>
      <button
        type="button"
        onclick={() => { projectionType = 'continents' }}
        class="px-2.5 py-1 rounded transition-colors {projectionType === 'continents' ? 'text-black/80 dark:text-white/80 font-medium' : 'text-black/30 dark:text-white/30 hover:text-black/50 dark:hover:text-white/50'}"
      >Continents</button>
      <span class="text-black/20 dark:text-white/20">/</span>
      <button
        type="button"
        onclick={() => { projectionType = 'people' }}
        class="px-2.5 py-1 rounded transition-colors {projectionType === 'people' ? 'text-black/80 dark:text-white/80 font-medium' : 'text-black/30 dark:text-white/30 hover:text-black/50 dark:hover:text-white/50'}"
      >People</button>
      <span class="text-black/20 dark:text-white/20">/</span>
      <button
        type="button"
        onclick={() => { projectionType = 'timeline' }}
        class="px-2.5 py-1 rounded transition-colors {projectionType === 'timeline' ? 'text-black/80 dark:text-white/80 font-medium' : 'text-black/30 dark:text-white/30 hover:text-black/50 dark:hover:text-white/50'}"
      >Timeline</button>
    </div>

    {#if projectionType === 'people' && !data.sourceError}
      <div class="absolute top-3 right-3 z-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-xs tabular-nums space-y-1.5">
        <div class="flex justify-between gap-6">
          <span class="text-black/40 dark:text-white/40">People</span>
          <span class="text-black/70 dark:text-white/70 font-medium" use:scramble={visiblePersonGroups.length}></span>
        </div>
        <div class="flex justify-between gap-6">
          <span class="text-black/40 dark:text-white/40">Works</span>
          <span class="text-black/70 dark:text-white/70 font-medium" use:scramble={visiblePersonGroups.reduce((n, p) => n + p.records.length, 0)}></span>
        </div>
      </div>
    {/if}

    {#if selectedItems.length > 0}
      <RecordDetailModal
        items={selectedItems}
        groupLabel={selectedGroupLabel}
        onclose={closeItem}
      />
    {/if}

  </div>

  <!-- Sidebar — floating panel -->
  <aside class="w-80 shrink-0 my-3 mr-3 flex flex-col overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
    <div class="flex-1 px-6 pt-3 pb-6">

      <div class="mb-10">
        <h1 class="text-lg font-semibold mb-1">ENSAV Interactive Map</h1>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Mapping partnerships, projects, research, and mobility at
          l'École Nationale Supérieure d'Architecture de Versailles.
        </p>
      </div>

      <div class="mb-6 relative">
        <input
          type="search"
          placeholder={searchReady ? 'Search across all datasets…' : 'Loading…'}
          disabled={!searchReady}
          value={query}
          oninput={onInput}
          class="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:placeholder-gray-500 dark:focus:border-gray-500 disabled:opacity-50 {query ? 'pr-9' : ''}"
        />
        {#if query}
          <button
            type="button"
            aria-label="Clear search"
            onclick={() => { query = ''; searchGroups = []; clearTimeout(debounceTimer) }}
            class="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors flex items-center justify-center"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
              <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" class="text-gray-500 dark:text-gray-300"/>
            </svg>
          </button>
        {/if}
      </div>

      {#if query.trim() !== ''}
        <div class="mb-6">
          {#if query.trim().length < 2}
            <p class="text-sm text-gray-400 dark:text-gray-500">Type at least 2 characters…</p>
          {:else if searchGroups.length === 0}
            <p class="text-sm text-gray-400 dark:text-gray-500">No results for "{query}"</p>
          {:else}
            <div class="space-y-5">
              {#each searchGroups as group}
                <div>
                  <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1 px-1">{group.label}</div>
                  <div>
                    {#each group.results as result}
                      <button
                        type="button"
                        onclick={() => openItems(result.items, `${result.value} · ${group.label}`)}
                        class="w-full text-left px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-baseline justify-between gap-3"
                      >
                        <span class="text-sm text-gray-800 dark:text-gray-200 truncate">{result.value}</span>
                        <span class="text-xs text-gray-400 dark:text-gray-500 shrink-0">{result.count} {result.count === 1 ? 'record' : 'records'}</span>
                      </button>
                    {/each}
                    {#if group.truncated > 0}
                      <p class="px-3 py-1 text-xs text-gray-400 dark:text-gray-500">+{group.truncated} more</p>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
        {@const partenariatDs = datasets.filter(d => d.kind === 'partenariat')}
        {@const travauxDs = datasets.filter(d => d.kind === 'travaux')}

        <!-- Partenariats group -->
        <div class="mb-4">
          <button
            type="button"
            onclick={() => { openGroups.partenariats = !openGroups.partenariats }}
            class="w-full flex items-center justify-between mb-2 pr-3"
          >
            <div class="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 text-gray-400 transition-transform duration-200 shrink-0 {openGroups.partenariats ? '' : '-rotate-90'}">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Partenariats</span>
            </div>
            <span
              role="button"
              tabindex="0"
              onclick={(e) => { e.stopPropagation(); toggleGroup(partenariatDs.map(d => d.key)) }}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleGroup(partenariatDs.map(d => d.key)) } }}
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="{isGroupAllHidden(partenariatDs.map(d => d.key)) ? 'Show' : 'Hide'} all partenariats"
            >
              {#if isGroupAllHidden(partenariatDs.map(d => d.key))}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              {/if}
            </span>
          </button>
          {#if openGroups.partenariats}
            <div class="grid grid-cols-1 gap-3">
              {#each partenariatDs as ds}
                <DatasetFilterCard
                  {ds}
                  isHidden={hiddenDatasets.has(ds.key)}
                  isUpdated={isUpdatedSince(ds.error ? null : ds.lastUpdated)}
                  onToggle={() => toggleDataset(ds.key)}
                />
              {/each}
            </div>
          {/if}
        </div>

        <!-- Travaux group -->
        <div>
          <button
            type="button"
            onclick={() => { openGroups.travaux = !openGroups.travaux }}
            class="w-full flex items-center justify-between mb-2 pr-3"
          >
            <div class="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 text-gray-400 transition-transform duration-200 shrink-0 {openGroups.travaux ? '' : '-rotate-90'}">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Travaux</span>
            </div>
            <span
              role="button"
              tabindex="0"
              onclick={(e) => { e.stopPropagation(); toggleGroup(travauxDs.map(d => d.key)) }}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleGroup(travauxDs.map(d => d.key)) } }}
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="{isGroupAllHidden(travauxDs.map(d => d.key)) ? 'Show' : 'Hide'} all travaux"
            >
              {#if isGroupAllHidden(travauxDs.map(d => d.key))}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              {/if}
            </span>
          </button>
          {#if openGroups.travaux}
            <div class="grid grid-cols-1 gap-3">
              {#each travauxDs as ds}
                <DatasetFilterCard
                  {ds}
                  isHidden={hiddenDatasets.has(ds.key)}
                  isUpdated={isUpdatedSince(ds.error ? null : ds.lastUpdated)}
                  onToggle={() => toggleDataset(ds.key)}
                />
              {/each}
            </div>
          {/if}
        </div>

        {#if !data.sourceError}
          {@const total = datasets.reduce((sum, ds) => sum + (('count' in ds) ? ds.count : 0), 0)}
          <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-baseline">
            <span class="text-xs text-gray-400 dark:text-gray-500">Total in NocoDB</span>
            <span class="text-sm font-semibold tabular-nums text-gray-600 dark:text-gray-400">{total} records</span>
          </div>
        {/if}
      {/if}

    </div>

    <footer class="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
      <p class="text-xs text-gray-400 dark:text-gray-500">Studio Folder, 2026</p>
      <div class="flex items-center gap-2 text-gray-400 dark:text-gray-500">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
        </svg>
        <button
          type="button"
          onclick={toggleTheme}
          aria-label="Toggle dark mode"
          class="relative inline-flex items-center w-8 h-4 rounded-full bg-gray-200 dark:bg-gray-700 transition-colors"
        >
          <span
            class="absolute left-0.5 w-3 h-3 rounded-full bg-white dark:bg-gray-900 shadow transform transition-transform duration-200"
            class:translate-x-4={theme === 'dark'}
          ></span>
        </button>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </div>
    </footer>
  </aside>

</div>

