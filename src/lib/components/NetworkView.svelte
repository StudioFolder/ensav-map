<script lang="ts">
  import type { PersonGroup } from '$lib/data/types'
  import type { SearchItem, Dataset } from '$lib/search/index'
  import * as d3 from 'd3'

  let { personGroups, onselect, onvisiblechange }: {
    personGroups: PersonGroup[]
    onselect: (items: SearchItem[], groupLabel?: string) => void
    onvisiblechange?: (people: number, works: number) => void
  } = $props()

  // ── year filter ───────────────────────────────────────────────────────────

  function extractYear(r: PersonGroup['records'][number]): number | null {
    const pub = r.record['Publication year']
    if (pub) { const y = parseInt(String(pub)); return isNaN(y) ? null : y }
    const start = r.record['Start date']
    if (start) { const y = parseInt(String(start).slice(0, 4)); return isNaN(y) ? null : y }
    const end = r.record['End date']
    if (end) { const y = parseInt(String(end).slice(0, 4)); return isNaN(y) ? null : y }
    return null
  }

  const availableYears = $derived.by(() => {
    const years = new Set<number>()
    for (const pg of personGroups) {
      for (const r of pg.records) { const y = extractYear(r); if (y) years.add(y) }
    }
    return [...years].sort((a, b) => b - a)
  })

  let selectedYear = $state<number | null>(null)

  const filteredGroups = $derived.by(() => {
    if (!selectedYear) return personGroups
    return personGroups
      .map(pg => ({ ...pg, records: pg.records.filter(r => extractYear(r) === selectedYear) }))
      .filter(pg => pg.records.length > 0)
  })

  // ── graph derivation ──────────────────────────────────────────────────────

  const connectionMap = $derived.by(() => {
    const byRecord = new Map<string, string[]>()
    for (const person of filteredGroups) {
      for (const r of person.records) {
        const key = `${r.dataset}|${String(r.record['Id'] ?? r.title)}`
        if (!byRecord.has(key)) byRecord.set(key, [])
        byRecord.get(key)!.push(person.name)
      }
    }
    const graph = new Map<string, Set<string>>()
    for (const names of byRecord.values()) {
      if (names.length < 2) continue
      for (const n of names) {
        if (!graph.has(n)) graph.set(n, new Set())
        for (const m of names) { if (m !== n) graph.get(n)!.add(m) }
      }
    }
    return graph
  })

  type SimNode = d3.SimulationNodeDatum & { id: string; roles: Set<string>; connectionCount: number }
  type SimLink = d3.SimulationLinkDatum<SimNode> & { source: string | SimNode; target: string | SimNode }

  let nodePositions = $state<Map<string, { x: number; y: number }>>(new Map())
  let links = $state<Array<{ x1: number; y1: number; x2: number; y2: number }>>([])

  // Screen-px offsets from each node's centre — valid at any zoom level
  let labelOffsets = $state<Map<string, { dx: number; dy: number }>>(new Map())

  let transform = $state({ tx: 0, ty: 0, scale: 1 })
  let hoveredNode = $state<string | null>(null)

  let containerEl = $state<HTMLElement | null>(null)
  let svgEl = $state<SVGSVGElement | null>(null)
  let svgWidth = $state(800)
  let svgHeight = $state(600)

  // ── simulation ────────────────────────────────────────────────────────────

  let simulation: d3.Simulation<SimNode, SimLink> | null = null
  let simNodes: SimNode[] = []
  let simLinks: SimLink[] = []

  // Returns screen-px radius (constant at any zoom because nodeRadius divides by scale)
  function simNodeRadius(id: string): number {
    return 2 + Math.sqrt((connectionMap.get(id)?.size ?? 0) + 1) * 1.2
  }

  function buildGraph() {
    simNodes = filteredGroups.map(p => ({
      id: p.name, roles: p.roles,
      connectionCount: connectionMap.get(p.name)?.size ?? 0,
    }))
    const seen = new Set<string>()
    simLinks = []
    for (const [name, connected] of connectionMap) {
      for (const other of connected) {
        const key = [name, other].sort().join('|')
        if (!seen.has(key)) { seen.add(key); simLinks.push({ source: name, target: other }) }
      }
    }
  }

  // ── label placement ───────────────────────────────────────────────────────
  // Works entirely in screen space so sizes are exact.
  // Works in raw sim coordinates. CHAR_W / H / GAP are screen-px sizes converted to
  // sim units (÷ scale) so overlap math is correct. Node positions and radii are
  // used as-is (already sim space). Offsets stored in sim units → no ÷ scale in template.

  function runLabelLayout(scale: number) {
    if (simNodes.length === 0) { labelOffsets = new Map(); return }

    const CHAR_W = 6.6 / scale   // sim units per mono char
    const H      = 13  / scale   // label height in sim units
    const GAP    = 5   / scale   // gap in sim units

    type L = { id: string; sx: number; sy: number; sr: number; x: number; y: number; w: number; h: number }

    const labels: L[] = simNodes.map(n => {
      const sx = n.x ?? 0
      const sy = n.y ?? 0
      const sr = simNodeRadius(n.id)   // already sim space
      return { id: n.id, sx, sy, sr, x: sx + sr + GAP, y: sy, w: n.id.length * CHAR_W, h: H }
    })

    const MAX_DX = H * 1.2  // clamp horizontal drift to ~label-width ballpark
    const MAX_DY = H * 3    // clamp vertical drift

    for (let iter = 0; iter < 120; iter++) {
      const cool = Math.max(0.05, 1 - iter / 120)

      for (let i = 0; i < labels.length; i++) {
        const a = labels[i]

        // Label–label repulsion (gentle: 0.3× overlap)
        for (let j = i + 1; j < labels.length; j++) {
          const b = labels[j]
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
          const oy = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2)
          if (ox > 0 && oy > 0) {
            if (ox < oy) {
              const d = ox * 0.3
              if (a.x < b.x) { a.x -= d; b.x += d } else { a.x += d; b.x -= d }
            } else {
              const d = oy * 0.3
              if (a.y < b.y) { a.y -= d; b.y += d } else { a.y += d; b.y -= d }
            }
          }
        }

        // Label–node repulsion
        for (const n of simNodes) {
          const nsx = n.x ?? 0
          const nsy = n.y ?? 0
          const nsr = simNodeRadius(n.id) + 2 / scale
          const cx = Math.max(a.x, Math.min(nsx, a.x + a.w))
          const cy = Math.max(a.y - a.h / 2, Math.min(nsy, a.y + a.h / 2))
          const ddx = nsx - cx, ddy = nsy - cy
          const dist = Math.sqrt(ddx * ddx + ddy * ddy)
          if (dist < nsr && dist > 0) {
            const push = (nsr - dist) * 0.3
            a.x -= (ddx / dist) * push
            a.y -= (ddy / dist) * push
          }
        }

        // Strong spring toward anchor
        a.x += (a.sx + a.sr + GAP - a.x) * 0.3 * cool
        a.y += (a.sy               - a.y) * 0.3 * cool

        // Clamp maximum displacement from anchor
        const anchorX = a.sx + a.sr + GAP
        a.x = Math.max(anchorX - MAX_DX, Math.min(anchorX + MAX_DX, a.x))
        a.y = Math.max(a.sy    - MAX_DY, Math.min(a.sy    + MAX_DY, a.y))
      }
    }

    // Offsets in sim units from node centre
    const offsets = new Map<string, { dx: number; dy: number }>()
    for (const l of labels) offsets.set(l.id, { dx: l.x - l.sx, dy: l.y - l.sy })
    labelOffsets = offsets
  }

  // ── fit + label layout ────────────────────────────────────────────────────

  function applyFitTransform() {
    if (simNodes.length === 0) return
    const xs = simNodes.map(n => n.x ?? 0)
    const ys = simNodes.map(n => n.y ?? 0)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const pad = 60
    const bw = maxX - minX || 1, bh = maxY - minY || 1
    const scale = Math.min((svgWidth - pad * 2) / bw, (svgHeight - pad * 2) / bh, 3)
    const tx = (svgWidth  - bw * scale) / 2 - minX * scale
    const ty = (svgHeight - bh * scale) / 2 - minY * scale
    transform = { tx, ty, scale }
    if (svgEl) zoomBehavior.transform(d3.select(svgEl), d3.zoomIdentity.translate(tx, ty).scale(scale))
    runLabelLayout(scale)
  }

  function flushPositions() {
    const pos = new Map<string, { x: number; y: number }>()
    for (const n of simNodes) pos.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 })
    nodePositions = pos
    links = simLinks.map(l => {
      const s = l.source as SimNode, t = l.target as SimNode
      return { x1: s.x ?? 0, y1: s.y ?? 0, x2: t.x ?? 0, y2: t.y ?? 0 }
    })
  }

  function startSimulation() {
    simulation?.stop()
    buildGraph()
    simulation = d3.forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks).id(d => d.id).distance(30))
      .force('charge', d3.forceManyBody().strength(-30))
      .force('center', d3.forceCenter(0, 0))
      .force('collide', d3.forceCollide<SimNode>(d => simNodeRadius(d.id) + 4))
      .alphaDecay(0.02)
    let ticks = 0
    simulation.on('tick', () => { ticks++; flushPositions(); if (ticks >= 300) simulation?.stop() })
    simulation.on('end', () => { flushPositions(); applyFitTransform() })
  }

  // ── zoom ──────────────────────────────────────────────────────────────────

  const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 10])
    .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      const { x, y, k } = event.transform
      transform = { tx: x, ty: y, scale: k }
    })

  $effect(() => {
    if (!svgEl) return
    d3.select(svgEl).call(zoomBehavior)
    return () => { d3.select(svgEl!).on('.zoom', null) }
  })

  // ── resize ────────────────────────────────────────────────────────────────

  $effect(() => {
    if (!containerEl) return
    const ro = new ResizeObserver(entries => {
      const e = entries[0]
      svgWidth = e.contentRect.width
      svgHeight = e.contentRect.height
      applyFitTransform()
    })
    ro.observe(containerEl)
    return () => ro.disconnect()
  })

  // ── notify parent of visible count ───────────────────────────────────────

  $effect(() => {
    const works = filteredGroups.reduce((n, p) => n + p.records.length, 0)
    onvisiblechange?.(filteredGroups.length, works)
  })

  // ── re-run simulation when data or year filter changes ────────────────────

  $effect(() => {
    filteredGroups; connectionMap
    startSimulation()
    return () => simulation?.stop()
  })

  // ── render helpers ────────────────────────────────────────────────────────

  function nodeRadius(id: string): number {
    return simNodeRadius(id) / transform.scale
  }

  function nodeColor(roles: Set<string>): string {
    return roles.has('student') ? '#60a5fa' : '#fbbf24'
  }

  function nodeOpacity(id: string): number {
    if (!hoveredNode) return 1
    if (id === hoveredNode) return 1
    if (connectionMap.get(hoveredNode)?.has(id)) return 1
    return 0.1
  }

  function linkOpacity(idx: number): number {
    if (!hoveredNode) return 0.55
    const link = simLinks[idx]
    const s = (link?.source as SimNode)?.id, t = (link?.target as SimNode)?.id
    if (s === hoveredNode || t === hoveredNode) return 0.9
    return 0.08
  }

  function linkStrokeWidth(idx: number): number {
    const base = 1 / transform.scale
    if (!hoveredNode) return base
    const link = simLinks[idx]
    const s = (link?.source as SimNode)?.id, t = (link?.target as SimNode)?.id
    if (s === hoveredNode || t === hoveredNode) return 2.5 / transform.scale
    return base
  }

  function linkColor(idx: number): string {
    if (!hoveredNode) return 'var(--network-link)'
    const link = simLinks[idx]
    const s = link?.source as SimNode, t = link?.target as SimNode
    if (s?.id === hoveredNode) return t?.roles?.has('student') ? '#60a5fa' : '#fbbf24'
    if (t?.id === hoveredNode) return s?.roles?.has('student') ? '#60a5fa' : '#fbbf24'
    return 'var(--network-link)'
  }

  const LABEL_ZOOM_THRESHOLD = 0.9
  function labelOpacity(id: string): number {
    if (id === hoveredNode) return 1
    if (transform.scale < LABEL_ZOOM_THRESHOLD) return 0
    return 1
  }

  function handleNodeClick(e: MouseEvent, id: string) {
    e.stopPropagation()
    const person = filteredGroups.find(p => p.name === id)
    if (!person) return
    onselect(person.records.map((r, i) => ({
      id: `person-${id}-${i}`, dataset: r.dataset as Dataset,
      label: r.title, searchableText: '', record: r.record,
    })))
  }
</script>

<!-- Year filter pills -->
{#if availableYears.length > 0}
  <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 w-max max-w-[calc(100%-2rem)] overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
    <button
      type="button"
      onclick={(e) => { e.stopPropagation(); selectedYear = null }}
      class="shrink-0 px-2.5 py-1 rounded-full text-[10px] leading-none border transition-colors
        {selectedYear === null
          ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-800 dark:border-gray-200'
          : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}"
    >ALL</button>
    {#each availableYears as year}
      <button
        type="button"
        onclick={(e) => { e.stopPropagation(); selectedYear = selectedYear === year ? null : year }}
        class="shrink-0 px-2.5 py-1 rounded-full text-[10px] leading-none border transition-colors
          {selectedYear === year
            ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-800 dark:border-gray-200'
            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}"
      >{year}</button>
    {/each}
  </div>
{/if}

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="absolute inset-0"
  bind:this={containerEl}
  onclick={() => { hoveredNode = null }}
>
  <svg
    class="absolute inset-0 w-full h-full"
    bind:this={svgEl}
    role="img"
    aria-label="Network graph"
  >
    <g transform="translate({transform.tx},{transform.ty}) scale({transform.scale})">

      <!-- Links -->
      {#each links as link, i}
        <line
          x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2}
          stroke={linkColor(i)}
          stroke-width={linkStrokeWidth(i)}
          opacity={linkOpacity(i)}
          style="transition: opacity 150ms, stroke-width 150ms, stroke 150ms"
        />
      {/each}

      <!-- Nodes + Labels -->
      {#each [...nodePositions.entries()] as [id, pos]}
        {@const person = filteredGroups.find(p => p.name === id)}
        {@const roles = person?.roles ?? new Set()}
        {@const lo = labelOffsets.get(id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <g
          class="cursor-pointer"
          style="transition: opacity 150ms"
          opacity={nodeOpacity(id)}
          onmouseenter={() => { hoveredNode = id }}
          onmouseleave={() => { hoveredNode = null }}
          onclick={(e) => handleNodeClick(e, id)}
          role="button" tabindex="0" aria-label={id}
        >
          <circle cx={pos.x} cy={pos.y} r={nodeRadius(id)} fill={nodeColor(roles)} />
          <circle cx={pos.x} cy={pos.y} r={Math.max(nodeRadius(id), 10 / transform.scale)} fill="transparent" />
          <text
            x={pos.x + (lo?.dx ?? (simNodeRadius(id) + 5) / transform.scale)}
            y={pos.y + (lo?.dy ?? 0)}
            font-size={11 / transform.scale}
            dominant-baseline="central"
            fill={id === hoveredNode ? (roles.has('student') ? '#60a5fa' : '#fbbf24') : 'var(--network-label)'}
            opacity={labelOpacity(id)}
            pointer-events="none"
            style="font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Consolas, 'Courier New', monospace; transition: opacity 150ms"
          >{id.toUpperCase()}</text>
        </g>
      {/each}

    </g>
  </svg>
</div>

<style>
  :global(:root) {
    --network-link: #d1d5db;
    --network-label: #9ca3af;
  }
  :global(.dark) {
    --network-link: #374151;
    --network-label: #6b7280;
  }
</style>
