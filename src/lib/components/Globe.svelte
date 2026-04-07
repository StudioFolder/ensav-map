<script lang="ts">
  import { onMount } from 'svelte'
  import * as d3 from 'd3'
  import * as topojson from 'topojson-client'
  import type { GlobePoint, GeoPoint } from '$lib/data/types'
  import type { SearchItem } from '$lib/search/index'

  let { points, geoPoints, onselect }: {
    points: GlobePoint[]
    geoPoints: GeoPoint[]
    onselect: (items: SearchItem[], groupLabel?: string) => void
  } = $props()

  let svgEl: SVGSVGElement
  type TooltipData =
    | { kind: 'globe'; x: number; y: number; point: GlobePoint }
    | { kind: 'geo'; x: number; y: number; point: GeoPoint }
  let tooltip: TooltipData | null = $state(null)

  const SIZE = 600
  const RADIUS = 288

  const trianglePath = d3.symbol().type(d3.symbolTriangle).size(10)()!

  const maxCount = Math.max(1, ...geoPoints.map((p) => p.titles.length))
  const rScale = d3.scaleSqrt().domain([1, maxCount]).range([0.8, 6]).clamp(true)

  const coordKey = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`
  const partenariatKeys = new Set(points.map((p) => coordKey(p.lat, p.lon)))
  const geoKeys = new Set(geoPoints.map((p) => coordKey(p.lat, p.lon)))
  const overlaps = new Set([...partenariatKeys].filter((k) => geoKeys.has(k)))
  const OFFSET = 5

  onMount(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const world: any = await fetch(
      'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
    ).then((r) => r.json())

    const land = topojson.feature(world, world.objects.land)

    const projection = d3
      .geoOrthographic()
      .scale(RADIUS)
      .translate([SIZE / 2, SIZE / 2])
      .rotate([0, -20])
      .clipAngle(90)

    const pathGen = d3.geoPath().projection(projection)
    const svg = d3.select(svgEl)

    // Ocean sphere
    svg
      .append('circle')
      .attr('class', 'ocean')
      .attr('cx', SIZE / 2)
      .attr('cy', SIZE / 2)
      .attr('r', RADIUS)
      .attr('fill', '#3a3a3a')

    // Land
    svg
      .append('path')
      .attr('class', 'land')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .datum(land as any)
      .attr('fill', '#4e4e4e')
      .attr('stroke', 'none')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('d', pathGen as any)

    // Travaux circles rendered below partenariat triangles
    const geoGroup = svg.append('g').attr('class', 'geo-points')
    const pointsGroup = svg.append('g').attr('class', 'points')

    function isVisible(lon: number, lat: number): boolean {
      const rotate = projection.rotate()
      const center: [number, number] = [-rotate[0], -rotate[1]]
      return d3.geoDistance([lon, lat], center) <= Math.PI / 2
    }

    // Travaux — proportional circles
    function renderGeoPoints() {
      const groups = geoGroup
        .selectAll<SVGGElement, GeoPoint>('g')
        .data(geoPoints, (d) => `${d.lat},${d.lon}`)
        .join(
          (enter) => {
            const g = enter.append('g')
              .attr('cursor', 'pointer')
              .on('mousemove', (event: MouseEvent, d) => {
                tooltip = { kind: 'geo', x: event.clientX, y: event.clientY, point: d }
              })
              .on('mouseout', () => { tooltip = null })
              .on('click', (_event: MouseEvent, d) => {
                if (!d.titles.length) return
                onselect(
                  d.titles.map((t, i) => ({
                    id: `geo-${d.lat}-${d.lon}-${i}`,
                    dataset: t.dataset as import('$lib/search/index').Dataset,
                    label: t.title,
                    searchableText: '',
                    record: t.record,
                  })),
                  d.titles.length > 1 ? d.name : undefined
                )
              })
            g.append('circle').attr('class', 'hit').attr('fill', 'transparent').attr('stroke', 'none')
            g.append('circle').attr('class', 'visual')
              .attr('fill', '#ffffff').attr('fill-opacity', 0.5)
              .attr('stroke', '#ffffff').attr('stroke-width', 0.3)
              .attr('pointer-events', 'none')
            return g
          },
          (update) => update,
          (exit) => exit.remove()
        )

      groups
        .attr('display', (d) => (isVisible(d.lon, d.lat) ? null : 'none'))
        .attr('transform', (d) => {
          const c = projection([d.lon, d.lat])
          if (!c) return 'translate(-9999,-9999)'
          const dx = overlaps.has(coordKey(d.lat, d.lon)) ? -OFFSET : 0
          return `translate(${c[0] + dx},${c[1]})`
        })
        .each(function(d) {
          const r = rScale(d.titles.length)
          d3.select(this).select<SVGCircleElement>('.hit').attr('r', Math.max(r + 2, 4))
          d3.select(this).select<SVGCircleElement>('.visual').attr('r', r)
        })
    }

    // Partenariats — triangles
    function renderPoints() {
      const groups = pointsGroup
        .selectAll<SVGGElement, GlobePoint>('g')
        .data(points, (d) => `${d.type}:${d.lat},${d.lon}`)
        .join(
          (enter) => {
            const g = enter.append('g')
              .attr('cursor', 'pointer')
              .on('mousemove', (event: MouseEvent, d) => {
                tooltip = { kind: 'globe', x: event.clientX, y: event.clientY, point: d }
              })
              .on('mouseout', () => { tooltip = null })
              .on('click', (_event: MouseEvent, d) => {
                onselect([{
                  id: `partenariat-${d.lat}-${d.lon}`,
                  dataset: (d.type === 'mobilites' ? 'partenariats_mobilites' : 'partenariats_hors_mobilites') as import('$lib/search/index').Dataset,
                  label: d.institution,
                  searchableText: '',
                  record: d.record,
                }])
              })
            g.append('circle').attr('r', 4).attr('fill', 'transparent').attr('stroke', 'none')
            g.append('path').attr('d', trianglePath)
              .attr('fill', '#000000').attr('fill-opacity', 0.9).attr('stroke', 'none')
              .attr('pointer-events', 'none')
            return g
          },
          (update) => update,
          (exit) => exit.remove()
        )

      groups
        .attr('display', (d) => (isVisible(d.lon, d.lat) ? null : 'none'))
        .attr('transform', (d) => {
          const c = projection([d.lon, d.lat])
          if (!c) return 'translate(-9999,-9999)'
          const dx = overlaps.has(coordKey(d.lat, d.lon)) ? OFFSET : 0
          return `translate(${c[0] + dx},${c[1]})`
        })
    }

    renderGeoPoints()
    renderPoints()

    // Scroll to zoom
    svgEl.addEventListener('wheel', (event) => {
      event.preventDefault()
      const current = projection.scale()
      const next = Math.max(100, Math.min(RADIUS * 8, current * (1 - event.deltaY * 0.001)))
      projection.scale(next)
      svg.select('.ocean').attr('r', next)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      svg.select('.land').attr('d', pathGen as any)
      renderGeoPoints()
      renderPoints()
    }, { passive: false })

    // Drag to rotate
    let dragStart: [number, number] = [0, 0]
    let dragOriginRotate: [number, number, number] = [0, 0, 0]

    svg.call(
      (d3.drag() as d3.DragBehavior<SVGSVGElement, unknown, unknown>)
        .on('start', (event) => {
          dragStart = [event.x, event.y]
          dragOriginRotate = [...projection.rotate()] as [number, number, number]
          tooltip = null
        })
        .on('drag', (event) => {
          tooltip = null
          const dx = event.x - dragStart[0]
          const dy = event.y - dragStart[1]
          projection.rotate([
            dragOriginRotate[0] + dx * 0.3,
            dragOriginRotate[1] - dy * 0.3,
            dragOriginRotate[2],
          ])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          svg.select('.land').attr('d', pathGen as any)
          renderGeoPoints()
          renderPoints()
        })
    )
  })
</script>

<div class="relative w-full h-full select-none">
  <svg
    bind:this={svgEl}
    viewBox="0 0 {SIZE} {SIZE}"
    preserveAspectRatio="xMidYMid meet"
    class="w-full h-full cursor-grab active:cursor-grabbing"
  ></svg>

  {#if tooltip}
    <div
      class="fixed z-50 pointer-events-none bg-gray-900/95 text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-56 border border-white/10"
      style="left: {tooltip.x + 14}px; top: {tooltip.y - 10}px"
    >
      {#if tooltip.kind === 'globe'}
        <div class="font-semibold leading-snug mb-1">
          {tooltip.point.institution || 'Unknown institution'}
        </div>
        {#if tooltip.point.city || tooltip.point.country}
          <div class="text-gray-300">
            {[tooltip.point.city, tooltip.point.country].filter(Boolean).join(', ')}
          </div>
        {/if}
        {#if tooltip.point.programme}
          <div class="text-gray-400 mt-0.5">{tooltip.point.programme}</div>
        {/if}
        <div class="text-gray-400 mt-0.5">
          {tooltip.point.type === 'mobilites' ? 'Mobilités' : 'Hors mobilités'}
        </div>
      {:else}
        <div class="font-semibold leading-snug">{tooltip.point.name}</div>
        {#if tooltip.point.country}
          <div class="text-white/50 mb-1">{tooltip.point.country}</div>
        {/if}
        {#if tooltip.point.titles.length > 0}
          <ul class="space-y-1.5 mt-1 border-t border-white/10 pt-1.5">
            {#each tooltip.point.titles.slice(0, 6) as t}
              <li class="leading-snug">
                {#if t.person}<div class="font-semibold text-white">{t.person}</div>{/if}
                <div class="text-white font-normal">{t.title}</div>
              </li>
            {/each}
            {#if tooltip.point.titles.length > 6}
              <li class="text-white/40">+{tooltip.point.titles.length - 6} more</li>
            {/if}
          </ul>
        {/if}
      {/if}
    </div>
  {/if}
</div>
