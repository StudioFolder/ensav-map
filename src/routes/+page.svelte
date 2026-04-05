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
  let lastVisit: Date | null = $state(null)

  onMount(() => {
    const stored = localStorage.getItem(LAST_VISIT_KEY)
    if (stored) lastVisit = new Date(stored)
    localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString())
  })

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

<main class="min-h-screen flex flex-col bg-gray-50 text-gray-800 p-8">
  <div class="max-w-4xl w-full mx-auto flex-1">

    <div class="mb-16 pt-16">
      <h1 class="text-4xl font-bold mb-4">ENSAV Interactive Map</h1>
      <p class="text-lg text-gray-500 max-w-md">
        Mapping partnerships, projects, research, and mobility at
        l'École Nationale Supérieure d'Architecture de Versailles.
      </p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {#each datasets as ds}
        <a
          href={ds.href}
          class="block p-5 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
        >
          <div class="flex items-center gap-2 mb-1">
            <div class="text-lg font-bold text-gray-800">{ds.label}</div>
            {#if isUpdatedSince(ds.lastUpdated)}
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
            {/if}
          </div>
          <div class="text-sm text-gray-500">{ds.count} entries</div>
          {#if ds.lastUpdated}
            <div class="text-xs text-gray-400 mt-1">updated {timeAgo(ds.lastUpdated)}</div>
          {/if}
        </a>
      {/each}
    </div>

  </div>

  <footer class="max-w-4xl w-full mx-auto pt-16">
    <p class="text-sm text-gray-400">Project scaffold — Studio Folder, 2026</p>
  </footer>
</main>
