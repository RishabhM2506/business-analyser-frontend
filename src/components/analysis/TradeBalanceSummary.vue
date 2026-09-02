<script setup lang="ts">
// Net trade (exports minus imports) for the analyzed product, using each
// side's Comtrade-reported world total as the denominator — a plain,
// structured render of `TradeAnalysisResponse.trade_balance`
// (2026-09-02, Step 3 hardening). No value here is recomputed on the
// frontend; every number is the backend's own, only display-formatted.
import { computed } from 'vue'

import type { TradeBalance } from '@/types/generated'

import { formatSignedTradeValue } from './tradeValueFormat'

const props = defineProps<{ tradeBalance: TradeBalance; years: number[] }>()

const hasAnyRealYear = computed(() =>
  props.years.some((year) => props.tradeBalance.by_year[String(year)] != null),
)

// A positive cumulative balance means India exported more of this product
// than it imported over the window shown; negative means the reverse.
// `null` only when every year is `null` (see TradeBalance's own docstring).
const cumulativeLabel = computed(() => {
  const value = props.tradeBalance.cumulative
  if (value == null) {
    return null
  }
  return value >= 0 ? 'net exporter' : 'net importer'
})
</script>

<template>
  <section class="trade-balance">
    <h3 class="trade-balance__title">Trade balance</h3>

    <p v-if="!hasAnyRealYear" class="trade-balance__empty">
      Not enough reported data to compute a trade balance for this item in the selected period.
    </p>

    <template v-else>
      <div class="trade-balance__scroll">
        <table class="trade-balance__table">
          <caption class="visually-hidden">
            Net trade (exports minus imports) by year
          </caption>
          <thead>
            <tr>
              <th v-for="year in years" :key="year" scope="col" class="trade-balance__value">
                {{ year }}
              </th>
              <th scope="col" class="trade-balance__value">Cumulative</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td v-for="year in years" :key="year" class="trade-balance__value">
                {{ formatSignedTradeValue(tradeBalance.by_year[String(year)]) }}
              </td>
              <td class="trade-balance__value">
                {{ formatSignedTradeValue(tradeBalance.cumulative) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="cumulativeLabel" class="trade-balance__footnote">
        A positive figure means India exported more of this product than it imported over this
        window (net {{ cumulativeLabel }}); negative means the reverse.
      </p>
      <p class="trade-balance__footnote">
        Computed from UN Comtrade's own reported world total for each side, not just the partner
        countries shown above — "—" means one side's world total wasn't reported for that year, not
        a zero balance.
      </p>
    </template>
  </section>
</template>

<style scoped>
.trade-balance {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.trade-balance__title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.trade-balance__empty {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.trade-balance__scroll {
  position: relative;
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.trade-balance__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.trade-balance__table th,
.trade-balance__table td {
  padding: var(--space-2) var(--space-3);
  white-space: nowrap;
}

.trade-balance__table thead th {
  background-color: var(--color-surface);
  font-weight: var(--font-weight-semibold);
}

.trade-balance__value {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.trade-balance__footnote {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
