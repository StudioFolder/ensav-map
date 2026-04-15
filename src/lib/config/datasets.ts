/**
 * ENSAV Interactive Map — Canonical Dataset Configuration
 *
 * Single source of truth for all dataset-related metadata: keys, labels,
 * table IDs, hrefs, display order, field names, and searchable fields.
 *
 * Replaces seven scattered copies across nocodb.ts, api.ts, search/index.ts,
 * +page.svelte, +page.server.ts, and the four visualisation components.
 * Field renames for the Directus migration now touch only this file.
 */

// ---------------------------------------------------------------------------
// Key type
// ---------------------------------------------------------------------------

export type DatasetKey =
  | 'memoires'
  | 'pfe'
  | 'p45'
  | 'pfe_france'
  | 'theses'
  | 'partenariats_mobilites'
  | 'partenariats_hors_mobilites'

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

export interface DatasetConfig {
  key: DatasetKey
  label: string              // human-readable display name
  href: string               // route path, e.g. "/memoires"
  tableId: string            // NocoDB table ID
  nocodbUrl: string          // direct link to this table in the NocoDB dashboard
  order: number              // sidebar + continent column display order
  kind: 'travaux' | 'partenariat'
  labelField: string         // which field is the record's display title
  searchFields: string[]     // fields concatenated for Fuse.js

  // Travaux only (omitted on partenariats)
  locationFields?: string[]   // city + institution location fields
  countryFields?: string[]    // Country N fields (empty array for pfe_france)
  personField?: string        // primary person field (buildTitleMap, buildContinentGroups)
  studentFields?: string[]    // all student fields for buildPersonGroups
  supervisorFields?: string[] // all supervisor fields for buildPersonGroups
  yearField?: string          // date field used by buildTimelineRecords

  /**
   * Timeline ordering. When set, this dataset is rendered on the timeline view;
   * lower numbers are processed first by the tetris beeswarm (earlier datasets
   * settle at the bottom of the blob). When undefined, the dataset is excluded
   * from the timeline (e.g. partenariats, which have no dates).
   */
  timelineOrder?: number
}

// ---------------------------------------------------------------------------
// Canonical dataset definitions
// ---------------------------------------------------------------------------

export const DATASETS: Record<DatasetKey, DatasetConfig> = {
  memoires: {
    key: 'memoires',
    label: 'Mémoires',
    href: '/memoires',
    tableId: 'mt6j703j50c0jii',
    nocodbUrl: 'https://nocodb.studiofolder.synology.me/wzxz1brh/pnsjzr9v75ibh5v/mt6j703j50c0jii/vwz7jk5kr8xubi85/travaux_memoires_csv-full-table',
    order: 5,
    kind: 'travaux',
    labelField: 'Title',
    searchFields: [
      'Title', 'Student 1', 'Student 2', 'Student 3',
      'City 1', 'City 2', 'City 3', 'City 4',
      'Country 1', 'Country 2', 'Country 3', 'Country 4',
      'Region', 'Landmark', 'Institution',
    ],
    locationFields: ['City 1', 'City 2', 'City 3', 'City 4', 'Institution', 'Institution (full name)'],
    countryFields: ['Country 1', 'Country 2', 'Country 3', 'Country 4'],
    personField: 'Student 1',
    studentFields: ['Student 1', 'Student 2', 'Student 3'],
    supervisorFields: ['Supervisor 1', 'Supervisor 2', 'Supervisor 3'],
    yearField: 'Publication year',
    timelineOrder: 2,
  },

  pfe: {
    key: 'pfe',
    label: 'PFE',
    href: '/pfe',
    tableId: 'myxjt6b6thw1w6h',
    nocodbUrl: 'https://nocodb.studiofolder.synology.me/wzxz1brh/pnsjzr9v75ibh5v/myxjt6b6thw1w6h/vwosjbmu2sel62ey/travaux_pfe_csv-full-table',
    order: 3,
    kind: 'travaux',
    labelField: 'Title',
    searchFields: [
      'Title', 'Student 1', 'Student 2', 'Student 3',
      'City 1', 'City 2', 'City 3', 'City 4',
      'Country 1', 'Country 2', 'Country 3', 'Country 4',
      'Region', 'Landmark', 'Institution',
    ],
    locationFields: ['City 1', 'City 2', 'City 3', 'City 4', 'Institution', 'Institution (full name)'],
    countryFields: ['Country 1', 'Country 2', 'Country 3', 'Country 4'],
    personField: 'Student 1',
    studentFields: ['Student 1', 'Student 2', 'Student 3'],
    supervisorFields: ['Supervisor 1', 'Supervisor 2', 'Supervisor 3'],
    // pfe uses 'Start date' (ISO YYYY-MM-DD) for month precision — not a simple year field
    timelineOrder: 1,
  },

  p45: {
    key: 'p45',
    label: 'P45',
    href: '/p45',
    tableId: 'm9uq4llif897juk',
    nocodbUrl: 'https://nocodb.studiofolder.synology.me/wzxz1brh/pnsjzr9v75ibh5v/m9uq4llif897juk/vwm9ot875ob94rch/travaux_p45_csv-full-table',
    order: 6,
    kind: 'travaux',
    labelField: 'Title',
    searchFields: [
      'Title', 'Supervisor 1', 'Supervisor 2', 'Supervisor 3',
      'City 1', 'City 2', 'City 3', 'City 4',
      'Country 1', 'Country 2', 'Country 3', 'Country 4',
      'Region', 'Institution',
    ],
    locationFields: ['City 1', 'City 2', 'City 3', 'City 4', 'Institution'],
    countryFields: ['Country 1', 'Country 2', 'Country 3', 'Country 4'],
    personField: 'Supervisor 1',
    studentFields: ['Student 1', 'Student 2', 'Student 3'],
    supervisorFields: ['Supervisor 1', 'Supervisor 2', 'Supervisor 3'],
    timelineOrder: 0,
  },

  pfe_france: {
    key: 'pfe_france',
    label: 'PFE France 2025',
    href: '/pfe-france',
    tableId: 'm7tfs4aum2ohwo8',
    nocodbUrl: 'https://nocodb.studiofolder.synology.me/wzxz1brh/pnsjzr9v75ibh5v/m7tfs4aum2ohwo8/vwvbsp6kfqpo8l7q/travaux_pfe_france_2025_csv-full-table',
    order: 4,
    kind: 'travaux',
    labelField: 'Title',
    searchFields: [
      'Title', 'Student 1', 'Student 2', 'Student 3',
      'Supervisor 1', 'Supervisor 2', 'Supervisor 3',
      'City', 'Region', 'Département', 'Landmark', 'Neighbourhood',
    ],
    locationFields: ['City'],
    countryFields: [],
    personField: 'Student 1',
    studentFields: ['Student 1', 'Student 2', 'Student 3'],
    supervisorFields: ['Supervisor 1', 'Supervisor 2', 'Supervisor 3'],
    yearField: 'Publication year',
    timelineOrder: 3,
  },

  theses: {
    key: 'theses',
    label: 'Thèses',
    href: '/theses',
    tableId: 'msh87e3y3cw8lf9',
    nocodbUrl: 'https://nocodb.studiofolder.synology.me/wzxz1brh/pnsjzr9v75ibh5v/msh87e3y3cw8lf9/vwn61yb9orc3i8xa/travaux_theses_csv-full-table',
    order: 7,
    kind: 'travaux',
    labelField: 'Title',
    searchFields: [
      'Title', 'Student 1', 'Student 2', 'Student 3',
      'City 1', 'City 2', 'City 3', 'City 4',
      'Country 1', 'Country 2', 'Country 3', 'Country 4',
      'Region', 'Institution',
    ],
    locationFields: ['City 1', 'City 2', 'City 3', 'City 4', 'Institution'],
    countryFields: ['Country 1', 'Country 2', 'Country 3', 'Country 4'],
    personField: 'Student 1',
    studentFields: ['Student 1', 'Student 2', 'Student 3'],
    supervisorFields: ['Supervisor 1', 'Supervisor 2', 'Supervisor 3'],
    timelineOrder: 4,
  },

  partenariats_mobilites: {
    key: 'partenariats_mobilites',
    label: 'Partenariats (Mobilités)',
    href: '/partenariats-mobilites',
    tableId: 'mfwhde177w9pngp',
    nocodbUrl: 'https://nocodb.studiofolder.synology.me/wzxz1brh/pnsjzr9v75ibh5v/mfwhde177w9pngp/vwbooa8uw08q0nq0/partenariats_with-student-mobility-full-table',
    order: 1,
    kind: 'partenariat',
    labelField: 'Institution',
    searchFields: ['Institution', 'Institution (full name)', 'City', 'Country'],
  },

  partenariats_hors_mobilites: {
    key: 'partenariats_hors_mobilites',
    label: 'Partenariats (Hors mobilités)',
    href: '/partenariats-hors-mobilites',
    tableId: 'mij6x105uwomp41',
    nocodbUrl: 'https://nocodb.studiofolder.synology.me/wzxz1brh/pnsjzr9v75ibh5v/mij6x105uwomp41/vwvfjc58ahsgx3j9/partenariats_without-student-mobility-full-table',
    order: 2,
    kind: 'partenariat',
    labelField: 'Institution',
    searchFields: ['Institution', 'Institution (full name)', 'City', 'Country'],
  },
}

// ---------------------------------------------------------------------------
// Convenience exports derived from DATASETS
// ---------------------------------------------------------------------------

/** All dataset keys sorted by display order. Drop-in for the old ORDER array. */
export const DATASET_KEYS: DatasetKey[] = (Object.keys(DATASETS) as DatasetKey[])
  .sort((a, b) => DATASETS[a].order - DATASETS[b].order)

/** Human-readable labels keyed by dataset key. */
export const DATASET_LABELS: Record<DatasetKey, string> = Object.fromEntries(
  (Object.keys(DATASETS) as DatasetKey[]).map((k) => [k, DATASETS[k].label])
) as Record<DatasetKey, string>

/** NocoDB table IDs keyed by dataset key. Re-exported from nocodb.ts for back-compat. */
export const TABLE_IDS: Record<DatasetKey, string> = Object.fromEntries(
  (Object.keys(DATASETS) as DatasetKey[]).map((k) => [k, DATASETS[k].tableId])
) as Record<DatasetKey, string>

/**
 * Dataset keys rendered on the timeline view, ordered by timelineOrder
 * (lower = processed first by the tetris beeswarm = settles at the bottom).
 * Derived from DATASETS so a single edit in the config propagates everywhere.
 */
export const TIMELINE_DATASET_KEYS: DatasetKey[] = (Object.keys(DATASETS) as DatasetKey[])
  .filter(k => DATASETS[k].timelineOrder !== undefined)
  .sort((a, b) => DATASETS[a].timelineOrder! - DATASETS[b].timelineOrder!)

/** Look up a dataset config by key. Throws if key is not found (should never happen). */
export function getDataset(key: DatasetKey): DatasetConfig {
  return DATASETS[key]
}

// ---------------------------------------------------------------------------
// NocoDB internal fields — excluded from user-facing record display
// ---------------------------------------------------------------------------

export const NOCODB_INTERNAL_FIELDS: ReadonlySet<string> =
  new Set(['Id', 'nc_order', 'CreatedAt', 'UpdatedAt'])
