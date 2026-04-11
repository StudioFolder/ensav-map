import type { DatasetKey } from '$lib/config/datasets'

// ---------------------------------------------------------------------------
// Group taxonomy
// ---------------------------------------------------------------------------

export type FieldGroupKey = 'titles' | 'people' | 'cities' | 'countries' | 'regions' | 'institutions'

export const GROUP_ORDER: FieldGroupKey[] = [
  'titles',
  'people',
  'cities',
  'countries',
  'regions',
  'institutions',
]

export const GROUP_LABELS: Record<FieldGroupKey, string> = {
  titles: 'Titles',
  people: 'People',
  cities: 'Cities',
  countries: 'Countries',
  regions: 'Regions',
  institutions: 'Institutions',
}

// ---------------------------------------------------------------------------
// Per-dataset fields that feed each group
// ---------------------------------------------------------------------------

/**
 * Maps each group key to the fields (per dataset) whose values feed that group.
 * The search function iterates this map rather than hard-coding field names inline,
 * so adding a new dataset or renaming a field only requires editing here.
 *
 * Ordering within a dataset's array matters for institutions: full-name variant
 * must come first so the canonical display value is the longer form.
 */
export const GROUP_FIELDS: Record<FieldGroupKey, Partial<Record<DatasetKey, string[]>>> = {
  titles: {
    memoires: ['Title'],
    pfe: ['Title'],
    p45: ['Title'],
    pfe_france: ['Title'],
    theses: ['Title'],
  },

  people: {
    memoires: ['Student 1', 'Student 2', 'Student 3', 'Supervisor 1', 'Supervisor 2', 'Supervisor 3'],
    pfe: ['Student 1', 'Student 2', 'Student 3', 'Supervisor 1', 'Supervisor 2', 'Supervisor 3'],
    p45: ['Student 1', 'Student 2', 'Student 3', 'Supervisor 1', 'Supervisor 2', 'Supervisor 3'],
    pfe_france: ['Student 1', 'Student 2', 'Student 3', 'Supervisor 1', 'Supervisor 2', 'Supervisor 3'],
    theses: ['Student 1', 'Student 2', 'Student 3', 'Supervisor 1', 'Supervisor 2', 'Supervisor 3'],
  },

  cities: {
    memoires: ['City 1', 'City 2', 'City 3', 'City 4'],
    pfe: ['City 1', 'City 2', 'City 3', 'City 4'],
    p45: ['City 1', 'City 2', 'City 3', 'City 4'],
    pfe_france: ['City'],
    theses: ['City 1', 'City 2', 'City 3', 'City 4'],
    partenariats_mobilites: ['City'],
    partenariats_hors_mobilites: ['City'],
  },

  countries: {
    memoires: ['Country 1', 'Country 2', 'Country 3', 'Country 4'],
    pfe: ['Country 1', 'Country 2', 'Country 3', 'Country 4'],
    p45: ['Country 1', 'Country 2', 'Country 3', 'Country 4'],
    theses: ['Country 1', 'Country 2', 'Country 3', 'Country 4'],
    partenariats_mobilites: ['Country'],
    partenariats_hors_mobilites: ['Country'],
  },

  // Region, Département, Neighbourhood, Landmark — whichever each dataset has
  regions: {
    memoires: ['Region', 'Landmark'],
    pfe: ['Region', 'Landmark'],
    p45: ['Region'],
    pfe_france: ['Region', 'Département', 'Neighbourhood', 'Landmark'],
    theses: ['Region'],
  },

  // Full name listed first so the canonical display value prefers the longer form
  institutions: {
    memoires: ['Institution (full name)', 'Institution'],
    pfe: ['Institution (full name)', 'Institution'],
    p45: ['Institution'],
    theses: ['Institution'],
    partenariats_mobilites: ['Institution (full name)', 'Institution'],
    partenariats_hors_mobilites: ['Institution (full name)', 'Institution'],
  },
}
