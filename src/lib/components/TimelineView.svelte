<script lang="ts">
  import type { TimelineRecord } from '$lib/data/types'
  import type { SearchItem, Dataset } from '$lib/search/index'
  import { DATASET_LABELS, TIMELINE_DATASET_KEYS } from '$lib/config/datasets'
  import { flip } from 'svelte/animate'
  import { fade } from 'svelte/transition'

  const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

  let {
    records,
    hiddenDatasets,
    onselect,
    theme = 'light',
  }: {
    records: TimelineRecord[]
    hiddenDatasets: Set<string>
    onselect: (items: SearchItem[], label?: string) => void
    theme?: 'light' | 'dark'
  } = $props()

  const DOT = 8
  const D = 9            // row height in the swim-lane grid
  const PADDING = 40     // horizontal padding each side of the SVG
  const PILL_GAP = 2     // horizontal blank space between adjacent pills (px)
  const LEFT_MARGIN = 140  // space reserved at left for lane labels
  const LANE_GAP = 12    // vertical gap between swim lanes
  const AXIS_GAP = 14      // gap between blob base and axis line
  const TICK_SIZE = 4      // height of year boundary ticks below the axis
  const MONTH_GAP = 4      // gap between axis and month initials
  const MONTH_HEIGHT = 9   // height of month initial text
  const YEAR_GAP = 4       // gap between month row and year label
  const YEAR_HEIGHT = 10   // height of year label text
  const MONTH_INITIALS = ['J','F','M','A','M','J','J','A','S','O','N','D']

  // ---------------------------------------------------------------------------
  // Color palettes — base and hover per criterion, per theme
  // ---------------------------------------------------------------------------

  type ColorPair = { base: string; hover: string }
  type SchemePalette = { dataset: Record<string, ColorPair>; continent: Record<string, ColorPair> }

  const PALETTE: { light: SchemePalette; dark: SchemePalette } = {
    light: {
      dataset: {
        memoires:   { base: 'rgb(0 0 0 / 0.3)',      hover: 'rgb(0 0 0 / 0.75)' },
        pfe:        { base: 'rgb(59 130 246 / 0.6)',  hover: 'rgb(59 130 246 / 0.95)' },
        pfe_france: { base: 'rgb(249 115 22 / 0.6)',  hover: 'rgb(249 115 22 / 0.95)' },
        p45:        { base: 'rgb(22 163 74 / 0.6)',   hover: 'rgb(22 163 74 / 0.95)' },
        theses:     { base: 'rgb(147 51 234 / 0.6)',  hover: 'rgb(147 51 234 / 0.95)' },
        unknown:    { base: 'rgb(156 163 175 / 0.5)', hover: 'rgb(156 163 175 / 0.85)' },
      },
      continent: {
        'Afrique':          { base: 'rgb(234 179 8 / 0.7)',   hover: 'rgb(234 179 8 / 1)' },
        'Amérique du Nord': { base: 'rgb(20 184 166 / 0.7)',  hover: 'rgb(20 184 166 / 1)' },
        'Amérique du Sud':  { base: 'rgb(236 72 153 / 0.7)',  hover: 'rgb(236 72 153 / 1)' },
        'Antarctique':      { base: 'rgb(6 182 212 / 0.7)',   hover: 'rgb(6 182 212 / 1)' },
        'Arctique':         { base: 'rgb(14 165 233 / 0.7)',  hover: 'rgb(14 165 233 / 1)' },
        'Asie':             { base: 'rgb(239 68 68 / 0.7)',   hover: 'rgb(239 68 68 / 1)' },
        'Europe':           { base: 'rgb(99 102 241 / 0.7)',  hover: 'rgb(99 102 241 / 1)' },
        'Océanie':          { base: 'rgb(132 204 22 / 0.7)',  hover: 'rgb(132 204 22 / 1)' },
        'unknown':          { base: 'rgb(156 163 175 / 0.5)', hover: 'rgb(156 163 175 / 0.85)' },
      },
    },
    dark: {
      dataset: {
        memoires:   { base: 'rgb(255 255 255 / 0.5)',  hover: 'rgb(255 255 255 / 0.9)' },
        pfe:        { base: 'rgb(96 165 250 / 0.65)',  hover: 'rgb(96 165 250 / 1)' },
        pfe_france: { base: 'rgb(251 146 60 / 0.65)',  hover: 'rgb(251 146 60 / 1)' },
        p45:        { base: 'rgb(74 222 128 / 0.65)',  hover: 'rgb(74 222 128 / 1)' },
        theses:     { base: 'rgb(192 132 252 / 0.65)', hover: 'rgb(192 132 252 / 1)' },
        unknown:    { base: 'rgb(156 163 175 / 0.5)',  hover: 'rgb(156 163 175 / 0.85)' },
      },
      continent: {
        'Afrique':          { base: 'rgb(250 204 21 / 0.75)',  hover: 'rgb(250 204 21 / 1)' },
        'Amérique du Nord': { base: 'rgb(45 212 191 / 0.75)',  hover: 'rgb(45 212 191 / 1)' },
        'Amérique du Sud':  { base: 'rgb(244 114 182 / 0.75)', hover: 'rgb(244 114 182 / 1)' },
        'Antarctique':      { base: 'rgb(34 211 238 / 0.75)',  hover: 'rgb(34 211 238 / 1)' },
        'Arctique':         { base: 'rgb(56 189 248 / 0.75)',  hover: 'rgb(56 189 248 / 1)' },
        'Asie':             { base: 'rgb(248 113 113 / 0.75)', hover: 'rgb(248 113 113 / 1)' },
        'Europe':           { base: 'rgb(129 140 248 / 0.75)', hover: 'rgb(129 140 248 / 1)' },
        'Océanie':          { base: 'rgb(163 230 53 / 0.75)',  hover: 'rgb(163 230 53 / 1)' },
        'unknown':          { base: 'rgb(156 163 175 / 0.5)',  hover: 'rgb(156 163 175 / 0.85)' },
      },
    },
  }

  // ---------------------------------------------------------------------------
  // State and derived
  // ---------------------------------------------------------------------------

  let containerWidth = $state(0)
  let colorBy: 'dataset' | 'continent' = $state('dataset')
  let hovered: TimelineRecord | null = $state(null)

  // Legend-driven filters: clicking a legend entry toggles inclusion for that
  // category. Both sets always apply (regardless of active criterion) so
  // filters persist across Type ↔ Continent toggles.
  let hiddenDatasetsLegend = $state<Set<string>>(new Set())
  let hiddenContinentsLegend = $state<Set<string>>(new Set())

  function toggleDatasetLegend(key: string) {
    const next = new Set(hiddenDatasetsLegend)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    hiddenDatasetsLegend = next
  }
  function toggleContinentLegend(key: string) {
    const next = new Set(hiddenContinentsLegend)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    hiddenContinentsLegend = next
  }

  function isVisible(rec: TimelineRecord): boolean {
    if (hiddenDatasets.has(rec.dataset)) return false
    if (hiddenDatasetsLegend.has(rec.dataset)) return false
    const c = rec.continents?.[0] ?? 'unknown'
    if (hiddenContinentsLegend.has(c)) return false
    return true
  }

  const palette = $derived(theme === 'dark' ? PALETTE.dark : PALETTE.light)

  function fillFor(rec: TimelineRecord, isHovered: boolean): string {
    if (colorBy === 'dataset') {
      const entry = palette.dataset[rec.dataset] ?? palette.dataset['unknown']
      return isHovered ? entry.hover : entry.base
    } else {
      const key = rec.continents?.[0] ?? 'unknown'
      const entry = palette.continent[key] ?? palette.continent['unknown']
      return isHovered ? entry.hover : entry.base
    }
  }

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
  const timelineWidth = $derived(Math.max(0, svgWidth - LEFT_MARGIN))

  function dateToX(dv: number): number {
    return LEFT_MARGIN + (dv - minDate) / (maxDate - minDate) * timelineWidth
  }

  // Pill extent in pixels, derived from calendar fields rather than mid-month
  // dateValue. This keeps one-month pills aligned with their month column and
  // gives span pills the correct calendar extent (start-of-start-month →
  // start-of-(end-month + 1)). Dots (records with no endDate) keep their
  // mid-month point position; they are rendered as small circles.
  function pillExtent(rec: TimelineRecord): { x: number; x2: number | undefined } {
    if (rec.endDateValue !== undefined) {
      const sm = rec.month ?? 1
      const em = rec.endMonth ?? 12
      const ey = rec.endYear ?? rec.year
      return {
        x: dateToX(rec.year + (sm - 1) / 12),
        x2: dateToX(ey + em / 12),
      }
    }
    return { x: dateToX(rec.dateValue), x2: undefined }
  }

  /**
   * Swim-lane layout. One lane per category of the active criterion
   * (datasets for 'Type', continents for 'Continent'). Within each lane,
   * records are packed into rows by time order using the same
   * "lowest row that fits" rule as before — but the packing state is local
   * to the lane, so lanes don't contaminate each other.
   *
   * Lane order is stable (TIMELINE_DATASET_KEYS for Type, alphabetical for
   * Continent with 'unknown' last). Empty lanes keep a 1-row-tall slot so
   * the structure stays intact when filters empty them out.
   *
   * Layout depends on `isVisible` and `colorBy`, so both sidebar/legend
   * filtering and criterion switching re-pack and animate via animate:flip.
   */

  // Continents currently present across unfiltered records (used as lane
  // order when colorBy === 'continent'). Dataset-level filters prune the
  // list (a continent only contributed by a hidden dataset disappears); the
  // legend's own continent filter does NOT prune — deselected continents
  // keep their lane so the user can reselect.
  const presentContinentKeys = $derived.by(() => {
    const keys = new Set<string>()
    for (const rec of sortedRecords) {
      if (hiddenDatasets.has(rec.dataset)) continue
      if (hiddenDatasetsLegend.has(rec.dataset)) continue
      keys.add(rec.continents?.[0] ?? 'unknown')
    }
    const sorted = [...keys].filter(k => k !== 'unknown').sort()
    if (keys.has('unknown')) sorted.push('unknown')
    return sorted
  })

  // The lane a record belongs to under the active criterion
  function laneOf(rec: TimelineRecord): string {
    if (colorBy === 'dataset') return rec.dataset
    return rec.continents?.[0] ?? 'unknown'
  }

  const laneKeys = $derived.by<string[]>(() => {
    if (colorBy === 'dataset') return [...TIMELINE_DATASET_KEYS]
    return presentContinentKeys
  })

  function isLaneHidden(key: string): boolean {
    if (colorBy === 'dataset') return hiddenDatasetsLegend.has(key)
    return hiddenContinentsLegend.has(key)
  }

  function toggleLane(key: string) {
    if (colorBy === 'dataset') toggleDatasetLegend(key)
    else toggleContinentLegend(key)
  }

  function laneLabelFor(key: string): string {
    if (colorBy === 'dataset') return DATASET_LABELS[key as keyof typeof DATASET_LABELS] ?? key
    return continentLabel(key)
  }

  function laneColorFor(key: string): string {
    const sub = colorBy === 'dataset' ? palette.dataset : palette.continent
    return (sub[key] ?? sub['unknown']).base
  }

  const layout = $derived.by(() => {
    if (svgWidth <= 0) return { placed: [], lanes: [], totalHeight: 0 }

    const visible = sortedRecords.filter(isVisible)

    // Group visible records by lane
    const byLane = new Map<string, TimelineRecord[]>()
    for (const rec of visible) {
      const lane = laneOf(rec)
      if (!byLane.has(lane)) byLane.set(lane, [])
      byLane.get(lane)!.push(rec)
    }

    const placed: Array<{ x: number; x2: number | undefined; y: number; rec: TimelineRecord }> = []
    const lanes: Array<{ key: string; y: number; height: number }> = []

    let cumulativeY = 0
    for (const key of laneKeys) {
      const rows: Array<Array<{ left: number; right: number }>> = []
      const laneRecs = byLane.get(key) ?? []

      for (const rec of laneRecs) {
        const { x, x2 } = pillExtent(rec)
        const left = x2 !== undefined ? x : x - DOT / 2
        const right = x2 !== undefined ? x2 : x + DOT / 2

        let rowIdx = 0
        while (rowIdx < rows.length) {
          if (!rows[rowIdx].some(it => !(right <= it.left || left >= it.right))) break
          rowIdx++
        }
        if (rowIdx === rows.length) rows.push([])
        rows[rowIdx].push({ left, right })
        placed.push({ x, x2, y: cumulativeY + rowIdx * D, rec })
      }

      const rowsUsed = Math.max(rows.length, 1)  // empty lanes still take 1 row of space
      const height = rowsUsed * D
      lanes.push({ key, y: cumulativeY, height })
      cumulativeY += height + LANE_GAP
    }

    const totalHeight = Math.max(0, cumulativeY - LANE_GAP)
    return { placed, lanes, totalHeight }
  })

  const placedItems = $derived(layout.placed)
  const lanes = $derived(layout.lanes)
  const totalHeight = $derived(layout.totalHeight)

  const axisY = $derived(totalHeight + AXIS_GAP)
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
      if (startLabel === endLabel) return startLabel
      return `${startLabel} → ${endLabel}`
    }
    return startLabel
  }

  function datasetLabel(key: string): string {
    return DATASET_LABELS[key as keyof typeof DATASET_LABELS] ?? key
  }

  function continentLabel(key: string): string {
    return key === 'unknown' ? 'Unknown' : key
  }

  let tooltip: { x: number; y: number; rec: TimelineRecord } | null = $state(null)

  function showTooltip(e: MouseEvent, rec: TimelineRecord) {
    tooltip = { x: e.clientX, y: e.clientY, rec }
    hovered = rec
  }
  function hideTooltip() { tooltip = null; hovered = null }

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
  .dot { cursor: pointer; transition: fill 100ms, stroke-width 80ms; }

  .axis-line { stroke: rgb(0 0 0 / 0.15); }
  :global(.dark) .axis-line { stroke: rgb(255 255 255 / 0.15); }

  .month-label { fill: rgb(0 0 0 / 0.25); font-size: 8px; }
  :global(.dark) .month-label { fill: rgb(255 255 255 / 0.25); }
  .month-label-jan { fill: rgb(0 0 0 / 0.45); }
  :global(.dark) .month-label-jan { fill: rgb(255 255 255 / 0.45); }

  .year-label { fill: rgb(0 0 0 / 0.45); font-size: 9px; font-weight: 500; }
  :global(.dark) .year-label { fill: rgb(255 255 255 / 0.45); }

  .lane-label { fill: rgb(0 0 0 / 0.7); font-size: 10px; font-weight: 500; }
  :global(.dark) .lane-label { fill: rgb(255 255 255 / 0.7); }
</style>

<div class="absolute inset-0 overflow-auto" bind:clientWidth={containerWidth}>

  {#if records.length > 0}
    <!-- Criterion selector — matches PeopleView List/Network pill design -->
    <div class="absolute top-5 left-1/2 -translate-x-1/2 z-20 flex rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden text-[11px]">
      <button
        type="button"
        onclick={() => { colorBy = 'dataset' }}
        class="px-3 py-1 leading-none transition-colors {colorBy === 'dataset' ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}"
      >Type</button>
      <button
        type="button"
        onclick={() => { colorBy = 'continent' }}
        class="px-3 py-1 leading-none transition-colors {colorBy === 'continent' ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}"
      >Continent</button>
    </div>

  {/if}

  <div class="min-w-full min-h-full flex items-end justify-center py-12">
    {#if records.length > 0 && svgWidth > 0}
      <svg
        width={svgWidth}
        height={svgHeight}
        style="overflow: visible; font-family: inherit; margin: 0 {PADDING}px;"
      >
        <!-- Lane labels (left gutter) — click to toggle filter for that lane -->
        {#each lanes as lane (lane.key)}
          {@const cy = rectY(lane.y) + DOT / 2}
          <g
            style="cursor: pointer;"
            opacity={isLaneHidden(lane.key) ? 0.3 : 1}
            onclick={() => toggleLane(lane.key)}
          >
            <rect
              x={8}
              y={cy - 3}
              width={6}
              height={6}
              rx={1.5}
              fill={laneColorFor(lane.key)}
            />
            <text
              class="lane-label"
              x={20}
              y={cy + 3}
              text-anchor="start"
              style="user-select: none;"
            >{laneLabelFor(lane.key)}</text>
          </g>
        {/each}

        <!-- Main axis line (bottom). Month/year labels below anchor to this. -->
        <line class="axis-line" x1={LEFT_MARGIN} y1={axisY} x2={svgWidth} y2={axisY} stroke-width="1" />

        <!-- Per-lane baselines — each lane gets its own reference line so you
             can read dates within a lane without looking down to the main
             axis. Skipped for the bottom lane since the main axis covers it. -->
        {#each lanes as lane (lane.key)}
          {#if lane.y > 0}
            <line
              class="axis-line"
              x1={LEFT_MARGIN}
              x2={svgWidth}
              y1={axisY - lane.y}
              y2={axisY - lane.y}
              stroke-width="1"
            />
          {/if}
        {/each}

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

        <!-- Pills. placedItems is filter-aware; animate:flip smoothly moves
             items that stay in the list to their new position, and fade
             handles enter/exit for items crossing the filter boundary. -->
        {#each placedItems as { x, x2, y, rec } (rec)}
          <rect
            class="dot"
            x={x2 !== undefined ? x + PILL_GAP / 2 : x - DOT / 2}
            y={rectY(y)}
            width={x2 !== undefined ? Math.max(x2 - x - PILL_GAP, DOT) : DOT}
            height={DOT}
            rx={2}
            fill={fillFor(rec, false)}
            animate:flip={{ duration: 350 }}
            in:fade={{ duration: 200 }}
            out:fade={{ duration: 200 }}
            aria-label={rec.label}
            role="button"
            tabindex="-1"
            onmouseenter={(e) => showTooltip(e, rec)}
            onmousemove={(e) => showTooltip(e, rec)}
            onmouseleave={hideTooltip}
            onclick={() => handleClick(rec)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(rec) }}
          />
        {/each}

        <!-- Hover highlight. placedItems is filter-aware, so if a hidden item
             is somehow still in `hovered`, find() returns undefined and nothing
             renders. pointer-events:none so it doesn't steal mouse events. -->
        {#if hovered !== null}
          {@const ph = placedItems.find(p => p.rec === hovered)}
          {#if ph}
            <rect
              x={ph.x2 !== undefined ? ph.x + PILL_GAP / 2 : ph.x - DOT / 2}
              y={rectY(ph.y)}
              width={ph.x2 !== undefined ? Math.max(ph.x2 - ph.x - PILL_GAP, DOT) : DOT}
              height={DOT}
              rx={2}
              fill={fillFor(hovered, true)}
              stroke={theme === 'dark' ? 'rgb(255 255 255 / 0.95)' : 'rgb(0 0 0 / 0.9)'}
              stroke-width="1.5"
              pointer-events="none"
            />
          {/if}
        {/if}
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
      {#if colorBy === 'continent'}
        <div class="text-gray-500 dark:text-gray-400 mt-0.5">
          Continents: {tooltip.rec.continents?.length ? tooltip.rec.continents.join(', ') : 'Unknown'}
        </div>
      {/if}
    </div>
  {/if}
</div>
