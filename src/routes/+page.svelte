<script lang="ts">
  import { onMount } from 'svelte'
  import type { PageData } from './$types'
  import { initSearch, search, type SearchGroup, type SearchItem, type Dataset } from '$lib/search/index'
  import { scramble } from '$lib/actions/scramble'
  import Globe from '$lib/components/Globe.svelte'
  import ContinentView from '$lib/components/ContinentView.svelte'
  import PeopleView from '$lib/components/PeopleView.svelte'

  let { data }: { data: PageData } = $props()

  const ORDER = [
    'partenariats_mobilites',
    'partenariats_hors_mobilites',
    'pfe',
    'pfe_france',
    'memoires',
    'p45',
    'theses',
  ]

  const DATASET_LABELS: Record<string, string> = {
    partenariats_mobilites: 'Partenariats — Mobilités',
    partenariats_hors_mobilites: 'Partenariats — Hors mobilités',
    pfe: 'PFE',
    pfe_france: 'PFE France 2025',
    memoires: 'Mémoires',
    p45: 'P45',
    theses: 'Thèses',
  }

  const SKIP_FIELDS = new Set(['Id', 'nc_order', 'CreatedAt', 'UpdatedAt'])

  const datasets = data.sourceError
    ? ORDER.map((key) => ({ key, label: DATASET_LABELS[key], error: true as const }))
    : ORDER
        .map((key) => data.datasets.find((d) => d.key === key))
        .filter((d): d is (typeof data.datasets)[number] => d !== undefined)
        .map((d) => ({ ...d, error: false as const }))

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

  let projectionType = $state<'orthographic' | 'naturalEarth' | 'continents' | 'people'>('orthographic')

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
  let searchGroups: SearchGroup[] = $state([])
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

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
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

  function onWindowKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeItem()
  }


  function recordEntries(record: Record<string, unknown>): [string, string][] {
    return Object.entries(record)
      .filter(([k, v]) => !SKIP_FIELDS.has(k) && !k.startsWith('nc_') && v != null && v !== '')
      .map(([k, v]) => [k, String(v)])
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="flex h-screen overflow-hidden bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-200">

  <!-- Globe — fills remaining horizontal space -->
  <div class="relative flex-1 min-w-0 {projectionType === 'naturalEarth' ? 'bg-[#e5e5e5] dark:bg-[#3a3a3a]' : projectionType === 'people' ? 'bg-gray-50 dark:bg-gray-900' : 'bg-gray-200 dark:bg-gray-950'}">
    {#if projectionType === 'continents'}
      <ContinentView continentGroups={visibleContinentGroups} />
    {:else if projectionType === 'people'}
      <PeopleView personGroups={visiblePersonGroups} onselect={openItems} />
    {:else}
      {#key `${projectionType}-${theme}-${[...hiddenDatasets].sort().join(',')}`}
        <Globe points={visibleGlobePoints} geoPoints={visibleGeoPoints} countryZones={visibleCountryZones} {projectionType} {theme} onselect={openItems} />
      {/key}
    {/if}

    {#if !data.sourceError && projectionType !== 'people'}
      {@const s = data.recordStats}
      <div class="absolute top-3 right-3 z-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-xs tabular-nums space-y-1.5">
        {#if projectionType === 'continents'}
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
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="absolute inset-0 z-50 flex items-center justify-center"
        onclick={(e) => { if (e.target === e.currentTarget) closeItem() }}
      >
        <div class="absolute inset-0 bg-black/40 dark:bg-black/60"></div>
        <div class="relative z-10 w-full max-w-xl bg-white dark:bg-gray-900 rounded-xl shadow-xl max-h-[85%] flex flex-col mx-8">
          <div class="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div>
              {#if selectedItems.length > 1 && selectedGroupLabel}
                <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">{selectedGroupLabel}</h2>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{selectedItems.length} projects</p>
              {:else}
                <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                  {DATASET_LABELS[selectedItems[0].dataset] ?? selectedItems[0].dataset}
                </p>
                <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">{selectedItems[0].label}</h2>
              {/if}
            </div>
            <button
              type="button"
              onclick={closeItem}
              class="ml-4 mt-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="overflow-y-auto">
            {#each selectedItems as item, i}
              {#if selectedItems.length > 1}
                <div class="px-6 pt-4 pb-2 {i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}">
                  <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
                    {DATASET_LABELS[item.dataset] ?? item.dataset}
                  </p>
                  <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">{item.label}</h3>
                </div>
              {/if}
              <div class="px-6 {selectedItems.length > 1 ? 'pb-4' : 'py-4'}">
                <dl class="space-y-2">
                  {#each recordEntries(item.record) as [key, value]}
                    <div class="grid grid-cols-[10rem_1fr] gap-3 text-sm">
                      <dt class="text-gray-400 dark:text-gray-500 pt-0.5 truncate">{key}</dt>
                      <dd class="text-gray-800 dark:text-gray-200 break-words">{value}</dd>
                    </div>
                  {/each}
                </dl>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

  </div>

  <!-- Sidebar — fixed width, scrollable -->
  <aside class="w-80 shrink-0 flex flex-col overflow-y-auto border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
    <div class="flex-1 px-6 pt-10 pb-6">

      <div class="mb-8">
        <h1 class="text-2xl font-bold mb-2">ENSAV Interactive Map</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Mapping partnerships, projects, research, and mobility at
          l'École Nationale Supérieure d'Architecture de Versailles.
        </p>
      </div>

      <div class="mb-6">
        <input
          type="search"
          placeholder={searchReady ? 'Search across all datasets…' : 'Loading…'}
          disabled={!searchReady}
          value={query}
          oninput={onInput}
          class="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:placeholder-gray-500 dark:focus:border-gray-500 disabled:opacity-50"
        />
      </div>

      {#if query.trim() !== ''}
        <div class="mb-6">
          {#if searchGroups.length === 0}
            <p class="text-sm text-gray-400 dark:text-gray-500">No results for "{query}"</p>
          {:else}
            <div class="space-y-5">
              {#each searchGroups as group}
                <div>
                  <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1 px-1">{group.label}</div>
                  <div>
                    {#each group.results as item}
                      <button
                        type="button"
                        onclick={() => openItem(item)}
                        class="w-full text-left px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-baseline gap-3 group"
                      >
                        <span class="text-sm text-gray-800 dark:text-gray-200 truncate">{item.label}</span>
                        {#if item.record['Student 1'] || item.record['Supervisor 1'] || item.record['City'] || item.record['City 1']}
                          <span class="text-xs text-gray-400 dark:text-gray-500 truncate shrink-0">
                            {[item.record['Student 1'], item.record['Supervisor 1'], item.record['City'] ?? item.record['City 1']].filter(Boolean).join(' · ')}
                          </span>
                        {/if}
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
        <div class="grid grid-cols-1 gap-3">
          {#each datasets as ds}
            {#if ds.error}
              <div class="p-4 bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg">
                <div class="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">{ds.label}</div>
                <div class="text-xs text-red-400 dark:text-red-500">Source not accessible</div>
              </div>
            {:else}
              {@const isHidden = hiddenDatasets.has(ds.key)}
              <div class="relative p-4 bg-white border border-gray-200 hover:border-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-500 rounded-lg transition-colors {isHidden ? 'opacity-50' : ''}">
                <a href={ds.href} class="block pr-6">
                  <div class="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">{ds.label}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">{ds.count} records</div>
                  {#if ds.lastUpdated}
                    <div class="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1.5">
                      {#if isUpdatedSince(ds.lastUpdated)}
                        <span class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                      {/if}
                      <span>updated {timeAgo(ds.lastUpdated)}</span>
                    </div>
                  {/if}
                </a>
                <button
                  type="button"
                  onclick={() => toggleDataset(ds.key)}
                  class="absolute top-5 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label="{isHidden ? 'Show' : 'Hide'} {ds.label} on map"
                >
                  {#if isHidden}
                    <!-- eye-off -->
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  {:else}
                    <!-- eye -->
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  {/if}
                </button>
              </div>
            {/if}
          {/each}
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

