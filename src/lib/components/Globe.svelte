<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import * as d3 from 'd3'
  import type { GlobePoint, GeoPoint, CountryZone } from '$lib/data/types'
  import { loadWorldAtlas } from '$lib/data/worldAtlas'
  import type { SearchItem } from '$lib/search/index'

  let { points, geoPoints, countryZones, projectionType, theme, onselect, onfocuschange, clearFocusTrigger = 0 }: {
    points: GlobePoint[]
    geoPoints: GeoPoint[]
    countryZones: CountryZone[]
    projectionType: 'orthographic' | 'naturalEarth'
    theme: 'dark' | 'light'
    onselect: (items: SearchItem[], groupLabel?: string) => void
    onfocuschange?: (hasFocus: boolean) => void
    clearFocusTrigger?: number
  } = $props()

  // R11: Globe is re-keyed by +page.svelte whenever theme/projectionType/points change,
  // so reading props in module-level consts is intentional — untrack() makes that explicit.
  const COLORS = untrack(() => theme === 'dark'
    ? {
        globeOcean: '#484848',
        mapOcean: '#3a3a3a',
        land: '#5c5c5c',
        pointFill: '#ffffff',
        pointStroke: '#ffffff',
        triangleFill: '#000000',
        baseZoneFill: 'transparent',
        baseZoneStroke: 'rgba(255,255,255,0.18)',
        hoveredZoneFill: 'rgba(255,255,255,0.18)',
        hoveredZoneStroke: 'rgba(255,255,255,0.65)',
        connectedZoneFill: 'rgba(255,255,255,0.10)',
        connectedZoneStroke: 'rgba(255,255,255,0.45)',
        focusedZoneFill: 'rgba(255,255,255,0.22)',
        focusedZoneStroke: 'rgba(255,255,255,0.80)',
        connectedFocusedZoneFill: 'rgba(255,255,255,0.12)',
        connectedFocusedZoneStroke: 'rgba(255,255,255,0.50)',
        baseArc: 'rgba(255,255,255,0.07)',
        hoveredArc: 'rgba(255,255,255,0.75)',
        focusedArc: 'rgba(255,255,255,0.45)',
      }
    : {
        globeOcean: '#f2f2f2',
        mapOcean: '#e5e5e5',
        land: '#d4d4d4',
        pointFill: '#171717',
        pointStroke: '#171717',
        triangleFill: '#171717',
        baseZoneFill: 'transparent',
        baseZoneStroke: 'rgba(0,0,0,0.22)',
        hoveredZoneFill: 'rgba(0,0,0,0.18)',
        hoveredZoneStroke: 'rgba(0,0,0,0.7)',
        connectedZoneFill: 'rgba(0,0,0,0.10)',
        connectedZoneStroke: 'rgba(0,0,0,0.45)',
        focusedZoneFill: 'rgba(0,0,0,0.22)',
        focusedZoneStroke: 'rgba(0,0,0,0.85)',
        connectedFocusedZoneFill: 'rgba(0,0,0,0.10)',
        connectedFocusedZoneStroke: 'rgba(0,0,0,0.50)',
        baseArc: 'rgba(0,0,0,0.10)',
        hoveredArc: 'rgba(0,0,0,0.75)',
        focusedArc: 'rgba(0,0,0,0.45)',
      })

  // Arc type — defined outside onMount so it can be referenced in FocusedState
  type ArcDatum = { from: [number, number]; to: [number, number]; key: string; key2?: string }

  type FocusKind = 'country' | 'geo' | 'partenariat'

  // Precomputed at click time — drives both D3 rendering and the Svelte bottom panel
  interface FocusedState {
    key: string
    kind: FocusKind
    label: string
    sublabel?: string
    count: number                      // total records to display
    // Data to pass to onselect when the "Open" button is clicked
    selectItems: SearchItem[]
    selectLabel?: string
    // Sets of what should remain visible (precomputed so render fns are fast)
    visibleGeoCoordStrs: Set<string>   // coordKey strings of visible geo city dots
    visibleCountryIsos: Set<string>    // ISO numerics of visible country zones
    visibleCountryNames: Set<string>   // FR + EN names for partenariat / geoPoint country matching
    arcData: ArcDatum[]               // arcs to render while focused
  }

  let svgEl: SVGSVGElement
  let rootEl: HTMLDivElement
  let focused = $state<FocusedState | null>(null)
  let renderAll: (() => void) | null = null

  // Notify parent when focus state changes
  $effect(() => {
    onfocuschange?.(focused !== null)
  })

  // Allow parent to clear focus (e.g. via a close button outside the canvas)
  $effect(() => {
    if (clearFocusTrigger > 0) {
      untrack(() => { focused = null; renderAll?.() })
    }
  })

  // Keyboard + outside-click handlers — set up once, no reactive re-subscriptions
  $effect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') untrack(() => { if (focused) { focused = null; renderAll?.() } })
    }
    function onDocumentClick(e: MouseEvent) {
      untrack(() => {
        if (!focused) return
        if (rootEl && !rootEl.contains(e.target as Node)) {
          focused = null
          renderAll?.()
        }
      })
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('click', onDocumentClick)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('click', onDocumentClick)
    }
  })

  type TooltipData =
    | { kind: 'globe'; x: number; y: number; point: GlobePoint }
    | { kind: 'geo'; x: number; y: number; point: GeoPoint }
    | { kind: 'country'; x: number; y: number; zone: CountryZone }
  let tooltip: TooltipData | null = $state(null)

  const SIZE = 600
  const RADIUS = 288
  const viewW = untrack(() => projectionType === 'naturalEarth' ? SIZE * 2 : SIZE)
  const viewH = SIZE

  const trianglePath = d3.symbol().type(d3.symbolTriangle).size(10)()!

  const cityPoints = untrack(() => geoPoints.filter((p) => p.type !== 'institution'))

  const maxCount = Math.max(1, ...cityPoints.map((p) => p.titles.length))
  const rScale = d3.scaleSqrt().domain([1, maxCount]).range([0.8, 6]).clamp(true)

  const coordKey = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`
  const partenariatKeys = new Set(untrack(() => points.map((p) => coordKey(p.lat, p.lon))))
  const geoKeys = new Set(cityPoints.map((p) => coordKey(p.lat, p.lon)))
  const overlaps = new Set([...partenariatKeys].filter((k) => geoKeys.has(k)))
  const OFFSET = 5

  onMount(async () => {
    const { land, countries: countriesFeature } = await loadWorldAtlas()

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

    // Background (ocean / map rect) — clicking clears focus
    if (projectionType === 'naturalEarth') {
      svg.append('rect').attr('x', 0).attr('y', 0).attr('width', viewW).attr('height', viewH)
        .attr('fill', COLORS.mapOcean)
        .on('click', () => { if (focused) { focused = null; _renderAll() } })
    } else {
      svg.append('circle').attr('class', 'ocean')
        .attr('cx', SIZE / 2).attr('cy', SIZE / 2).attr('r', RADIUS)
        .attr('fill', COLORS.globeOcean)
        .on('click', () => { if (focused) { focused = null; _renderAll() } })
    }

    // Land — clicking clears focus
    svg.append('path').attr('class', 'land')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .datum(land as any)
      .attr('fill', COLORS.land).attr('stroke', 'none')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('d', pathGen as any)
      .on('click', () => { if (focused) { focused = null; _renderAll() } })

    const countryGroup = svg.append('g').attr('class', 'country-zones')
    const arcGroup = svg.append('g').attr('class', 'arcs')
    const geoGroup = svg.append('g').attr('class', 'geo-points')
    const pointsGroup = svg.append('g').attr('class', 'points')
    const labelsGroup = svg.append('g').attr('class', 'labels').attr('pointer-events', 'none')

    // Lookup: isoNumeric → CountryZone
    const countryZonesMap = new Map<string, CountryZone>()
    for (const zone of countryZones) countryZonesMap.set(zone.isoNumeric, zone)

    // Name → [lon, lat] for arc lookups
    const coordsByName = new Map<string, [number, number]>()
    for (const p of geoPoints) coordsByName.set(p.name, [p.lon, p.lat])

    // City-to-city arcs. Key = "geo:lat,lon" of FROM city.
    const allArcs: ArcDatum[] = []
    for (const d of cityPoints) {
      const from: [number, number] = [d.lon, d.lat]
      const key = `geo:${d.lat},${d.lon}`
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

    // Country centroids for zoom target
    const countryCentroids = new Map<string, [number, number]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const feature of (countriesFeature as any).features) {
      const id = feature.id !== undefined ? String(feature.id) : undefined
      if (id && countryZonesMap.has(id))
        countryCentroids.set(id, d3.geoCentroid(feature) as [number, number])
    }

    // Country-to-country arcs (multi-country records)
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

    // ---------------------------------------------------------------------------
    // Focus helpers — precompute visibility at click time
    // ---------------------------------------------------------------------------

    function buildGeoFocus(d: GeoPoint): Pick<FocusedState, 'visibleGeoCoordStrs' | 'visibleCountryIsos' | 'visibleCountryNames' | 'arcData'> {
      const myCoordStr = coordKey(d.lat, d.lon)
      const visibleGeoCoordStrs = new Set([myCoordStr])
      const focusedArcs: ArcDatum[] = []
      for (const arc of allArcs) {
        if (!arc.key.startsWith('geo:')) continue
        const fromStr = coordKey(arc.from[1], arc.from[0])
        const toStr   = coordKey(arc.to[1],   arc.to[0])
        if (fromStr === myCoordStr) { visibleGeoCoordStrs.add(toStr);   focusedArcs.push(arc) }
        else if (toStr === myCoordStr) { visibleGeoCoordStrs.add(fromStr); focusedArcs.push(arc) }
      }
      return { visibleGeoCoordStrs, visibleCountryIsos: new Set(), visibleCountryNames: new Set(), arcData: focusedArcs }
    }

    function buildCountryFocus(zone: CountryZone): Pick<FocusedState, 'visibleGeoCoordStrs' | 'visibleCountryIsos' | 'visibleCountryNames' | 'arcData'> {
      const visibleIsos = new Set([zone.isoNumeric, ...(countryConnections.get(zone.isoNumeric) ?? [])])

      // Build a set of all country names (FR + EN) for the visible ISO set
      // — used to match GeoPoint.country and GlobePoint.country (string fields whose language is unknown)
      const visibleCountryNames = new Set<string>()
      for (const iso of visibleIsos) {
        const z = countryZonesMap.get(iso)
        if (z) { visibleCountryNames.add(z.nameFR); visibleCountryNames.add(z.nameEN) }
      }

      // City dots in visible countries (focused + directly connected)
      const visibleGeoCoordStrs = new Set<string>()
      for (const p of cityPoints) {
        if (visibleCountryNames.has(p.country))
          visibleGeoCoordStrs.add(coordKey(p.lat, p.lon))
      }

      // City dots in the focused country only — used to enforce first-level arc constraint
      const focusedCountryNames = new Set([zone.nameFR, zone.nameEN])
      const focusedCountryGeoCoordStrs = new Set<string>()
      for (const p of cityPoints) {
        if (focusedCountryNames.has(p.country))
          focusedCountryGeoCoordStrs.add(coordKey(p.lat, p.lon))
      }

      // Arcs — first-level only:
      // • geo arcs: both endpoints visible AND at least one in the focused country
      // • country arcs: the focused country must be one of the two endpoints
      const focusedArcs = allArcs.filter((arc) => {
        if (arc.key.startsWith('geo:')) {
          const fromStr = coordKey(arc.from[1], arc.from[0])
          const toStr   = coordKey(arc.to[1],   arc.to[0])
          return visibleGeoCoordStrs.has(fromStr) &&
                 visibleGeoCoordStrs.has(toStr) &&
                 (focusedCountryGeoCoordStrs.has(fromStr) || focusedCountryGeoCoordStrs.has(toStr))
        }
        if (arc.key.startsWith('country:')) {
          const iso1 = arc.key.replace('country:', '')
          const iso2 = arc.key2?.replace('country:', '') ?? ''
          return iso1 === zone.isoNumeric || iso2 === zone.isoNumeric
        }
        return false
      })

      return { visibleGeoCoordStrs, visibleCountryIsos: visibleIsos, visibleCountryNames, arcData: focusedArcs }
    }

    // ---------------------------------------------------------------------------
    // Animate globe rotation to centre on [lon, lat]
    // ---------------------------------------------------------------------------

    function animateToPoint(lon: number, lat: number) {
      if (projectionType !== 'orthographic') { _renderAll(); return }
      const currentRotate = projection.rotate() as [number, number, number]
      const targetRotate: [number, number, number] = [-lon, -lat, currentRotate[2]]
      d3.transition()
        .duration(750)
        .ease(d3.easeCubicInOut)
        .tween('rotate', () => {
          const r = d3.interpolate(currentRotate, targetRotate)
          return (t: number) => {
            projection.rotate(r(t))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            svg.select('.land').attr('d', pathGen as any)
            svg.select('.ocean').attr('r', projection.scale())
            renderCountryZones()
            renderGeoPoints()
            renderPoints()
            renderArcs()
            renderLabels()
          }
        })
    }

    // ---------------------------------------------------------------------------
    // Hover state (disabled while focused)
    // ---------------------------------------------------------------------------

    let hoveredKey: string | null = null
    let hoveredIso: string | null = null

    // ---------------------------------------------------------------------------
    // Render: country zones
    // ---------------------------------------------------------------------------

    function renderCountryZones() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allZoneFeatures = (countriesFeature as any).features.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (f: any) => f.id !== undefined && countryZonesMap.has(String(f.id))
      )

      // When focused on a country, restrict to the visible ISO set
      const features = focused?.kind === 'country'
        ? allZoneFeatures.filter((f: any) => focused!.visibleCountryIsos.has(String(f.id)))
        : focused
          ? []  // geo / partenariat focus → hide all country zones
          : allZoneFeatures

      countryGroup
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .selectAll<SVGPathElement, any>('path')
        .data(features, (d: any) => d.id)
        .join('path')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('fill', (d: any) => {
          const id = String(d.id)
          if (focused?.kind === 'country') {
            return focused.key === `country:${id}` ? COLORS.focusedZoneFill : COLORS.connectedFocusedZoneFill
          }
          if (id === hoveredIso) return COLORS.hoveredZoneFill
          if (hoveredIso && countryConnections.get(hoveredIso)?.has(id)) return COLORS.connectedZoneFill
          return COLORS.baseZoneFill
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('stroke', (d: any) => {
          const id = String(d.id)
          if (focused?.kind === 'country') {
            return focused.key === `country:${id}` ? COLORS.focusedZoneStroke : COLORS.connectedFocusedZoneStroke
          }
          if (id === hoveredIso) return COLORS.hoveredZoneStroke
          if (hoveredIso && countryConnections.get(hoveredIso)?.has(id)) return COLORS.connectedZoneStroke
          return COLORS.baseZoneStroke
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
          if (!focused) {
            const newKey = `country:${zone.isoNumeric}`
            if (hoveredKey !== newKey) {
              hoveredKey = newKey; hoveredIso = String(d.id)
              renderCountryZones(); renderArcs()
            }
          }
        })
        .on('mouseout', () => {
          tooltip = null
          if (!focused) {
            hoveredKey = null; hoveredIso = null
            renderCountryZones(); renderArcs()
          }
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on('click', (event: MouseEvent, d: any) => {
          event.stopPropagation()
          const zone = countryZonesMap.get(String(d.id))
          if (!zone || !zone.titles.length) return
          tooltip = null; hoveredKey = null; hoveredIso = null
          focused = {
            key: `country:${zone.isoNumeric}`,
            kind: 'country',
            label: zone.nameFR,
            sublabel: zone.nameEN !== zone.nameFR ? zone.nameEN : undefined,
            count: zone.titles.length,
            selectItems: zone.titles.map((t, i) => ({
              id: `country-${zone.isoNumeric}-${i}`,
              dataset: t.dataset as import('$lib/search/index').Dataset,
              label: t.title, searchableText: '', record: t.record,
            })),
            selectLabel: zone.nameFR,
            ...buildCountryFocus(zone),
          }
          const centroid = countryCentroids.get(zone.isoNumeric)
          if (centroid) animateToPoint(centroid[0], centroid[1])
          else _renderAll()
        })
    }

    // ---------------------------------------------------------------------------
    // Render: arcs
    // ---------------------------------------------------------------------------

    function renderArcs() {
      const arcsData = focused ? focused.arcData : allArcs
      arcGroup
        .selectAll<SVGPathElement, ArcDatum>('path')
        .data(arcsData)
        .join('path')
        .attr('fill', 'none')
        .attr('stroke', (d) => {
          if (focused) return COLORS.focusedArc
          return (d.key === hoveredKey || d.key2 === hoveredKey) ? COLORS.hoveredArc : COLORS.baseArc
        })
        .attr('stroke-width', (d) => {
          if (focused) return 0.7
          return (d.key === hoveredKey || d.key2 === hoveredKey) ? 1 : 0.5
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('d', ({ from, to }) => {
          if (!isVisible(from[0], from[1])) return ''
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

    // ---------------------------------------------------------------------------
    // Render: travaux city dots
    // ---------------------------------------------------------------------------

    function renderGeoPoints() {
      let visibleCityPoints: GeoPoint[]
      if (!focused) {
        visibleCityPoints = cityPoints
      } else if (focused.kind === 'geo') {
        visibleCityPoints = cityPoints.filter(
          (p) => focused!.visibleGeoCoordStrs.has(coordKey(p.lat, p.lon))
        )
      } else if (focused.kind === 'country') {
        visibleCityPoints = cityPoints.filter(
          (p) => focused!.visibleGeoCoordStrs.has(coordKey(p.lat, p.lon))
        )
      } else {
        visibleCityPoints = []  // partenariat focused
      }

      const groups = geoGroup
        .selectAll<SVGGElement, GeoPoint>('g')
        .data(visibleCityPoints, (d) => `${d.lat},${d.lon}`)
        .join(
          (enter) => {
            const g = enter.append('g')
              .attr('cursor', 'pointer')
              .on('mousemove', (event: MouseEvent, d) => {
                tooltip = { kind: 'geo', x: event.clientX, y: event.clientY, point: d }
                if (!focused) { hoveredKey = `geo:${d.lat},${d.lon}`; renderArcs() }
              })
              .on('mouseout', () => {
                tooltip = null
                if (!focused) { hoveredKey = null; renderArcs() }
              })
              .on('click', (event: MouseEvent, d) => {
                event.stopPropagation()
                if (!d.titles.length) return
                tooltip = null; hoveredKey = null
                focused = {
                  key: `geo:${d.lat},${d.lon}`,
                  kind: 'geo',
                  label: d.name,
                  sublabel: d.country || undefined,
                  count: d.titles.length,
                  selectItems: d.titles.map((t, i) => ({
                    id: `geo-${d.lat}-${d.lon}-${i}`,
                    dataset: t.dataset as import('$lib/search/index').Dataset,
                    label: t.title, searchableText: '', record: t.record,
                  })),
                  selectLabel: d.titles.length > 1 ? d.name : undefined,
                  ...buildGeoFocus(d),
                }
                animateToPoint(d.lon, d.lat)
              })
            g.append('circle').attr('class', 'hit').attr('fill', 'transparent').attr('stroke', 'none')
            g.append('circle').attr('class', 'visual')
              .attr('fill', COLORS.pointFill).attr('fill-opacity', 0.5)
              .attr('stroke', COLORS.pointStroke).attr('stroke-width', 0.3)
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

    // ---------------------------------------------------------------------------
    // Render: partenariat triangles
    // ---------------------------------------------------------------------------

    function renderPoints() {
      let visiblePoints: GlobePoint[]
      if (!focused) {
        visiblePoints = points
      } else if (focused.kind === 'partenariat') {
        visiblePoints = points.filter((p) => `partenariat:${coordKey(p.lat, p.lon)}` === focused!.key)
      } else if (focused.kind === 'country') {
        // Show partenariats in the focused / connected countries
        visiblePoints = points.filter((p) => focused!.visibleCountryNames.has(p.country))
      } else {
        visiblePoints = []  // geo focused
      }

      const groups = pointsGroup
        .selectAll<SVGGElement, GlobePoint>('g')
        .data(visiblePoints, (d) => `${d.type}:${d.lat},${d.lon}`)
        .join(
          (enter) => {
            const g = enter.append('g')
              .attr('cursor', 'pointer')
              .on('mousemove', (event: MouseEvent, d) => {
                tooltip = { kind: 'globe', x: event.clientX, y: event.clientY, point: d }
              })
              .on('mouseout', () => { tooltip = null })
              .on('click', (event: MouseEvent, d) => {
                event.stopPropagation()
                tooltip = null
                const dataset = (d.type === 'mobilites' ? 'partenariats_mobilites' : 'partenariats_hors_mobilites') as import('$lib/search/index').Dataset
                focused = {
                  key: `partenariat:${coordKey(d.lat, d.lon)}`,
                  kind: 'partenariat',
                  label: d.institution,
                  sublabel: [d.city, d.country].filter(Boolean).join(', ') || undefined,
                  count: 1,
                  selectItems: [{ id: `partenariat-${d.lat}-${d.lon}`, dataset, label: d.institution, searchableText: '', record: d.record }],
                  selectLabel: undefined,
                  visibleGeoCoordStrs: new Set(),
                  visibleCountryIsos: new Set(),
                  visibleCountryNames: new Set(),
                  arcData: [],
                }
                animateToPoint(d.lon, d.lat)
              })
            g.append('circle').attr('r', 4).attr('fill', 'transparent').attr('stroke', 'none')
            g.append('path').attr('d', trianglePath)
              .attr('fill', COLORS.triangleFill).attr('fill-opacity', 0.9).attr('stroke', 'none')
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

    // ---------------------------------------------------------------------------
    // Render: focus-mode labels (city names + country names)
    // ---------------------------------------------------------------------------

    const LABEL_FILL = theme === 'dark' ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)'

    function renderLabels() {
      // In country focus, only label cities that are arc endpoints (directly connected).
      // Cities in the country with no arc connections get a dot but no label.
      // In geo focus, all visible cities are already directly connected (focused city + arc neighbours).
      const arcCityCoordStrs = new Set<string>()
      if (focused?.kind === 'country') {
        for (const arc of focused.arcData) {
          if (arc.key.startsWith('geo:')) {
            arcCityCoordStrs.add(coordKey(arc.from[1], arc.from[0]))
            arcCityCoordStrs.add(coordKey(arc.to[1],   arc.to[0]))
          }
        }
      }

      const cityData = focused && focused.visibleGeoCoordStrs.size > 0
        ? cityPoints.filter((p) => {
            if (!focused!.visibleGeoCoordStrs.has(coordKey(p.lat, p.lon))) return false
            if (!isVisible(p.lon, p.lat)) return false
            // Country focus: only arc-connected cities get a label
            if (focused!.kind === 'country') return arcCityCoordStrs.has(coordKey(p.lat, p.lon))
            return true
          })
        : []

      labelsGroup
        .selectAll<SVGTextElement, GeoPoint>('text.lbl-city')
        .data(cityData, (d) => `${d.lat},${d.lon}`)
        .join('text')
        .attr('class', 'lbl-city')
        .attr('text-anchor', 'start')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', projectionType === 'orthographic' ? '5' : '7')
        .attr('font-family', 'sans-serif')
        .attr('fill', LABEL_FILL)
        .attr('transform', (d) => {
          const c = projection([d.lon, d.lat])
          if (!c) return 'translate(-9999,-9999)'
          const dx = overlaps.has(coordKey(d.lat, d.lon)) ? -OFFSET : 0
          return `translate(${c[0] + dx + rScale(d.titles.length) + 3},${c[1]})`
        })
        .text((d) => d.name)

      // Country name labels — at centroid of each visible zone, only in country focus
      type CountryLabelDatum = { iso: string; zone: CountryZone; centroid: [number, number] }
      const countryData: CountryLabelDatum[] = focused?.kind === 'country'
        ? [...focused.visibleCountryIsos]
            .map((iso) => ({ iso, zone: countryZonesMap.get(iso)!, centroid: countryCentroids.get(iso)! }))
            .filter((d) => d.zone && d.centroid && isVisible(d.centroid[0], d.centroid[1]))
        : []

      labelsGroup
        .selectAll<SVGTextElement, CountryLabelDatum>('text.lbl-country')
        .data(countryData, (d) => d.iso)
        .join('text')
        .attr('class', 'lbl-country')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', projectionType === 'orthographic' ? '6' : '8')
        .attr('font-family', 'sans-serif')
        .attr('fill', LABEL_FILL)
        .attr('transform', (d) => {
          const c = projection(d.centroid)
          if (!c) return 'translate(-9999,-9999)'
          return `translate(${c[0]},${c[1]})`
        })
        .text((d) => d.zone.nameFR)
    }

    function _renderAll() {
      renderCountryZones()
      renderGeoPoints()
      renderPoints()
      renderArcs()
      renderLabels()
    }

    renderAll = _renderAll

    // Clicking anywhere on the SVG that isn't a named element (e.g. the gray
    // area around the sphere in orthographic mode) clears focus. Marker click
    // handlers call stopPropagation so they never reach here.
    svg.on('click', () => { if (focused) { focused = null; _renderAll() } })

    renderCountryZones()
    renderGeoPoints()
    renderPoints()
    renderArcs()

    if (projectionType === 'orthographic') {
      svgEl.addEventListener('wheel', (event) => {
        event.preventDefault()
        const current = projection.scale()
        const next = Math.max(100, Math.min(RADIUS * 8, current * (1 - event.deltaY * 0.001)))
        projection.scale(next)
        svg.select('.ocean').attr('r', next)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        svg.select('.land').attr('d', pathGen as any)
        _renderAll()
      }, { passive: false })

      let dragStart: [number, number] = [0, 0]
      let dragOriginRotate: [number, number, number] = [0, 0, 0]
      svg.call(
        (d3.drag() as d3.DragBehavior<SVGSVGElement, unknown, unknown>)
          .on('start', (event) => {
            dragStart = [event.x, event.y]
            dragOriginRotate = [...projection.rotate()] as [number, number, number]
            tooltip = null; hoveredKey = null; hoveredIso = null
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
            _renderAll()
          })
      )
    }
  })
</script>

<div bind:this={rootEl} class="relative w-full h-full select-none">
  <svg
    bind:this={svgEl}
    viewBox="0 0 {viewW} {viewH}"
    preserveAspectRatio="xMidYMid meet"
    class="w-full h-full {projectionType === 'orthographic' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}"
  ></svg>

  <!-- Bottom focus panel -->
  {#if focused}
    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-sm px-4">
      <div class="bg-white/95 dark:bg-gray-900/95 border border-black/10 dark:border-white/10 rounded-xl shadow-xl backdrop-blur-sm">
        <div class="flex items-center gap-3 px-4 py-3">
          <!-- Name + count -->
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-sm text-gray-900 dark:text-white leading-snug truncate">{focused.label}</div>
            {#if focused.sublabel}
              <div class="text-xs text-gray-500 dark:text-gray-400 truncate">{focused.sublabel}</div>
            {/if}
            <div class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{focused.count} record{focused.count !== 1 ? 's' : ''}</div>
          </div>
          <!-- Open button -->
          <button
            type="button"
            onclick={() => onselect(focused!.selectItems, focused!.selectLabel)}
            class="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:opacity-80 transition-opacity"
          >
            Open
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Tooltip (hidden while focused) -->
  {#if tooltip}
    <div
      class="fixed z-50 pointer-events-none bg-white/95 text-gray-900 dark:bg-gray-900/95 dark:text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-56 border border-black/10 dark:border-white/10"
      style="left: {tooltip.x + 14}px; top: {tooltip.y - 10}px"
    >
      {#if tooltip.kind === 'globe'}
        <div class="font-semibold leading-snug mb-1">{tooltip.point.institution || 'Unknown institution'}</div>
        {#if tooltip.point.city || tooltip.point.country}
          <div class="text-gray-700 dark:text-gray-300">{[tooltip.point.city, tooltip.point.country].filter(Boolean).join(', ')}</div>
        {/if}
        {#if tooltip.point.programme}
          <div class="text-gray-500 dark:text-gray-400 mt-0.5">{tooltip.point.programme}</div>
        {/if}
        <div class="text-gray-500 dark:text-gray-400 mt-0.5">{tooltip.point.type === 'mobilites' ? 'Mobilités' : 'Hors mobilités'}</div>
      {:else if tooltip.kind === 'geo'}
        <div class="font-semibold leading-snug">{tooltip.point.name}</div>
        {#if tooltip.point.country}
          <div class="text-black/50 dark:text-white/50 mb-1">{tooltip.point.country}</div>
        {/if}
        {#if tooltip.point.titles.length > 0}
          <ul class="space-y-1.5 mt-1 border-t border-black/10 dark:border-white/10 pt-1.5">
            {#each tooltip.point.titles.slice(0, 6) as t}
              <li class="leading-snug">
                {#if t.person}<div class="font-semibold text-gray-900 dark:text-white">{t.person}</div>{/if}
                <div class="text-gray-900 dark:text-white font-normal">{t.title}</div>
              </li>
            {/each}
            {#if tooltip.point.titles.length > 6}
              <li class="text-black/40 dark:text-white/40">+{tooltip.point.titles.length - 6} more</li>
            {/if}
          </ul>
        {/if}
      {:else}
        <div class="font-semibold leading-snug">{tooltip.zone.nameEN}</div>
        <div class="text-black/50 dark:text-white/50 mb-1">{tooltip.zone.nameFR}</div>
        {#if tooltip.zone.titles.length > 0}
          <ul class="space-y-1.5 mt-1 border-t border-black/10 dark:border-white/10 pt-1.5">
            {#each tooltip.zone.titles.slice(0, 6) as t}
              <li class="leading-snug">
                {#if t.person}<div class="font-semibold text-gray-900 dark:text-white">{t.person}</div>{/if}
                <div class="text-gray-900 dark:text-white font-normal">{t.title}</div>
              </li>
            {/each}
            {#if tooltip.zone.titles.length > 6}
              <li class="text-black/40 dark:text-white/40">+{tooltip.zone.titles.length - 6} more</li>
            {/if}
          </ul>
        {/if}
      {/if}
    </div>
  {/if}
</div>
