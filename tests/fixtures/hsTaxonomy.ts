import type { HsTaxonomyEntry } from '@/composables/useHsTaxonomy'

// A small, hand-written slice shaped exactly like public/hs-taxonomy.json's
// real rows (same field names/levels/prefix-nesting rules), standing in for
// the full 6,939-row file in tests. Two categories, each with a level-4
// heading and a couple of level-6 items, mirroring the real data's structure
// (verified against the checked-in file: level-6 `parent` points at the
// level-4 heading, not the level-2 chapter — prefix nesting is what makes
// `getItemsForCategory` work).
export const FIXTURE_TAXONOMY: HsTaxonomyEntry[] = [
  { hs_code: '01', description: 'Animals; live', level: 2, section: 'I', parent: 'TOTAL' },
  {
    hs_code: '0101',
    description: 'Horses, asses, mules and hinnies; live',
    level: 4,
    section: 'I',
    parent: '01',
  },
  {
    hs_code: '010121',
    description: 'Horses; live, pure-bred breeding animals',
    level: 6,
    section: 'I',
    parent: '0101',
  },
  {
    hs_code: '010129',
    description: 'Horses; live, other than pure-bred breeding animals',
    level: 6,
    section: 'I',
    parent: '0101',
  },
  {
    hs_code: '16',
    description: 'Meat, fish etc; preparations thereof',
    level: 2,
    section: 'IV',
    parent: 'TOTAL',
  },
  {
    hs_code: '1601',
    description: 'Sausages and similar products',
    level: 4,
    section: 'IV',
    parent: '16',
  },
  {
    hs_code: '160100',
    description: 'Sausages and similar products, of meat, meat offal or blood',
    level: 6,
    section: 'IV',
    parent: '1601',
  },
]
