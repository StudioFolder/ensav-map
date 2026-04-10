<script lang="ts">
  import type { TimelineRecord } from '$lib/data/types'
  import type { SearchItem, Dataset } from '$lib/search/index'
  import { DATASET_LABELS, TIMELINE_DATASET_KEYS } from '$lib/config/datasets'

  const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

  let {
    records,
    hiddenDatasets,
    onselect,
  }: {
    records: TimelineRecord[]
    hiddenDatasets: Set<string>
    onselect: (items: SearchItem[], label?: string) => void
  } = $props()

  const DOT = 8
  const D = 9            // minimum center-to-center distance
  const D2 = D * D
  const PADDING = 40     // horizontal padding each side
  const AXIS_GAP = 14      // gap between blob base and axis line
  const TICK_SIZE = 4      // height of year boundary ticks below the axis
  const MONTH_GAP = 4      // gap between axis and month initials
  const MONTH_HEIGHT = 9   // height of month initial text
  const YEAR_GAP = 4       // gap between month row and year label
  const YEAR_HEIGHT = 10   // height of year label text
  const MONTH_INITIALS = ['J','F','M','A','M','J','J','A','S','O','N','D']

  let containerWidth = $state(0)

  // All records sorted by dateValue (x position)
  const sortedRecords = $derived(
    [...records].sort((a, b) => a.dateValue - b.dateValue)
  )

  // Axis spans from the start of the earliest year to the end of the latest
  // (accounting for span end dates, which may extend beyond the last start date)
  const minDate = $derived(
    sortedRecords.length > 0 ? Math.floor(sortedRecords[0].dateValue) : 2000
  )
  const maxDate = $derived.by(() => {
    if (sortedRecords.length === 0) return 2025
    let max = sortedRecords[sortedRecords.length - 1].dateValue
    for (const r of sortedRecords) if (r.endDateValue !== undefined) max = Math.max(max, r.endDateValue)
    return Math.floor(max) + 1
  })

  const svgWidth = $derived(Math.max(0, containerWidth - 2 * PADDING))

  function dateToX(dv: number): number {
    return (dv - minDate) / (maxDate - minDate) * svgWidth
  }

  /**
   * Tetris beeswarm: records are processed dataset by dataset in TIMELINE_DATASET_KEYS order,
   * sorted by dateValue within each dataset. Earlier datasets claim the lowest y
   * positions first; later datasets fill the remaining gaps and stack on top.
   * This gives a gravity effect where each dataset's items settle as low as possible
   * given what is already placed beneath them.
   */
  const placedItems = $derived.by(() => {
    if (svgWidth <= 0 || sortedRecords.length === 0) return []

    // Process in dataset order, then by dateValue within each dataset
    const ordered = TIMELINE_DATASET_KEYS.flatMap(key =>
      sortedRecords.filter(r => r.dataset === key)
    )

    const placed: Array<{ x: number; x2: number | undefined; y: number; rec: TimelineRecord }> = []

    for (const rec of ordered) {
      const x = dateToX(rec.dateValue)
      const x2 = rec.endDateValue !== undefined ? dateToX(rec.endDateValue) : undefined

      // Minimum horizontal distance between two items' full extents (0 when they overlap)
      const hdx = (p: { x: number; x2: number | undefined }) =>
        Math.max(0, x - (p.x2 ?? p.x), p.x - (x2 ?? x))

      const nearby = placed.filter(p => hdx(p) < D)

      if (nearby.length === 0) {
        placed.push({ x, x2, y: 0, rec })
        continue
      }

      const yLevels = new Set<number>([0])
      for (const p of nearby) {
        const dx = hdx(p)
        if (dx < D) yLevels.add(p.y + Math.sqrt(D2 - dx * dx))
      }

      const bestY = [...yLevels]
        .filter(y => y >= 0)
        .sort((a, b) => a - b)
        .find(y => nearby.every(p => {
          const dx = hdx(p)
          const dy = y - p.y
          return dx * dx + dy * dy >= D2 - 0.001
        }))
        ?? nearby.length * D

      placed.push({ x, x2, y: bestY, rec })
    }

    return placed
  })

  const maxDotY = $derived(placedItems.reduce((m, p) => Math.max(m, p.y), 0))
  const dotAreaHeight = $derived(maxDotY + DOT)
  const axisY = $derived(dotAreaHeight + AXIS_GAP)
  const svgHeight = $derived(axisY + MONTH_GAP + MONTH_HEIGHT + YEAR_GAP + YEAR_HEIGHT + 4)

  // SVG rect top for a dot whose swarm y is swarmY
  function rectY(swarmY: number): number {
    return axisY - DOT - swarmY
  }

  // Per-year axis: month initials + year label, only when pixels are wide enough
  const axisYears = $derived.by(() => {
    const years: number[] = []
    for (let y = minDate; y < maxDate; y++) years.push(y)
    return years
  })

  const pixPerMonth = $derived(svgWidth / ((maxDate - minDate) * 12))
  // Show month initials only when there's at least 6px per month
  const showMonths = $derived(pixPerMonth >= 6)

  function dateLabel(rec: TimelineRecord): string {
    const startLabel = rec.month ? `${MONTHS_FR[rec.month - 1]} ${rec.year}` : String(rec.year)
    if (rec.endDateValue !== undefined) {
      const endLabel = rec.endMonth ? `${MONTHS_FR[rec.endMonth - 1]} ${rec.endYear}` : String(rec.endYear)
      return `${startLabel} → ${endLabel}`
    }
    return startLabel
  }

  function datasetLabel(key: string): string {
    return DATASET_LABELS[key as keyof typeof DATASET_LABELS] ?? key
  }

  let tooltip: { x: number; y: number; rec: TimelineRecord } | null = $state(null)

  function showTooltip(e: MouseEvent, rec: TimelineRecord) {
    tooltip = { x: e.clientX, y: e.clientY, rec }
  }
  function hideTooltip() { tooltip = null }

  function handleClick(rec: TimelineRecord) {
    onselect([{
      id: `${rec.dataset}|${rec.record['Id']}`,
      dataset: rec.dataset as Dataset,
      label: rec.label,
      searchableText: rec.label,
      record: rec.record,
    }])
  }
</script>

<style>
  /* Mémoires — neutral */
  .dot-memoires { fill: rgb(0 0 0 / 0.3); cursor: pointer; transition: fill 100ms; }
  .dot-memoires:hover { fill: rgb(0 0 0 / 0.75); }
  :global(.dark) .dot-memoires { fill: rgb(255 255 255 / 0.5); }
  :global(.dark) .dot-memoires:hover { fill: rgb(255 255 255 / 0.9); }

  /* PFE — blue */
  .dot-pfe { fill: rgb(59 130 246 / 0.6); cursor: pointer; transition: fill 100ms; }
  .dot-pfe:hover { fill: rgb(59 130 246 / 0.95); }
  :global(.dark) .dot-pfe { fill: rgb(96 165 250 / 0.65); }
  :global(.dark) .dot-pfe:hover { fill: rgb(96 165 250 / 1); }

  /* PFE France — orange */
  .dot-pfe_france { fill: rgb(249 115 22 / 0.6); cursor: pointer; transition: fill 100ms; }
  .dot-pfe_france:hover { fill: rgb(249 115 22 / 0.95); }
  :global(.dark) .dot-pfe_france { fill: rgb(251 146 60 / 0.65); }
  :global(.dark) .dot-pfe_france:hover { fill: rgb(251 146 60 / 1); }

  /* P45 — green */
  .dot-p45 { fill: rgb(22 163 74 / 0.6); cursor: pointer; transition: fill 100ms; }
  .dot-p45:hover { fill: rgb(22 163 74 / 0.95); }
  :global(.dark) .dot-p45 { fill: rgb(74 222 128 / 0.65); }
  :global(.dark) .dot-p45:hover { fill: rgb(74 222 128 / 1); }

  /* Thèses — purple */
  .dot-theses { fill: rgb(147 51 234 / 0.6); cursor: pointer; transition: fill 100ms; }
  .dot-theses:hover { fill: rgb(147 51 234 / 0.95); }
  :global(.dark) .dot-theses { fill: rgb(192 132 252 / 0.65); }
  :global(.dark) .dot-theses:hover { fill: rgb(192 132 252 / 1); }

  .axis-line { stroke: rgb(0 0 0 / 0.15); }
  :global(.dark) .axis-line { stroke: rgb(255 255 255 / 0.15); }

  .tick-line { stroke: rgb(0 0 0 / 0.15); }
  :global(.dark) .tick-line { stroke: rgb(255 255 255 / 0.15); }

  .month-label { fill: rgb(0 0 0 / 0.25); font-size: 8px; }
  :global(.dark) .month-label { fill: rgb(255 255 255 / 0.25); }
  .month-label-jan { fill: rgb(0 0 0 / 0.45); }
  :global(.dark) .month-label-jan { fill: rgb(255 255 255 / 0.45); }

  .year-label { fill: rgb(0 0 0 / 0.45); font-size: 9px; font-weight: 500; }
  :global(.dark) .year-label { fill: rgb(255 255 255 / 0.45); }

  /* Legend dots */
  .legend-memoires   { background: rgb(0 0 0 / 0.3); }
  :global(.dark) .legend-memoires   { background: rgb(255 255 255 / 0.5); }
  .legend-pfe        { background: rgb(59 130 246 / 0.6); }
  :global(.dark) .legend-pfe        { background: rgb(96 165 250 / 0.65); }
  .legend-pfe_france { background: rgb(249 115 22 / 0.6); }
  :global(.dark) .legend-pfe_france { background: rgb(251 146 60 / 0.65); }
  .legend-p45        { background: rgb(22 163 74 / 0.6); }
  :global(.dark) .legend-p45        { background: rgb(74 222 128 / 0.65); }
  .legend-theses     { background: rgb(147 51 234 / 0.6); }
  :global(.dark) .legend-theses     { background: rgb(192 132 252 / 0.65); }
</style>

<div class="absolute inset-0 overflow-auto" bind:clientWidth={containerWidth}>

  {#if placedItems.length > 0}
    <!-- Legend — top-centered, aligned with the mode switcher and counter -->
    <div class="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
      {#each TIMELINE_DATASET_KEYS as key}
        <div class="flex items-center gap-1.5">
          <span class="legend-{key} block shrink-0 w-2 h-2 rounded-full"></span>
          <span>{DATASET_LABELS[key]}</span>
        </div>
      {/each}
    </div>
  {/if}

  <div class="min-w-full min-h-full flex items-center justify-center py-12">
    {#if placedItems.length > 0 && svgWidth > 0}
      <svg
        width={svgWidth}
        height={svgHeight}
        style="overflow: visible; font-family: inherit; margin: 0 {PADDING}px;"
      >
        <!-- Axis line -->
        <line class="axis-line" x1={0} y1={axisY} x2={svgWidth} y2={axisY} stroke-width="1" />

        <!-- Year boundaries + month initials + year labels -->
        {#each axisYears as year}
          {@const yearX = dateToX(year)}
          <!-- Month initials -->
          {#if showMonths}
            {#each MONTH_INITIALS as initial, mi}
              {@const mx = dateToX(year + (mi + 0.5) / 12)}
              <text
                class="month-label{mi === 0 ? ' month-label-jan' : ''}"
                x={mx}
                y={axisY + MONTH_GAP + MONTH_HEIGHT}
                text-anchor="middle"
                pointer-events="none"
                style="user-select: none;"
              >{initial}</text>
            {/each}
          {/if}
          <!-- Year label left-aligned with January -->
          <text
            class="year-label"
            x={dateToX(year + 0.5 / 12)}
            y={axisY + MONTH_GAP + MONTH_HEIGHT + YEAR_GAP + YEAR_HEIGHT}
            text-anchor="start"
            dx={-3}
            pointer-events="none"
            style="user-select: none;"
          >{year}</text>
        {/each}

        <!-- Dots and spans. Spans (with x2) render as pills; dots render as circles.
             Axis and beeswarm use all records so toggling datasets never moves the layout. -->
        {#each placedItems as { x, x2, y, rec }}
          {#if !hiddenDatasets.has(rec.dataset)}
            <rect
              class="dot-{rec.dataset}"
              x={x - DOT / 2}
              y={rectY(y)}
              width={x2 !== undefined ? x2 - x + DOT : DOT}
              height={DOT}
              rx={DOT / 2}
              aria-label={rec.label}
              role="button"
              tabindex="-1"
              onmouseenter={(e) => showTooltip(e, rec)}
              onmousemove={(e) => showTooltip(e, rec)}
              onmouseleave={hideTooltip}
              onclick={() => handleClick(rec)}
            />
          {/if}
        {/each}
      </svg>

    {:else}
      <p class="text-sm text-gray-400 dark:text-gray-500">No records with a date.</p>
    {/if}
  </div>

  {#if tooltip}
    <div
      class="fixed z-50 pointer-events-none bg-white/95 text-gray-900 dark:bg-gray-900/95 dark:text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-56 border border-black/10 dark:border-white/10"
      style="left: {tooltip.x + 14}px; top: {tooltip.y - 10}px"
    >
      <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
        {datasetLabel(tooltip.rec.dataset)} · {dateLabel(tooltip.rec)}
      </div>
      <div class="font-semibold leading-snug">{tooltip.rec.label}</div>
      {#if tooltip.rec.person}
        <div class="text-gray-700 dark:text-gray-300 mt-0.5">{tooltip.rec.person}</div>
      {/if}
    </div>
  {/if}
</div>
