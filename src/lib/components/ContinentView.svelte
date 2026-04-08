<script lang="ts">
  import type { ContinentGroup, ContinentRecord } from '$lib/data/types'

  let { continentGroups }: { continentGroups: ContinentGroup[] } = $props()

  // Mirrors the label map in +page.svelte / Globe — kept in sync manually
  const DATASET_LABELS: Record<string, string> = {
    partenariats_mobilites: 'Partenariats — Mobilités',
    partenariats_hors_mobilites: 'Partenariats — Hors mobilités',
    pfe: 'PFE',
    pfe_france: 'PFE France 2025',
    memoires: 'Mémoires',
    p45: 'P45',
    theses: 'Thèses',
  }

  let tooltip: { x: number; y: number; rec: ContinentRecord } | null = $state(null)

  function showTooltip(e: MouseEvent, rec: ContinentRecord) {
    tooltip = { x: e.clientX, y: e.clientY, rec }
  }

  function hideTooltip() {
    tooltip = null
  }

  // Pick a compact secondary line for the tooltip: student name for travaux,
  // programme for partenariats (partenariat records have `person: ''`).
  function secondaryLine(rec: ContinentRecord): string {
    if (rec.person) return rec.person
    const prog = rec.record['Programme']
    return typeof prog === 'string' ? prog : ''
  }

  // Location line: prefer the single-field layout used by partenariats,
  // fall back to the numbered fields used by travaux.
  function locationLine(rec: ContinentRecord): string {
    const r = rec.record
    const city = (r['City'] ?? r['City 1']) as string | undefined
    const country = (r['Country'] ?? r['Country 1']) as string | undefined
    return [city, country].filter(Boolean).join(', ')
  }
</script>

<div class="absolute inset-0 overflow-auto">
  <div class="min-w-full min-h-full flex items-center justify-center p-20">
    <div class="flex flex-col">
      <div class="flex flex-nowrap items-end gap-10">
        {#each continentGroups as group (group.nameFR)}
          <div class="shrink-0 w-32 flex flex-wrap-reverse gap-[4px]">
            <!-- Partenariat dots sit at the base of the column (flex-wrap-reverse
                 renders first items bottom-left). They're emphasized with solid
                 black in light mode / solid white in dark mode. -->
            {#each group.partenariatRecords as rec, i (`p-${i}`)}
              <span
                role="button"
                tabindex="-1"
                aria-label={rec.label}
                class="block w-2 h-2 rounded-full bg-black dark:bg-white cursor-pointer"
                onmouseenter={(e) => showTooltip(e, rec)}
                onmousemove={(e) => showTooltip(e, rec)}
                onmouseleave={hideTooltip}
              ></span>
            {/each}
            {#each group.travauxRecords as rec, i (`t-${i}`)}
              <span
                role="button"
                tabindex="-1"
                aria-label={rec.label}
                class="block w-2 h-2 rounded-full bg-black/30 dark:bg-white/50 cursor-pointer"
                onmouseenter={(e) => showTooltip(e, rec)}
                onmousemove={(e) => showTooltip(e, rec)}
                onmouseleave={hideTooltip}
              ></span>
            {/each}
          </div>
        {/each}
      </div>
      <div class="flex flex-nowrap items-start gap-10 mt-3">
        {#each continentGroups as group (group.nameFR)}
          <div class="shrink-0 w-32 text-xs text-gray-500 dark:text-white/40 tabular-nums">
            {group.nameEN} ({group.count})
          </div>
        {/each}
      </div>
    </div>
  </div>

  {#if tooltip}
    {@const secondary = secondaryLine(tooltip.rec)}
    {@const loc = locationLine(tooltip.rec)}
    <div
      class="fixed z-50 pointer-events-none bg-white/95 text-gray-900 dark:bg-gray-900/95 dark:text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-56 border border-black/10 dark:border-white/10"
      style="left: {tooltip.x + 14}px; top: {tooltip.y - 10}px"
    >
      <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
        {DATASET_LABELS[tooltip.rec.dataset] ?? tooltip.rec.dataset}
      </div>
      <div class="font-semibold leading-snug">{tooltip.rec.label}</div>
      {#if secondary}
        <div class="text-gray-700 dark:text-gray-300 mt-0.5">{secondary}</div>
      {/if}
      {#if loc}
        <div class="text-gray-500 dark:text-gray-400 mt-0.5">{loc}</div>
      {/if}
    </div>
  {/if}
</div>
