<script setup lang="ts">
// Structured render only — never v-html on this data (master brief §8,
// docs/CONVENTIONS.md security posture). Every cell comes straight from the
// backend's TradeTable/CountryRow structured JSON; the only transformation
// applied is *display* formatting (currency grouping via formatTradeValue) —
// no value is recomputed, derived, or interpolated.
import { computed } from 'vue'

import type { CountryRow, TradeTable } from '@/types/generated'

import { formatTradeValue } from './tradeValueFormat'

const props = defineProps<{ title: string; table: TradeTable }>()

// Rendering order follows the backend-assigned `rank`, not array order —
// the schema doesn't guarantee `rows` arrives pre-sorted (docs/PLAN.md §3.2
// only guarantees each row *carries* a rank). Sorting by an already-given
// field is presentation ordering, not deriving a new value.
const sortedRows = computed<CountryRow[]>(() =>
  [...props.table.rows].sort((a, b) => a.rank - b.rank),
)

// Finding M21/PBO-03: a year outside `years_finalized` used to be treated
// as uniformly "provisional — not yet finalized", which is actively
// misleading for a year with zero records at all (commonly because this
// HS6 code didn't exist yet in that year's HS nomenclature edition — there
// is nothing to finalize, ever). `years_no_data` isolates that case on the
// backend; the two sets are disjoint by construction there, so a year is
// "provisional" here iff it's neither finalized nor no-data.
const noDataYears = computed(() => props.table.years_no_data ?? [])

const provisionalYears = computed(() =>
  props.table.years.filter(
    (year) => !props.table.years_finalized.includes(year) && !noDataYears.value.includes(year),
  ),
)

function isFinalized(year: number): boolean {
  return props.table.years_finalized.includes(year)
}

function isNoData(year: number): boolean {
  return noDataYears.value.includes(year)
}

function isProvisional(year: number): boolean {
  return !isFinalized(year) && !isNoData(year)
}

// Phase 4 finding M23/PBO-05: the "—" marker is mechanically correct (a
// reported zero and a true gap are never conflated — see tradeValueFormat.ts)
// but had no on-screen explanation anywhere, unlike the provisional-years
// footnote right above this one. A reader's natural, unguided reading of a
// dash in a numbers table is "zero," which is exactly the misreading the
// master brief says must never happen.
const hasMissingData = computed(() =>
  props.table.rows.some((row) => Object.values(row.values_by_year).some((value) => value === null)),
)
</script>

<template>
  <section class="trade-table">
    <h3 class="trade-table__title">{{ title }}</h3>

    <p v-if="table.rows.length === 0" class="trade-table__empty">
      No {{ title.toLowerCase() }} data available for this item in the selected period.
    </p>

    <template v-else>
      <div class="trade-table__scroll">
        <table class="trade-table__table">
          <caption class="visually-hidden">
            {{
              title
            }}
            — top
            {{
              table.rows.length
            }}
            partner countries,
            {{
              table.years[0]
            }}–{{
              table.years[table.years.length - 1]
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Country</th>
              <th v-for="year in table.years" :key="year" scope="col" class="trade-table__value">
                {{ year }}<sup v-if="isProvisional(year)" aria-hidden="true">*</sup>
                <sup v-if="isNoData(year)" aria-hidden="true">&dagger;</sup>
                <span v-if="isProvisional(year)" class="visually-hidden">(provisional)</span>
                <span v-if="isNoData(year)" class="visually-hidden">(no data recorded)</span>
              </th>
              <th scope="col" class="trade-table__value">5-yr total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sortedRows" :key="row.partner_code">
              <td>{{ row.rank }}</td>
              <td>{{ row.partner_country }}</td>
              <td v-for="year in table.years" :key="year" class="trade-table__value">
                {{ formatTradeValue(row.values_by_year[String(year)]) }}
              </td>
              <td class="trade-table__value">{{ formatTradeValue(row.cumulative_5yr) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="trade-table__footnote">Values in {{ table.unit }}.</p>
      <p v-if="provisionalYears.length > 0" class="trade-table__footnote">
        * Provisional — not yet finalized by the data source: {{ provisionalYears.join(', ') }}.
      </p>
      <p v-if="noDataYears.length > 0" class="trade-table__footnote">
        &dagger; No data recorded for this year: {{ noDataYears.join(', ') }}. This may mean this HS
        classification code did not exist in that year's edition of the HS nomenclature, or that
        nothing has been reported. Unlike a provisional year, this is not expected to be added
        later.
      </p>
      <p v-if="hasMissingData" class="trade-table__footnote">
        "—" means no figure was reported for that country and year — it does not mean zero trade
        occurred.
      </p>
      <p v-if="table.excluded_partner_codes.length > 0" class="trade-table__footnote">
        Aggregate/unspecified partner codes excluded before ranking:
        {{ table.excluded_partner_codes.join(', ') }}.
      </p>
    </template>
  </section>
</template>

<style scoped>
.trade-table {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.trade-table__title {
  margin: 0;
  font-size: var(--font-size-lg);
}

.trade-table__empty {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/*
 * `position: relative` here is load-bearing, not decorative (Phase 4 finding
 * B6/Frontend-QA#2 — real page-level horizontal scroll on mobile, root-caused
 * empirically: DOM measurement + a real scroll gesture confirmed
 * `document.documentElement.scrollWidth` exceeded the viewport even though
 * every element in this table's own layout chain measured clean).
 *
 * Root cause: the `.visually-hidden` <caption> and the per-column
 * "(provisional)" <span> inside a <th> (both `position: absolute`, from
 * styles/base.css) have no positioned ancestor between them and the document
 * root — *without* this rule, their containing block is promoted all the way
 * to the viewport. Their "static position" fallback places them at their
 * natural in-flow X coordinate *within the table's full unclipped width*
 * (this table is not virtualized and lays out at its real content width,
 * e.g. ~900px, even though this box's own `overflow-x: auto` visibly scrolls
 * it down to fit) — for the last column's "(provisional)" span, that can be
 * several hundred px to the right, in *viewport* coordinates, completely
 * bypassing this box's own clipping and leaking into the page's real
 * scrollable overflow. Making this box `position: relative` makes it the
 * containing block for those descendants instead, so their overflow is
 * absorbed by the same box that already correctly clips/scrolls the visible
 * table content. Verified empirically: without this rule,
 * `document.documentElement.scrollWidth` measured 730px against a 375px
 * viewport with ordinary data; with it, 375px (zero page-level overflow),
 * and the table's own internal horizontal scroll is unaffected.
 */
.trade-table__scroll {
  position: relative;
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.trade-table__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.trade-table__table th,
.trade-table__table td {
  padding: var(--space-2) var(--space-3);
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid var(--color-border);
}

.trade-table__table thead th {
  background-color: var(--color-surface);
  font-weight: var(--font-weight-semibold);
}

.trade-table__table tbody tr:last-child td {
  border-bottom: none;
}

.trade-table__value {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.trade-table__footnote {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
