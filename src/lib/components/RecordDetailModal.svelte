<script lang="ts">
  import type { SearchItem } from '$lib/search/index'
  import { DATASET_LABELS, NOCODB_INTERNAL_FIELDS } from '$lib/config/datasets'

  let {
    items,
    groupLabel,
    onclose
  }: {
    items: SearchItem[]
    groupLabel: string | undefined
    onclose: () => void
  } = $props()

  function recordEntries(record: Record<string, unknown>): [string, string][] {
    return Object.entries(record)
      .filter(([k, v]) => !NOCODB_INTERNAL_FIELDS.has(k) && !k.startsWith('nc_') && v != null && v !== '')
      .map(([k, v]) => [k, String(v)])
  }
</script>

<!-- R11: modal backdrop — click-outside-to-dismiss is intentional; keyboard dismiss (Escape) is
     handled by onWindowKeydown. role="none" satisfies a11y_no_static_element_interactions. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  role="none"
  class="fixed inset-0 z-50 flex items-center justify-center pr-[20.75rem]"
  onclick={(e) => { if (e.target === e.currentTarget) onclose() }}
>
  <div class="fixed inset-0 bg-black/40 dark:bg-black/60"></div>
  <div class="relative z-10 w-full max-w-xl bg-white dark:bg-gray-900 rounded-xl shadow-xl max-h-[85%] flex flex-col mx-8">
    <div class="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
      <div>
        {#if items.length > 1 && groupLabel}
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">{groupLabel}</h2>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{items.length} records</p>
        {:else}
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
            {DATASET_LABELS[items[0].dataset] ?? items[0].dataset}
          </p>
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">{items[0].label}</h2>
        {/if}
      </div>
      <button
        type="button"
        onclick={onclose}
        class="ml-4 mt-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
        aria-label="Close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="overflow-y-auto">
      {#each items as item, i}
        {#if items.length > 1}
          <div class="px-6 pt-4 pb-2 {i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}">
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
              {DATASET_LABELS[item.dataset] ?? item.dataset}
            </p>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">{item.label}</h3>
          </div>
        {/if}
        <div class="px-6 {items.length > 1 ? 'pb-4' : 'py-4'}">
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
