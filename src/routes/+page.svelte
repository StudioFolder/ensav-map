<script lang="ts">
  import { onMount } from 'svelte'
  import type { PageData } from './$types'
  import { initSearch, search, type SearchGroup, type SearchItem } from '$lib/search/index'

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
    ? ORDER.map((key) => ({ key, label: DATASET_LABELS[key], error: true }))
    : ORDER
        .map((key) => data.datasets.find((d) => d.key === key))
        .filter((d): d is (typeof data.datasets)[number] => d !== undefined)
        .map((d) => ({ ...d, error: false }))

  const LAST_VISIT_KEY = 'ensav_last_visit'
  const THEME_KEY = 'ensav_theme'
  let lastVisit: Date | null = $state(null)
  let theme: 'dark' | 'light' = $state('light')

  let query = $state('')
  let searchReady = $state(false)
  let searchGroups: SearchGroup[] = $state([])
  let debounceTimer: ReturnType<typeof setTimeout>
  let selectedItem: SearchItem | null = $state(null)

  onMount(async () => {
    const stored = localStorage.getItem(LAST_VISIT_KEY)
    if (stored) lastVisit = new Date(stored)
    localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString())
    theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'

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
    selectedItem = item
  }

  function closeItem() {
    selectedItem = null
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

<main class="min-h-screen flex flex-col bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-200 p-8">
  <div class="max-w-4xl w-full mx-auto flex-1">

    <div class="mb-16 pt-16">
      <h1 class="text-4xl font-bold mb-4">ENSAV Interactive Map</h1>
      <p class="text-lg text-gray-500 dark:text-gray-400 max-w-md">
        Mapping partnerships, projects, research, and mobility at
        l'École Nationale Supérieure d'Architecture de Versailles.
      </p>
    </div>

    <div class="mb-8">
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
      <div class="mb-12">
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
    {/if}

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {#each datasets as ds}
        {#if ds.error}
          <div class="p-5 bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg">
            <div class="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">{ds.label}</div>
            <div class="text-sm text-red-400 dark:text-red-500">Source not accessible</div>
          </div>
        {:else}
          <a
            href={ds.href}
            class="block p-5 bg-white border border-gray-200 hover:border-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-500 rounded-lg transition-colors"
          >
            <div class="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">{ds.label}</div>
            <div class="text-sm text-gray-500 dark:text-gray-400">{ds.count} entries</div>
            {#if ds.lastUpdated}
              <div class="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1.5">
                {#if isUpdatedSince(ds.lastUpdated)}
                  <span class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                {/if}
                <span>updated {timeAgo(ds.lastUpdated)}</span>
              </div>
            {/if}
          </a>
        {/if}
      {/each}
    </div>

  </div>

  <footer class="max-w-4xl w-full mx-auto pt-16 flex items-center justify-between">
    <p class="text-sm text-gray-400 dark:text-gray-500">Studio Folder, 2026</p>
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
</main>

{#if selectedItem}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    onclick={(e) => { if (e.target === e.currentTarget) closeItem() }}
  >
    <div class="absolute inset-0 bg-black/40 dark:bg-black/60"></div>
    <div class="relative z-10 w-full sm:max-w-xl bg-white dark:bg-gray-900 sm:rounded-xl shadow-xl max-h-[85vh] flex flex-col">
      <div class="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
            {DATASET_LABELS[selectedItem.dataset] ?? selectedItem.dataset}
          </p>
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">{selectedItem.label}</h2>
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
      <div class="overflow-y-auto px-6 py-4">
        <dl class="space-y-2">
          {#each recordEntries(selectedItem.record) as [key, value]}
            <div class="grid grid-cols-[10rem_1fr] gap-3 text-sm">
              <dt class="text-gray-400 dark:text-gray-500 pt-0.5 truncate">{key}</dt>
              <dd class="text-gray-800 dark:text-gray-200 break-words">{value}</dd>
            </div>
          {/each}
        </dl>
      </div>
    </div>
  </div>
{/if}
