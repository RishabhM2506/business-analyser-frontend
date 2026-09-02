<script setup lang="ts">
// Per-partner CAGR/coefficient-of-variation (2026-09-02, Step 4 hardening,
// Concern 1) — `Facts.cagr_by_partner`/`volatility_by_partner` are keyed
// by the raw partner_country_code, joined here against `annual_series`'
// own already-resolved display names (via `partner_country_code`, added
// alongside `country` for exactly this join). Only partners with at least
// one real computable metric are shown - a partner with both null adds
// nothing (Concern 1's "use what's available", not "show every row
// regardless").
import { computed } from 'vue'

import { formatCagr, formatVolatility } from '@/components/report/reportValueFormat'
import type { AnnualSeriesYear } from '@/types/generated'

const props = defineProps<{
  annualSeries: AnnualSeriesYear[]
  cagrByPartner: Record<string, number | null>
  volatilityByPartner: Record<string, number | null>
}>()

// This module's own reasoned starting point for "volatile enough to flag"
// - mirrors `app.analytics.timeseries_math.HIGH_VOLATILITY_COV_THRESHOLD`
// (the real source of truth, backend) exactly; not independently
// validated here, same flagged-not-derived status as that constant's own
// docstring.
const HIGH_VOLATILITY_COV_THRESHOLD = 1.0

interface PartnerGrowthRow {
  code: string
  country: string
  cagr: number | null
  volatility: number | null
}

const rows = computed<PartnerGrowthRow[]>(() => {
  const names = new Map<string, string>()
  for (const year of props.annualSeries) {
    for (const partner of year.partners) {
      if (!names.has(partner.partner_country_code)) {
        names.set(partner.partner_country_code, partner.country)
      }
    }
  }
  return [...names.entries()]
    .map(([code, country]) => ({
      code,
      country,
      cagr: props.cagrByPartner[code] ?? null,
      volatility: props.volatilityByPartner[code] ?? null,
    }))
    .filter((row) => row.cagr !== null || row.volatility !== null)
    .sort((a, b) => (b.volatility ?? -1) - (a.volatility ?? -1))
})
</script>

<template>
  <div v-if="rows.length > 0" class="growth">
    <div class="growth__scroll">
      <table class="growth__table">
        <caption class="visually-hidden">
          Per-partner compound annual growth rate and volatility
        </caption>
        <thead>
          <tr>
            <th scope="col">Partner</th>
            <th scope="col">CAGR</th>
            <th scope="col">Volatility</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.code">
            <th scope="row">{{ row.country }}</th>
            <td>{{ formatCagr(row.cagr) }}</td>
            <td>
              {{ formatVolatility(row.volatility) }}
              <span
                v-if="row.volatility !== null && row.volatility > HIGH_VOLATILITY_COV_THRESHOLD"
                class="growth__badge"
                >High</span
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.growth__scroll {
  overflow-x: auto;
}

.growth__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.growth__table th,
.growth__table td {
  text-align: left;
  padding: var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

/* Reuses --color-danger/-bg, not an invented "warning" token - same
 * verified-in-both-themes precedent TradeTable.vue's identical badge
 * already relies on. */
.growth__badge {
  display: inline-block;
  margin-left: var(--space-2);
  padding: 0 var(--space-2);
  border-radius: var(--radius-full);
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}
</style>
