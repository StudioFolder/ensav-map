/**
 * ENSAV Interactive Map — Data Fetching Layer
 *
 * This module is the ONLY place that knows about the CMS API.
 * It fetches raw data from Directus and maps it into the frontend's
 * own types (defined in types.ts).
 *
 * If the CMS changes, only this file needs to be updated.
 *
 * For now, this is a skeleton with:
 * - The API client setup
 * - Placeholder mapper functions (to be filled in once we define
 *   the Directus collections)
 * - A mock data option for developing without the CMS running
 */

import { env } from '$env/dynamic/public'

import type {
  Institution,
  Person,
  Project,
  Partnership,
  Location,
  EnsavData,
} from './types'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = env.PUBLIC_API_URL ?? 'http://localhost:8055'

// ---------------------------------------------------------------------------
// Generic fetch helper
// ---------------------------------------------------------------------------

async function fetchFromAPI<T>(endpoint: string): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `API error: ${response.status} ${response.statusText} (${url})`
    )
  }

  const json = await response.json()
  // Directus wraps collection responses in { data: [...] }
  return json.data as T
}

// ---------------------------------------------------------------------------
// Mappers — transform Directus records into our types
//
// These are intentionally explicit. Each function takes a raw API record
// and returns one of our typed objects. When the Directus schema is set up,
// we'll fill in the field mappings here.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInstitution(raw: any): Institution {
  return {
    id: String(raw.id),
    name: raw.name ?? '',
    shortName: raw.short_name ?? undefined,
    country: raw.country ?? '',
    city: raw.city ?? '',
    coordinates:
      raw.latitude != null && raw.longitude != null
        ? { lat: Number(raw.latitude), lng: Number(raw.longitude) }
        : undefined,
    type: raw.type ?? 'other',
    url: raw.url ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPerson(raw: any): Person {
  return {
    id: String(raw.id),
    firstName: raw.first_name ?? '',
    lastName: raw.last_name ?? '',
    role: raw.role ?? undefined,
    affiliationId: raw.affiliation ? String(raw.affiliation) : undefined,
    email: raw.email ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProject(raw: any): Project {
  return {
    id: String(raw.id),
    title: raw.title ?? '',
    type: raw.type ?? 'other',
    cycle: raw.cycle ?? undefined,
    academicYear: raw.academic_year ?? undefined,
    startDate: raw.start_date ?? undefined,
    endDate: raw.end_date ?? undefined,
    description: raw.description ?? undefined,
    personIds: (raw.people ?? []).map(String),
    institutionIds: (raw.institutions ?? []).map(String),
    locationIds: (raw.locations ?? []).map(String),
    externalUrl: raw.external_url ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPartnership(raw: any): Partnership {
  return {
    id: String(raw.id),
    institutionId: raw.institution ? String(raw.institution) : '',
    type: raw.type ?? 'other',
    startYear: raw.start_year ?? undefined,
    endYear: raw.end_year ?? undefined,
    places: raw.places != null ? Number(raw.places) : undefined,
    durationMonths:
      raw.duration_months != null ? Number(raw.duration_months) : undefined,
    cycles: raw.cycles ?? undefined,
    notes: raw.notes ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLocation(raw: any): Location {
  return {
    id: String(raw.id),
    country: raw.country ?? '',
    region: raw.region ?? undefined,
    city: raw.city ?? undefined,
    coordinates: {
      lat: Number(raw.latitude ?? 0),
      lng: Number(raw.longitude ?? 0),
    },
    label: raw.label ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchInstitutions(): Promise<Institution[]> {
  const raw = await fetchFromAPI<unknown[]>('/items/institutions?limit=-1')
  return raw.map(mapInstitution)
}

export async function fetchPeople(): Promise<Person[]> {
  const raw = await fetchFromAPI<unknown[]>('/items/people?limit=-1')
  return raw.map(mapPerson)
}

export async function fetchProjects(): Promise<Project[]> {
  const raw = await fetchFromAPI<unknown[]>('/items/projects?limit=-1')
  return raw.map(mapProject)
}

export async function fetchPartnerships(): Promise<Partnership[]> {
  const raw = await fetchFromAPI<unknown[]>('/items/partnerships?limit=-1')
  return raw.map(mapPartnership)
}

export async function fetchLocations(): Promise<Location[]> {
  const raw = await fetchFromAPI<unknown[]>('/items/locations?limit=-1')
  return raw.map(mapLocation)
}

/**
 * Fetch the entire dataset in parallel.
 * This is the main entry point for views that need all the data.
 */
export async function fetchAllData(): Promise<EnsavData> {
  const [institutions, people, projects, partnerships, locations] =
    await Promise.all([
      fetchInstitutions(),
      fetchPeople(),
      fetchProjects(),
      fetchPartnerships(),
      fetchLocations(),
    ])

  return { institutions, people, projects, partnerships, locations }
}
