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

const provisionalYears = computed(() =>
  props.table.years.filter((year) => !props.table.years_finalized.includes(year)),
)

function isFinalized(year: number): boolean {
  return props.table.years_finalized.includes(year)
}
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
                {{ year }}<sup v-if="!isFinalized(year)" aria-hidden="true">*</sup>
                <span v-if="!isFinalized(year)" class="visually-hidden">(provisional)</span>
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

.trade-table__scroll {
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
