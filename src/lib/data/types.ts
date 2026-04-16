/**
 * ENSAV Interactive Map — Live data types.
 *
 * This file contains the types the app actually imports:
 *   - Raw NocoDB row shapes (Memoire, Pfe, P45, PfeFrance, These, Partenariat).
 *   - Derivation output shapes (GeoPoint, CountryZone, GlobePoint,
 *     ContinentRecord, ContinentGroup, PersonGroup, TimelineRecord).
 *
 * The v2 data model (Institution, Person, Project, Partnership, Location as
 * first-class entities) is documented in `docs/data-model-v2.md`. When the
 * Directus migration lands, `src/lib/data/api.ts` will output those shapes
 * and the raw NocoDB row types below will be retired.
 */

export interface Pfe {
  Id: number
  Title: string
  'Student 1': string | null
  'Student 2': string | null
  'Student 3': string | null
  'Start date': string | null
  'End date': string | null
}

export interface P45 {
  Id: number
  Title: string
  'Supervisor 1': string | null
  'Supervisor 2': string | null
  'Supervisor 3': string | null
  'Start date': string | null
  'End date': string | null
}

export interface PfeFrance {
  Id: number
  Title: string
  'Student 1': string | null
  'Student 2': string | null
  'Student 3': string | null
  'Publication year': string | null
}

export interface These {
  Id: number
  Title: string
  'Student 1': string | null
  'Student 2': string | null
  'Student 3': string | null
  'Start date': string | null
  'End date': string | null
}

export interface Partenariat {
  Id: number
  Type: string | null
  Programme: string | null
  Institution: string | null
  'Institution (full name)': string | null
  City: string | null
  Country: string | null
  'Geographic coordinates': string | null
  'Duration (months)': string | null
  'Places Master ENSAV': string | null
}

export interface GeoPoint {
  name: string
  type: string
  city: string
  province: string
  country: string
  continent: string
  lat: number
  lon: number
  titles: Array<{ title: string; dataset: string; person: string; record: Record<string, unknown> }>
}

export interface CountryZone {
  isoNumeric: string
  nameFR: string
  nameEN: string
  titles: Array<{
    title: string
    dataset: string
    person: string
    record: Record<string, unknown>
  }>
}

export interface GlobePoint {
  lat: number
  lon: number
  institution: string
  city: string
  country: string
  programme: string
  type: 'mobilites' | 'hors_mobilites'
  record: Record<string, unknown>
}

export interface ContinentRecord {
  dataset: string
  label: string
  person: string
  record: Record<string, unknown>
  /**
   * Countries (FR canonical names from geo_areas.csv) that tie this record
   * to its continent. May contain multiple entries when a record's countries
   * span several countries within the same continent (e.g. a memoire about
   * Iberian architecture spanning Spain and Portugal). Empty when the record
   * was attributed to the continent only via the explicit `Continent` field
   * with no resolvable country source — these land in the "Unknown" bucket
   * in the country-grouped view.
   */
  countriesFR: string[]
  /** English equivalents of `countriesFR`, looked up via geo_areas.csv. */
  countriesEN: string[]
}

export interface ContinentGroup {
  nameFR: string   // French name (matches continent values in geo_points/partenariats data)
  nameEN: string   // English name (from geo_areas.csv)
  count: number    // number of records associated with this continent
  partenariatCount: number // subset of `count` that comes from the two partenariats datasets
  partenariatRecords: ContinentRecord[]
  travauxRecords: ContinentRecord[]
}

export interface PersonGroup {
  name: string
  roles: Set<'student' | 'supervisor'>
  records: Array<{
    title: string
    dataset: string
    role: 'student' | 'supervisor'
    record: Record<string, unknown>
  }>
}

export interface TimelineRecord {
  dateValue: number      // fractional year for x positioning, e.g. 2019.75 = Oct 2019
  year: number           // integer year for display
  month?: number         // 1–12, only present when the source has month precision
  endDateValue?: number  // present only for span records (e.g. PFE with both Start and End date)
  endYear?: number
  endMonth?: number
  label: string
  dataset: string
  person: string
  record: Record<string, unknown>
}

export interface Memoire {
  Id: number
  Type: string
  Cycle: string | null
  Title: string
  'Student 1': string | null
  'Student 2': string | null
  'Student 3': string | null
  'Publication year': string | null
  Continent: string | null
  'Country 1': string | null
  'Country 2': string | null
  'Country 3': string | null
  'Country 4': string | null
  Region: string | null
  'City 1': string | null
  'City 2': string | null
  'City 3': string | null
  'City 4': string | null
  Neighbourhood: string | null
  Landmark: string | null
  Institution: string | null
  'Institution (full name)': string | null
  'Reference code': string | null
  'ArchiRes link': string | null
  Status: string | null
  'Review notes': string | null
}
