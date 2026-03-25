/**
 * ENSAV Interactive Map — Data Model
 *
 * These are the frontend's OWN types. They don't mirror the CMS schema
 * directly — the data-fetching layer (api.ts) maps API responses into
 * these shapes. This means we can change the CMS without touching
 * components that consume this data.
 *
 * Based on the preliminary data model in architecture.md.
 * Will be refined as we explore the source spreadsheets.
 */

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

/** A university, school, or partner organization. */
export interface Institution {
  id: string
  name: string
  shortName?: string
  country: string
  city: string
  coordinates?: Coordinates
  type: InstitutionType
  /** URL to the institution's website */
  url?: string
}

export type InstitutionType =
  | 'university'
  | 'architecture-school'
  | 'research-lab'
  | 'cultural-institution'
  | 'other'

/** A faculty member, researcher, or partner contact. */
export interface Person {
  id: string
  firstName: string
  lastName: string
  role?: string
  /** The institution this person is primarily affiliated with. */
  affiliationId?: string
  email?: string
}

/**
 * A specific academic activity: P45 workshop, PFE (Projet de Fin d'Études),
 * mémoire, thesis, or research project.
 */
export interface Project {
  id: string
  title: string
  type: ProjectType
  cycle?: AcademicCycle
  /** Academic year, e.g. "2024-2025" */
  academicYear?: string
  startDate?: string
  endDate?: string
  description?: string
  /** People involved (supervisors, leads). */
  personIds: string[]
  /** Institutions involved. */
  institutionIds: string[]
  /** Locations involved (for projects tied to places, not institutions). */
  locationIds: string[]
  /** Link to ArchiRès or other external reference. */
  externalUrl?: string
}

export type ProjectType =
  | 'p45'         // P45 workshop
  | 'pfe'         // Projet de Fin d'Études
  | 'memoire'     // Mémoire
  | 'these'       // Thèse / Doctorat
  | 'research'    // Research collaboration
  | 'other'

export type AcademicCycle =
  | 'licence'     // L1-L3
  | 'master'      // M1-M2
  | 'doctorat'    // PhD

/**
 * A formal agreement between ENSAV and a partner institution —
 * ERASMUS, bilateral convention, etc.
 */
export interface Partnership {
  id: string
  /** The partner institution (ENSAV is always the other side). */
  institutionId: string
  type: PartnershipType
  /** Academic year the partnership starts, e.g. "2024-2025" */
  startYear?: string
  /** Academic year the partnership ends. Omitted if ongoing. */
  endYear?: string
  /** Number of student places available per year. */
  places?: number
  /** Duration of mobility in months. */
  durationMonths?: number
  /** Study cycle(s) covered by the agreement. */
  cycles?: AcademicCycle[]
  /** Any conditions or notes. */
  notes?: string
}

export type PartnershipType =
  | 'erasmus'
  | 'bilateral'
  | 'convention'
  | 'other'

/**
 * A geographic reference point. Separated from Institution because
 * some projects are tied to places (a city, a region, a site) rather
 * than to a specific institution.
 */
export interface Location {
  id: string
  country: string
  region?: string
  city?: string
  coordinates: Coordinates
  /** Optional label for display (e.g. a site name). */
  label?: string
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface Coordinates {
  lat: number
  lng: number
}

// ---------------------------------------------------------------------------
// Collections (what the API returns)
// ---------------------------------------------------------------------------

/** The full dataset, as fetched and assembled by the data layer. */
export interface EnsavData {
  institutions: Institution[]
  people: Person[]
  projects: Project[]
  partnerships: Partnership[]
  locations: Location[]
}
