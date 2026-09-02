<script setup lang="ts">
// Structured render only — never v-html on this data (master brief §8,
// docs/CONVENTIONS.md security posture). Every cell comes straight from the
// backend's TradeTable/CountryRow structured JSON; the only transformation
// applied is *display* formatting (currency grouping via formatTradeValue) —
// no value is recomputed, derived, or interpolated.
import { computed } from 'vue'

import type { CountryRow, TradeTable } from '@/types/generated'

import { formatCagr, formatRatio, formatTradeValue } from './tradeValueFormat'

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

// 2026-08-20 roadmap decision (live user-reported finding): a year whose
// Comtrade *fetch itself* failed after every retry attempt is a third,
// distinct case from both `years_finalized`'s complement and
// `years_no_data` — we don't actually know whether real data exists for
// it, only that we couldn't retrieve it just now. Excluded from
// `provisionalYears` below for the same reason `years_no_data` already is:
// "provisional — check back later" is honest advice for genuinely
// still-settling data, not for a fetch failure.
const fetchIssueYears = computed(() => props.table.fetch_issue_years ?? [])

const provisionalYears = computed(() =>
  props.table.years.filter(
    (year) =>
      !props.table.years_finalized.includes(year) &&
      !noDataYears.value.includes(year) &&
      !fetchIssueYears.value.includes(year),
  ),
)

function isFinalized(year: number): boolean {
  return props.table.years_finalized.includes(year)
}

function isNoData(year: number): boolean {
  return noDataYears.value.includes(year)
}

function isFetchIssue(year: number): boolean {
  return fetchIssueYears.value.includes(year)
}

function isProvisional(year: number): boolean {
  return !isFinalized(year) && !isNoData(year) && !isFetchIssue(year)
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

// 2026-09-02, Step 3 hardening (Concern 1: "preserve the denominator") —
// rendered as its own row, styled distinctly, never counted toward
// `rows.length` in the caption/title (it isn't a ranked partner).
const restOfWorld = computed(() => props.table.rest_of_world ?? null)

// Only surfaced when at least one year actually has a real reconciliation
// verdict to report — a table with no `world_total_comtrade` data at all
// (e.g. an older/stale fixture) must not show a misleading blank check.
const reconciliationMismatchYears = computed(() => {
  const reconciles = props.table.world_total_reconciles ?? {}
  return Object.entries(reconciles)
    .filter(([, value]) => value === false)
    .map(([year]) => year)
    .sort()
})
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
                <sup v-if="isFetchIssue(year)" aria-hidden="true">&Dagger;</sup>
                <span v-if="isProvisional(year)" class="visually-hidden">(provisional)</span>
                <span v-if="isNoData(year)" class="visually-hidden">(no data recorded)</span>
                <span v-if="isFetchIssue(year)" class="visually-hidden"
                  >(could not be retrieved)</span
                >
              </th>
              <th scope="col" class="trade-table__value">5-yr total</th>
              <th scope="col" class="trade-table__value">CAGR</th>
              <th scope="col" class="trade-table__value">Volatility</th>
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
              <td class="trade-table__value">{{ formatCagr(row.cagr) }}</td>
              <td class="trade-table__value">
                <span v-if="row.is_high_volatility" class="trade-table__volatility-badge"
                  >High</span
                >
                <span v-else>—</span>
              </td>
            </tr>
            <tr v-if="restOfWorld" class="trade-table__row--rest-of-world">
              <td>{{ restOfWorld.rank }}</td>
              <td>{{ restOfWorld.partner_country }}</td>
              <td v-for="year in table.years" :key="year" class="trade-table__value">
                {{ formatTradeValue(restOfWorld.values_by_year[String(year)]) }}
              </td>
              <td class="trade-table__value">{{ formatTradeValue(restOfWorld.cumulative_5yr) }}</td>
              <td class="trade-table__value">{{ formatCagr(restOfWorld.cagr) }}</td>
              <td class="trade-table__value">
                <span v-if="restOfWorld.is_high_volatility" class="trade-table__volatility-badge"
                  >High</span
                >
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="trade-table__footnote">Values in {{ table.unit }}.</p>
      <p v-if="restOfWorld" class="trade-table__footnote">
        "All Other Countries" sums every real trading partner ranked below the top
        {{ table.rows.length }} shown above, so the table's total still reflects every partner, not
        just the ones listed individually.
      </p>
      <p v-if="table.hhi != null" class="trade-table__footnote">
        Market concentration (HHI): {{ formatRatio(table.hhi) }} — ranges 0 (many equally-sized
        partners) to 1 (a single partner accounts for all trade).
      </p>
      <p
        v-if="reconciliationMismatchYears.length > 0"
        class="trade-table__footnote trade-table__footnote--issue"
      >
        ⚠ The partner totals shown for {{ reconciliationMismatchYears.join(', ') }} do not reconcile
        with UN Comtrade's own reported world total for this product — this can indicate a data
        revision or reporting gap upstream, not necessarily an error in this table.
      </p>
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
      <template v-if="(table.fetch_issues?.length ?? 0) > 0">
        <p class="trade-table__footnote trade-table__footnote--issue">
          &Dagger; Could not be retrieved right now — this doesn't mean the data doesn't exist, only
          that this attempt didn't succeed:
        </p>
        <ul class="trade-table__footnote trade-table__footnote--issue trade-table__issue-list">
          <li v-for="issue in table.fetch_issues" :key="issue">{{ issue }}</li>
        </ul>
      </template>
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
  font-weight: var(--font-weight-bold);
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

.trade-table__table tbody tr {
  transition: background-color 0.1s ease;
}

.trade-table__table tbody tr:hover {
  background-color: var(--color-surface);
}

.trade-table__table tbody tr:last-child td {
  border-bottom: none;
}

.trade-table__value {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Visually distinct from the ranked-partner rows above it (italic, muted) —
 * a synthetic total, not a real trading partner (2026-09-02, Step 3
 * hardening). Matches the "Something else" row's own muted/italic
 * treatment in ProductSearchResults.vue for the same "not a real ranked
 * item" signal. */
.trade-table__row--rest-of-world {
  font-style: italic;
  color: var(--color-text-muted);
}

/* Reuses --color-danger/-bg, not an invented "warning" token — already
 * verified for AA contrast in both themes (tokens.css's own comment,
 * finding M16/Frontend-QA#4). */
.trade-table__volatility-badge {
  display: inline-block;
  padding: 0 var(--space-2);
  border-radius: var(--radius-full);
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  font-style: normal;
}

.trade-table__footnote {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.trade-table__footnote--issue:first-of-type {
  margin-top: var(--space-2);
}

.trade-table__issue-list {
  margin: 0;
  padding-left: var(--space-4);
}

.trade-table__issue-list li {
  margin: 0;
}
</style>
