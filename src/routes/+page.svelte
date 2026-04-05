<script lang="ts">
  import { onMount } from 'svelte'
  import type { PageData } from './$types'

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

  const datasets = ORDER
    .map((key) => data.datasets.find((d) => d.key === key))
    .filter((d): d is (typeof data.datasets)[number] => d !== undefined)

  const LAST_VISIT_KEY = 'ensav_last_visit'
  const THEME_KEY = 'ensav_theme'
  let lastVisit: Date | null = $state(null)
  let theme: 'dark' | 'light' = $state('light')

  onMount(() => {
    const stored = localStorage.getItem(LAST_VISIT_KEY)
    if (stored) lastVisit = new Date(stored)
    localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString())
    theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  })

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
</script>

<main class="min-h-screen flex flex-col bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-200 p-8">
  <div class="max-w-4xl w-full mx-auto flex-1">

    <div class="mb-16 pt-16">
      <h1 class="text-4xl font-bold mb-4">ENSAV Interactive Map</h1>
      <p class="text-lg text-gray-500 dark:text-gray-400 max-w-md">
        Mapping partnerships, projects, research, and mobility at
        l'École Nationale Supérieure d'Architecture de Versailles.
      </p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {#each datasets as ds}
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
      {/each}
    </div>

  </div>

  <footer class="max-w-4xl w-full mx-auto pt-16 flex items-center justify-between">
    <p class="text-sm text-gray-400 dark:text-gray-500">Project scaffold — Studio Folder, 2026</p>
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
