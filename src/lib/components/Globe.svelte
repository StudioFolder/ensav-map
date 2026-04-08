<script lang="ts">
  import { onMount } from 'svelte'
  import * as d3 from 'd3'
  import * as topojson from 'topojson-client'
  import type { GlobePoint, GeoPoint, CountryZone } from '$lib/data/types'
  import type { SearchItem } from '$lib/search/index'

  let { points, geoPoints, countryZones, projectionType, onselect }: {
    points: GlobePoint[]
    geoPoints: GeoPoint[]
    countryZones: CountryZone[]
    projectionType: 'orthographic' | 'naturalEarth'
    onselect: (items: SearchItem[], groupLabel?: string) => void
  } = $props()

  let svgEl: SVGSVGElement
  type TooltipData =
    | { kind: 'globe'; x: number; y: number; point: GlobePoint }
    | { kind: 'geo'; x: number; y: number; point: GeoPoint }
    | { kind: 'country'; x: number; y: number; zone: CountryZone }
  let tooltip: TooltipData | null = $state(null)

  const SIZE = 600
  const RADIUS = 288

  // Natural Earth uses a wider viewport to match the projection's ~2:1 aspect ratio
  const viewW = projectionType === 'naturalEarth' ? SIZE * 2 : SIZE
  const viewH = SIZE

  const trianglePath = d3.symbol().type(d3.symbolTriangle).size(10)()!

  // Institutions are represented by partenariat triangles — exclude them from the circle layer
  const cityPoints = geoPoints.filter((p) => p.type !== 'institution')

  const maxCount = Math.max(1, ...cityPoints.map((p) => p.titles.length))
  const rScale = d3.scaleSqrt().domain([1, maxCount]).range([0.8, 6]).clamp(true)

  const coordKey = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`
  const partenariatKeys = new Set(points.map((p) => coordKey(p.lat, p.lon)))
  const geoKeys = new Set(cityPoints.map((p) => coordKey(p.lat, p.lon)))
  const overlaps = new Set([...partenariatKeys].filter((k) => geoKeys.has(k)))
  const OFFSET = 5

  onMount(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const world: any = await fetch(
      'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
    ).then((r) => r.json())

    const land = topojson.feature(world, world.objects.land)
    const countriesFeature = topojson.feature(world, world.objects.countries)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projection: any = projectionType === 'naturalEarth'
      ? d3.geoNaturalEarth1().fitSize([viewW, viewH], { type: 'Sphere' } as any)
      : d3.geoOrthographic()
          .scale(RADIUS)
          .translate([SIZE / 2, SIZE / 2])
          .rotate([0, -20])
          .clipAngle(90)
          .precision(0.1)

    const pathGen = d3.geoPath().projection(projection)
    const svg = d3.select(svgEl)

    // Background
    if (projectionType === 'naturalEarth') {
      svg.append('rect').attr('x', 0).attr('y', 0).attr('width', viewW).attr('height', viewH).attr('fill', '#3a3a3a')
    } else {
      svg
        .append('circle')
        .attr('class', 'ocean')
        .attr('cx', SIZE / 2)
        .attr('cy', SIZE / 2)
        .attr('r', RADIUS)
        .attr('fill', '#3a3a3a')
    }

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

    // Country zone fills — above land, below arcs and markers
    const countryGroup = svg.append('g').attr('class', 'country-zones')
    // Arc group sits between land and data points so arcs appear behind markers
    const arcGroup = svg.append('g').attr('class', 'arcs')
    // Travaux circles rendered below partenariat triangles
    const geoGroup = svg.append('g').attr('class', 'geo-points')
    const pointsGroup = svg.append('g').attr('class', 'points')

    // Build lookup: isoNumeric → CountryZone
    const countryZonesMap = new Map<string, CountryZone>()
    for (const zone of countryZones) {
      countryZonesMap.set(zone.isoNumeric, zone)
    }

    // Name → [lon, lat] lookup for resolving city fields to coordinates
    const coordsByName = new Map<string, [number, number]>()
    for (const p of geoPoints) {
      coordsByName.set(p.name, [p.lon, p.lat])
    }

    // Compute all arcs upfront — one arc per city-to-city connection across all records
    type ArcDatum = { from: [number, number]; to: [number, number]; key: string; key2?: string }
    const allArcs: ArcDatum[] = []
    for (const d of cityPoints) {
      const from: [number, number] = [d.lon, d.lat]
      const key = `${d.lat},${d.lon}`
      const seen = new Set<string>()
      for (const t of d.titles) {
        for (const field of ['City 1', 'City 2', 'City 3', 'City 4']) {
          const city = t.record[field] as string | null
          if (!city || city === d.name || seen.has(city)) continue
          const to = coordsByName.get(city)
          if (!to) continue
          seen.add(city)
          allArcs.push({ from, to, key })
        }
      }
    }

    // Compute centroids for country zone features
    const countryCentroids = new Map<string, [number, number]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const feature of (countriesFeature as any).features) {
      const id = feature.id !== undefined ? String(feature.id) : undefined
      if (id && countryZonesMap.has(id)) {
        countryCentroids.set(id, d3.geoCentroid(feature) as [number, number])
      }
    }

    // Build country-to-country arcs for records that span multiple countries
    const titleToIsos = new Map<string, string[]>()
    for (const zone of countryZones) {
      for (const t of zone.titles) {
        if (!titleToIsos.has(t.title)) titleToIsos.set(t.title, [])
        titleToIsos.get(t.title)!.push(zone.isoNumeric)
      }
    }
    const seenCountryPairs = new Set<string>()
    const countryConnections = new Map<string, Set<string>>()
    for (const isos of titleToIsos.values()) {
      if (isos.length < 2) continue
      for (let i = 0; i < isos.length; i++) {
        for (let j = i + 1; j < isos.length; j++) {
          const pairKey = [isos[i], isos[j]].sort().join('|')
          if (seenCountryPairs.has(pairKey)) continue
          seenCountryPairs.add(pairKey)
          const from = countryCentroids.get(isos[i])
          const to = countryCentroids.get(isos[j])
          if (!from || !to) continue
          allArcs.push({ from, to, key: `country:${isos[i]}`, key2: `country:${isos[j]}` })
          if (!countryConnections.has(isos[i])) countryConnections.set(isos[i], new Set())
          if (!countryConnections.has(isos[j])) countryConnections.set(isos[j], new Set())
          countryConnections.get(isos[i])!.add(isos[j])
          countryConnections.get(isos[j])!.add(isos[i])
        }
      }
    }

    // Country zones — filled country shapes for country-only records
    function renderCountryZones() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredFeatures = (countriesFeature as any).features.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (f: any) => f.id !== undefined && countryZonesMap.has(String(f.id))
      )

      countryGroup
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .selectAll<SVGPathElement, any>('path')
        .data(filteredFeatures, (d: any) => d.id)
        .join('path')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('fill', (d: any) => {
          const id = String(d.id)
          if (id === hoveredIso) return 'rgba(255,255,255,0.18)'
          if (hoveredIso && countryConnections.get(hoveredIso)?.has(id)) return 'rgba(255,255,255,0.10)'
          return 'transparent'
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('stroke', (d: any) => {
          const id = String(d.id)
          if (id === hoveredIso) return 'rgba(255,255,255,0.65)'
          if (hoveredIso && countryConnections.get(hoveredIso)?.has(id)) return 'rgba(255,255,255,0.45)'
          return 'rgba(255,255,255,0.18)'
        })
        .attr('stroke-width', 0.8)
        .attr('cursor', 'pointer')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('d', (d: any) => pathGen(d) ?? '')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on('mousemove', (event: MouseEvent, d: any) => {
          const zone = countryZonesMap.get(String(d.id))
          if (!zone) return
          tooltip = { kind: 'country', x: event.clientX, y: event.clientY, zone }
          const newKey = `country:${zone.isoNumeric}`
          if (hoveredKey !== newKey) {
            hoveredKey = newKey
            hoveredIso = String(d.id)
            renderCountryZones()
            renderArcs()
          }
        })
        .on('mouseout', () => {
          tooltip = null
          hoveredKey = null
          hoveredIso = null
          renderCountryZones()
          renderArcs()
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on('click', (_event: MouseEvent, d: any) => {
          const zone = countryZonesMap.get(String(d.id))
          if (!zone || !zone.titles.length) return
          onselect(
            zone.titles.map((t, i) => ({
              id: `country-${zone.isoNumeric}-${i}`,
              dataset: t.dataset as import('$lib/search/index').Dataset,
              label: t.title,
              searchableText: '',
              record: t.record,
            })),
            zone.nameFR
          )
        })
    }

    // Which geo_point/country is currently hovered — arcs become brighter, country fill appears
    let hoveredKey: string | null = null
    let hoveredIso: string | null = null

    function renderArcs() {
      arcGroup
        .selectAll<SVGPathElement, ArcDatum>('path')
        .data(allArcs)
        .join('path')
        .attr('fill', 'none')
        .attr('stroke', (d) => (d.key === hoveredKey || d.key2 === hoveredKey) ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.07)')
        .attr('stroke-width', (d) => (d.key === hoveredKey || d.key2 === hoveredKey) ? 1 : 0.5)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('d', ({ from, to }) => {
          if (!isVisible(from[0], from[1])) return ''
          // If the longitude difference exceeds 180° the shorter great circle crosses
          // the antimeridian and gets split. Use the full lonDiff to travel the "long
          // way" instead — linearly interpolating through N points so geoPath draws a
          // smooth continuous curve that never touches ±180°.
          const lonDiff = to[0] - from[0]
          let coords: [number, number][]
          if (Math.abs(lonDiff) > 180 && projectionType === 'naturalEarth') {
            const N = 48
            coords = Array.from({ length: N + 1 }, (_, i) => {
              const t = i / N
              return [from[0] + t * lonDiff, from[1] + t * (to[1] - from[1])] as [number, number]
            })
          } else {
            coords = [from, to]
          }
          return pathGen({ type: 'LineString', coordinates: coords } as any) ?? ''
        })
    }

    function isVisible(lon: number, lat: number): boolean {
      if (projectionType === 'naturalEarth') return true
      const rotate = projection.rotate()
      const center: [number, number] = [-rotate[0], -rotate[1]]
      return d3.geoDistance([lon, lat], center) <= Math.PI / 2
    }

    // Travaux — proportional circles
    function renderGeoPoints() {
      const groups = geoGroup
        .selectAll<SVGGElement, GeoPoint>('g')
        .data(cityPoints, (d) => `${d.lat},${d.lon}`)
        .join(
          (enter) => {
            const g = enter.append('g')
              .attr('cursor', 'pointer')
              .on('mousemove', (event: MouseEvent, d) => {
                tooltip = { kind: 'geo', x: event.clientX, y: event.clientY, point: d }
                hoveredKey = `${d.lat},${d.lon}`
                renderArcs()
              })
              .on('mouseout', () => {
                tooltip = null
                hoveredKey = null
                renderArcs()
              })
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

    renderCountryZones()
    renderGeoPoints()
    renderPoints()
    renderArcs()

    if (projectionType === 'orthographic') {
      // Scroll to zoom
      svgEl.addEventListener('wheel', (event) => {
        event.preventDefault()
        const current = projection.scale()
        const next = Math.max(100, Math.min(RADIUS * 8, current * (1 - event.deltaY * 0.001)))
        projection.scale(next)
        svg.select('.ocean').attr('r', next)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        svg.select('.land').attr('d', pathGen as any)
        renderCountryZones()
        renderGeoPoints()
        renderPoints()
        renderArcs()
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
            hoveredKey = null
            hoveredIso = null
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
            renderCountryZones()
            renderGeoPoints()
            renderPoints()
            renderArcs()
          })
      )
    }
  })
</script>

<div class="relative w-full h-full select-none">
  <svg
    bind:this={svgEl}
    viewBox="0 0 {viewW} {viewH}"
    preserveAspectRatio="xMidYMid meet"
    class="w-full h-full {projectionType === 'orthographic' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}"
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
      {:else if tooltip.kind === 'geo'}
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
      {:else}
        <div class="font-semibold leading-snug">{tooltip.zone.nameEN}</div>
        <div class="text-white/50 mb-1">{tooltip.zone.nameFR}</div>
        {#if tooltip.zone.titles.length > 0}
          <ul class="space-y-1.5 mt-1 border-t border-white/10 pt-1.5">
            {#each tooltip.zone.titles.slice(0, 6) as t}
              <li class="leading-snug">
                {#if t.person}<div class="font-semibold text-white">{t.person}</div>{/if}
                <div class="text-white font-normal">{t.title}</div>
              </li>
            {/each}
            {#if tooltip.zone.titles.length > 6}
              <li class="text-white/40">+{tooltip.zone.titles.length - 6} more</li>
            {/if}
          </ul>
        {/if}
      {/if}
    </div>
  {/if}
</div>
