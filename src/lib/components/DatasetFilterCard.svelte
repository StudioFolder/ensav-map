<script lang="ts">
  let {
    ds,
    isHidden,
    isUpdated,
    onToggle
  }: {
    ds: { key: string; label: string; error: true; kind: string }
      | { key: string; label: string; error: false; count: number; href: string; lastUpdated: string | null; nocodbUrl: string; kind: string }
    isHidden: boolean
    isUpdated: boolean
    onToggle: () => void
  } = $props()

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

{#if ds.error}
  <div class="p-4 bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg">
    <div class="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">{ds.label}</div>
    <div class="text-xs text-red-400 dark:text-red-500">Source not accessible</div>
  </div>
{:else}
  <div class="relative p-4 bg-white border border-gray-200 hover:border-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-500 rounded-lg transition-colors {isHidden ? 'opacity-50' : ''}">
    <a href={ds.href} class="block pr-6">
      <div class="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">{ds.label}</div>
      <div class="text-xs text-gray-500 dark:text-gray-400">{ds.count} records</div>
      {#if ds.lastUpdated}
        <div class="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1.5">
          {#if isUpdated}
            <span class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
          {/if}
          <span>updated {timeAgo(ds.lastUpdated)}</span>
        </div>
      {/if}
    </a>
    <div class="absolute top-5 right-3 flex flex-col items-center gap-2">
      <button
        type="button"
        onclick={onToggle}
        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
      <a
        href={ds.nocodbUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Open {ds.label} in NocoDB"
      >
        <!-- edit / pencil -->
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </a>
    </div>
  </div>
{/if}
