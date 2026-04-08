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

  // Layout constants — must stay in sync with the Tailwind classes used for
  // dots below. 11 dots × 8px + 10 gaps × 4px = 128px = w-32, so each row
  // exactly fills the column width with no horizontal slack.
  const DOT = 8
  const GAP = 4
  const STRIDE = DOT + GAP // 12
  const DOTS_PER_ROW = 11
  const HEADER_HEIGHT = 14 // text-[10px] line-height with a hair of breathing
  const HEADER_GAP = 4     // space between a country header and its packet
  const COUNTRY_GAP = 12   // vertical gap between adjacent country blocks

  // ease-in-out for symmetric movement (expand and collapse feel the same),
  // ease-out-expo for opacity (snappier fade-in than the slide).
  const EASE_MOVE = 'cubic-bezier(0.65, 0, 0.35, 1)'
  const EASE_FADE = 'cubic-bezier(0.16, 1, 0.3, 1)'
  const DUR_MOVE = '450ms'
  const DUR_FADE = '280ms'

  type DotUnit = {
    key: string
    rec: ContinentRecord
    kind: 'p' | 't'
    countryEN: string // '' for the Unknown bucket
    primary: boolean  // first occurrence of the record in this column
  }
  type DotPos = { left: number; bottom: number; opacity: number }
  type HeaderPos = { country: string; bottom: number }
  type ColumnLayout = { height: number; dots: Map<string, DotPos>; headers: HeaderPos[] }
  type ColumnData = {
    group: ContinentGroup
    units: DotUnit[]
    packed: ColumnLayout
    grouped: ColumnLayout
  }

  // A ContinentRecord with N countries produces N dot units in the column.
  // The first one is `primary`; in packed view it gets a real grid position
  // and the duplicates sit on top of it at opacity 0. On hover the duplicates
  // animate out into their respective country packets. The unique-record
  // count under the column (group.count) is unaffected because it's based
  // on dedup'd record keys, not on units.
  function buildUnits(group: ContinentGroup): DotUnit[] {
    const units: DotUnit[] = []
    const pushFor = (rec: ContinentRecord, kind: 'p' | 't', baseKey: string) => {
      const list = rec.countriesEN.length > 0 ? rec.countriesEN : ['']
      list.forEach((c, i) => {
        units.push({
          key: `${baseKey}|${c || '_'}`,
          rec,
          kind,
          countryEN: c,
          primary: i === 0,
        })
      })
    }
    group.partenariatRecords.forEach((r, i) => pushFor(r, 'p', `p-${i}`))
    group.travauxRecords.forEach((r, i) => pushFor(r, 't', `t-${i}`))
    return units
  }

  // Packed (default) layout: only primaries occupy the grid; duplicates
  // inherit their primary's position with opacity 0 so they're "tucked
  // inside" the primary and animate outward when the column is hovered.
  function packedLayout(units: DotUnit[]): ColumnLayout {
    const dots = new Map<string, DotPos>()
    let primaryIndex = 0
    let lastPos: DotPos = { left: 0, bottom: 0, opacity: 1 }
    for (const u of units) {
      if (u.primary) {
        const row = Math.floor(primaryIndex / DOTS_PER_ROW)
        const col = primaryIndex % DOTS_PER_ROW
        lastPos = { left: col * STRIDE, bottom: row * STRIDE, opacity: 1 }
        primaryIndex++
        dots.set(u.key, lastPos)
      } else {
        // Duplicates of the immediately preceding primary — units are built
        // so that all units of the same record are consecutive.
        dots.set(u.key, { left: lastPos.left, bottom: lastPos.bottom, opacity: 0 })
      }
    }
    const rows = Math.ceil(primaryIndex / DOTS_PER_ROW)
    const height = rows > 0 ? rows * STRIDE - GAP : 0
    return { height, dots, headers: [] }
  }

  // Grouped (hover) layout: dots split by country, stacked bottom up.
  //
  // Bottom of the column: any dots that couldn't be attributed to a country
  // (records added to the continent only via the explicit Continent field
  // with no resolvable Country N). They sit unlabelled, blending into the
  // continent's "generic" base.
  //
  // Above that: known countries, biggest first (closest to the base), each
  // packet labelled with the country name BELOW its dots.
  function groupedLayout(units: DotUnit[]): ColumnLayout {
    const buckets = new Map<string, DotUnit[]>()
    for (const u of units) {
      const k = u.countryEN || ''
      if (!buckets.has(k)) buckets.set(k, [])
      buckets.get(k)!.push(u)
    }
    const unattributed = buckets.get('') ?? []
    const known = [...buckets.entries()]
      .filter(([k]) => k !== '')
      .sort((a, b) => b[1].length - a[1].length)

    const dots = new Map<string, DotPos>()
    const headers: HeaderPos[] = []
    let y = 0

    // Insertion order in each bucket already places partenariats first then
    // travaux, because buildUnits() iterates partenariats then travaux. So
    // partenariats sit at the base of every packet — matching the column-
    // level rule.

    // 1) Unattributed dots — no header, anchored at the very bottom.
    if (unattributed.length > 0) {
      const rows = Math.ceil(unattributed.length / DOTS_PER_ROW)
      const blockH = rows * STRIDE - GAP
      unattributed.forEach((u, i) => {
        const row = Math.floor(i / DOTS_PER_ROW)
        const col = i % DOTS_PER_ROW
        dots.set(u.key, { left: col * STRIDE, bottom: y + row * STRIDE, opacity: 1 })
      })
      y += blockH + COUNTRY_GAP
    }

    // 2) Known countries: label sits at the current y, dots stack above it.
    known.forEach(([country, list], idx) => {
      const rows = Math.ceil(list.length / DOTS_PER_ROW)
      const blockH = rows * STRIDE - GAP
      const labelBottom = y
      const dotsBottom = y + HEADER_HEIGHT + HEADER_GAP
      list.forEach((u, i) => {
        const row = Math.floor(i / DOTS_PER_ROW)
        const col = i % DOTS_PER_ROW
        dots.set(u.key, { left: col * STRIDE, bottom: dotsBottom + row * STRIDE, opacity: 1 })
      })
      headers.push({ country, bottom: labelBottom })
      y = dotsBottom + blockH + (idx < known.length - 1 ? COUNTRY_GAP : 0)
    })
    return { height: y, dots, headers }
  }

  const columns: ColumnData[] = $derived(
    continentGroups.map((group) => {
      const units = buildUnits(group)
      return {
        group,
        units,
        packed: packedLayout(units),
        grouped: groupedLayout(units),
      }
    })
  )

  let hovered: string | null = $state(null)

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

<!-- Outer uses items-end (rather than items-center) so that when a hovered
     column expands upward the bottom-anchored labels row stays put.
     Vertical padding is intentionally minimal (pt-4 pb-6) so the column
     anchor sits low in the viewport, leaving the maximum amount of room
     above for an expanded column to grow into without triggering scroll. -->
<div class="absolute inset-0 overflow-auto">
  <div class="min-w-full min-h-full flex items-end justify-center px-20 pt-4 pb-6">
    <div class="flex flex-col">
      <div class="flex flex-nowrap items-end gap-10">
        {#each columns as col (col.group.nameFR)}
          {@const isHovered = hovered === col.group.nameFR}
          {@const layout = isHovered ? col.grouped : col.packed}
          <div
            class="shrink-0 relative w-32"
            style="height: {layout.height}px; transition: height {DUR_MOVE} {EASE_MOVE};"
            role="group"
            aria-label={col.group.nameEN}
            onmouseenter={() => (hovered = col.group.nameFR)}
            onmouseleave={() => (hovered = null)}
          >
            {#each col.units as u (u.key)}
              {@const pos = layout.dots.get(u.key) ?? { left: 0, bottom: 0, opacity: 0 }}
              <span
                role="button"
                tabindex="-1"
                aria-label={u.rec.label}
                class="absolute block w-2 h-2 rounded-full cursor-pointer {u.kind === 'p' ? 'bg-black dark:bg-white' : 'bg-black/30 dark:bg-white/50'}"
                style="left: {pos.left}px; bottom: {pos.bottom}px; opacity: {pos.opacity}; transition: left {DUR_MOVE} {EASE_MOVE}, bottom {DUR_MOVE} {EASE_MOVE}, opacity {DUR_FADE} {EASE_FADE};"
                onmouseenter={(e) => showTooltip(e, u.rec)}
                onmousemove={(e) => showTooltip(e, u.rec)}
                onmouseleave={hideTooltip}
              ></span>
            {/each}
            <!-- Headers always rendered at their grouped-layout positions; just
                 toggled by opacity. They live outside the column's painted
                 height when packed, but at opacity 0 so they're invisible. -->
            {#each col.grouped.headers as h (h.country)}
              <div
                class="absolute left-0 right-0 text-[10px] leading-none font-medium text-gray-500 dark:text-white/50 pointer-events-none tabular-nums"
                style="bottom: {h.bottom}px; opacity: {isHovered ? 1 : 0}; transition: opacity {DUR_FADE} {EASE_FADE};"
              >
                {h.country}
              </div>
            {/each}
          </div>
        {/each}
      </div>
      <div class="flex flex-nowrap items-start gap-10 mt-3">
        {#each columns as col (col.group.nameFR)}
          <div class="shrink-0 w-32 text-xs text-gray-500 dark:text-white/40 tabular-nums">
            {col.group.nameEN} ({col.group.count})
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
