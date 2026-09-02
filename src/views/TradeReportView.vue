<script setup lang="ts">
// India trade-report pipeline (app/report/facts.py, app/report/narrative.py)
// — 2026-08-25 addition. Additive alongside AnalysisView (which renders
// TradeAnalysisResponse's UN-Comtrade-only view): this view renders the
// fields nothing else does yet — duty verification, mandi price, MSP, and
// international-production context, each carrying an explicit
// OK/NOT_FOUND/NOT_APPLICABLE status rather than a bare number or a blank.
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import DutyVerificationTable from '@/components/report/DutyVerificationTable.vue'
import {
  formatInrPaise,
  formatPercent,
  formatTonnes,
  MISSING_VALUE_DISPLAY,
} from '@/components/report/reportValueFormat'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import QueryControls from '@/components/common/QueryControls.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import { useTradeReportStore } from '@/stores/tradeReport'

const props = defineProps<{ hsCode: string }>()

const store = useTradeReportStore()
const { result, loading, error } = storeToRefs(store)

// `null` = let the backend apply TradeReportQuery's own default
// (app/schemas/query.py: years=5, top_n=10) — mirrors AnalysisView's
// identical pattern for the sibling `/messages` flow.
const years = ref<number | null>(null)
const topN = ref<number | null>(null)

function runQuery(): void {
  void store.fetchReport({
    hs_code: props.hsCode,
    years: years.value ?? undefined,
    top_n: topN.value ?? undefined,
  })
}

onMounted(runQuery)
watch(() => props.hsCode, runQuery)

const facts = computed(() => result.value?.facts ?? null)

// Combined year-by-year metrics table: unit_value_trend and hhi_by_year
// (app/report/facts.py) are both keyed by year over the same window, so one
// table by year reads more coherently than two separate ones — looked up by
// year rather than assumed to be index-aligned, since nothing guarantees
// the two arrays share the same length or ordering.
interface YearMetricsRow {
  year: number
  inrPaisePerKg: string | null
  deltaQtyPct: string | null
  deltaPricePct: string | null
  deltaFxPct: string | null
  hhi: string | null
}

const yearMetrics = computed<YearMetricsRow[]>(() => {
  const f = facts.value
  if (!f) return []
  const years = new Set([
    ...f.unit_value_trend.map((row) => row.year),
    ...f.hhi_by_year.map((row) => row.year),
  ])
  return [...years]
    .sort((a, b) => a - b)
    .map((year) => {
      const unitValue = f.unit_value_trend.find((row) => row.year === year) ?? null
      const hhi = f.hhi_by_year.find((row) => row.year === year) ?? null
      return {
        year,
        inrPaisePerKg: unitValue?.inr_paise_per_kg ?? null,
        deltaQtyPct: unitValue?.delta_qty_pct ?? null,
        deltaPricePct: unitValue?.delta_price_pct ?? null,
        deltaFxPct: unitValue?.delta_fx_pct ?? null,
        hhi: hhi?.hhi ?? null,
      }
    })
})

// `formatPercent` expects a Decimal-as-string; hhi/inr_paise_per_kg are
// already typed that way in generated.ts, no conversion needed here.
function formatHhi(value: string | null): string {
  if (value === null) return MISSING_VALUE_DISPLAY
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toFixed(3) : MISSING_VALUE_DISPLAY
}

// A `NOT_APPLICABLE` section (this commodity isn't agriculture-relevant at
// all, decided once by app.report.source_relevance) is rendered as a single
// quiet note, not three empty-looking cards — the point of the status is to
// say "this question doesn't apply here," not to look like missing data.
const agricultureSectionsApplicable = computed(
  () => facts.value?.mandi_price.status !== 'NOT_APPLICABLE',
)

function statusNote(status: string): string {
  if (status === 'NOT_FOUND') return 'No matching data found in this pipeline yet.'
  return ''
}

// `severity` is one of the app.report.mismatch._severity real values —
// "untrustworthy" (a year-on-year sign flip, §10: flagged regardless of gap
// size), "warning"/"flag" (magnitude-banded gap), "quiet" (below the flag
// threshold) — matched exactly, not guessed at, with a neutral fallback for
// anything else rather than assuming the string always matches one of these.
function severityClass(severity: string): string {
  switch (severity) {
    case 'untrustworthy':
      return 'view__severity--untrustworthy'
    case 'warning':
      return 'view__severity--warning'
    case 'flag':
      return 'view__severity--flag'
    default:
      return 'view__severity--quiet'
  }
}

const headingRef = ref<HTMLHeadingElement | null>(null)
watch(facts, (f) => {
  if (f) {
    void nextTick(() => {
      headingRef.value?.focus()
    })
  }
})
</script>

<template>
  <main class="view">
    <p class="view__breadcrumb">
      <RouterLink :to="{ name: ROUTE_NAMES.ANALYSIS, params: { hsCode: props.hsCode } }">
        ← Back to trade analysis
      </RouterLink>
    </p>

    <LoadingState v-if="loading" message="Fetching product intelligence…" />

    <ErrorState
      v-else-if="error"
      :message="error.message"
      :retryable="error.retryable"
      @retry="runQuery"
    >
      <p v-if="error.isBudgetExceeded" class="view__error-note">
        This limit is shared across all users. Retry may work right away if it was a short-lived
        limit — but if the shared daily limit was reached, it won't reset until tomorrow (UTC).
      </p>
    </ErrorState>

    <template v-else-if="facts && result">
      <div class="view__heading-block">
        <p class="view__eyebrow">HS {{ facts.hs6 }}</p>
        <h1 ref="headingRef" class="view__title" tabindex="-1">Product intelligence</h1>
        <p class="view__product-label">{{ facts.product_label }}</p>
      </div>

      <section class="view__card">
        <h2 class="view__section-title">Query settings</h2>
        <QueryControls
          v-model:years="years"
          v-model:top-n="topN"
          :max-years="8"
          :disabled="loading"
          @apply="runQuery"
        />
      </section>

      <section class="view__card">
        <h2 class="view__section-title">Analysis</h2>
        <p class="view__narrative">{{ result.narrative }}</p>
        <p v-if="result.narrative_source !== 'model'" class="view__narrative-note">
          {{
            result.narrative_source === 'model_retry'
              ? 'Generated on a second attempt after the first was rejected for an ungrounded figure.'
              : 'The model could not produce a fully grounded narrative — this is a deterministic, template-generated summary instead.'
          }}
        </p>
        <p
          v-if="facts.coverage"
          class="view__coverage"
          :class="{ 'view__coverage--degraded': facts.coverage.degraded }"
        >
          Data coverage: {{ facts.coverage.present_cells }} of {{ facts.coverage.expected_cells }}
          expected data cells present
          <span v-if="facts.coverage.degraded" class="view__coverage-flag">— degraded</span>
          <span
            v-if="
              facts.coverage.not_yet_published ||
              facts.coverage.suppressed ||
              facts.coverage.fetch_failed
            "
            class="view__coverage-breakdown"
          >
            ({{
              [
                facts.coverage.not_yet_published
                  ? `${facts.coverage.not_yet_published} not yet published`
                  : null,
                facts.coverage.suppressed ? `${facts.coverage.suppressed} suppressed` : null,
                facts.coverage.fetch_failed ? `${facts.coverage.fetch_failed} fetch failed` : null,
              ]
                .filter(Boolean)
                .join(', ')
            }})
          </span>
        </p>
      </section>

      <section class="view__card">
        <h2 class="view__section-title">Customs duty</h2>
        <DutyVerificationTable
          v-if="facts.landed_cost"
          :landed-cost="facts.landed_cost"
          :as-of-period="facts.landed_cost_as_of_period"
        />
        <EmptyState v-else message="No duty evidence recorded for this product yet." />
      </section>

      <section v-if="yearMetrics.length > 0" class="view__card">
        <h2 class="view__section-title">Unit value &amp; partner concentration by year</h2>
        <div class="view__table-scroll">
          <table class="view__metrics-table">
            <caption class="visually-hidden">
              Year-by-year unit value, quantity/price/FX deltas, and partner concentration (HHI)
            </caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">Unit value</th>
                <th scope="col">Qty Δ</th>
                <th scope="col">Price Δ</th>
                <th scope="col">FX Δ</th>
                <th scope="col">Concentration (HHI)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in yearMetrics" :key="row.year">
                <th scope="row">{{ row.year }}</th>
                <td>
                  {{
                    formatInrPaise(row.inrPaisePerKg === null ? null : Number(row.inrPaisePerKg))
                  }}/kg
                </td>
                <td>{{ formatPercent(row.deltaQtyPct) }}</td>
                <td>{{ formatPercent(row.deltaPricePct) }}</td>
                <td>{{ formatPercent(row.deltaFxPct) }}</td>
                <td>{{ formatHhi(row.hhi) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="facts.mismatch_checks.length > 0" class="view__card">
        <h2 class="view__section-title">Cross-source mismatch checks</h2>
        <p class="view__mismatch-intro">
          Independent government trade-data sources compared for the same real shipments — a
          mismatch is a real finding, never silently resolved in favor of one source.
        </p>
        <div class="view__table-scroll">
          <table class="view__metrics-table">
            <caption class="visually-hidden">
              Cross-source trade-data mismatch checks
            </caption>
            <thead>
              <tr>
                <th scope="col">Check</th>
                <th scope="col">Year</th>
                <th scope="col">Partner</th>
                <th scope="col">Gap</th>
                <th scope="col">Severity</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(check, index) in facts.mismatch_checks" :key="index">
                <td>{{ check.check }}</td>
                <td>{{ check.year }}</td>
                <td>{{ check.partner }}</td>
                <td>{{ formatPercent(check.gap_pct) }}</td>
                <td>
                  <span class="view__severity" :class="severityClass(check.severity)">{{
                    check.severity
                  }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="facts.regulatory_note" class="view__card">
        <h2 class="view__section-title">Regulatory note</h2>
        <p class="view__regulatory-note">{{ facts.regulatory_note }}</p>
      </section>

      <p v-if="!agricultureSectionsApplicable" class="view__not-applicable-note">
        Mandi prices, government price support, and international production statistics do not apply
        to this product category.
      </p>

      <template v-else>
        <section class="view__card">
          <h2 class="view__section-title">Mandi price (Agmarknet)</h2>
          <template v-if="facts.mandi_price.status === 'OK'">
            <p class="view__fact-value">
              {{ formatInrPaise(facts.mandi_price.modal_price_inr_paise_per_qtl) }}/quintal
            </p>
            <p class="view__fact-detail">
              {{ facts.mandi_price.matched_commodity }} · {{ facts.mandi_price.market }},
              {{ facts.mandi_price.state }}
              <span v-if="facts.mandi_price.price_date">· {{ facts.mandi_price.price_date }}</span>
            </p>
          </template>
          <EmptyState v-else :message="statusNote(facts.mandi_price.status)" />
        </section>

        <section class="view__card">
          <h2 class="view__section-title">Minimum Support Price</h2>
          <template v-if="facts.msp.status === 'OK'">
            <p class="view__fact-value">
              {{ formatInrPaise(facts.msp.msp_inr_paise_per_qtl) }}/quintal
            </p>
            <p class="view__fact-detail">
              {{ facts.msp.matched_commodity }} · {{ facts.msp.year_label }} · Cost of production:
              {{ formatInrPaise(facts.msp.cost_inr_paise_per_qtl) }}/quintal
            </p>
          </template>
          <EmptyState v-else :message="statusNote(facts.msp.status)" />
        </section>

        <section class="view__card">
          <h2 class="view__section-title">International production (FAOSTAT)</h2>
          <template v-if="facts.international_production.status === 'OK'">
            <p class="view__fact-detail">
              Matched item: {{ facts.international_production.matched_item }}
              <span v-if="facts.international_production.year"
                >· {{ facts.international_production.year }}</span
              >
            </p>
            <dl class="view__fact-grid">
              <div>
                <dt>India</dt>
                <dd>
                  {{
                    facts.international_production.india_status === 'OK'
                      ? formatTonnes(facts.international_production.india_production_tonnes)
                      : MISSING_VALUE_DISPLAY
                  }}
                  <span
                    v-if="facts.international_production.india_status === 'NOT_FOUND'"
                    class="view__fact-caveat"
                  >
                    (not reported)
                  </span>
                </dd>
              </div>
              <div>
                <dt>World</dt>
                <dd>{{ formatTonnes(facts.international_production.world_production_tonnes) }}</dd>
              </div>
            </dl>
          </template>
          <EmptyState v-else :message="statusNote(facts.international_production.status)" />
        </section>
      </template>

      <p class="view__provenance">
        BCD/AIDC/SWS/IGST verification is evidence-based: a rate is only shown when a real, citable
        source confirms it — an unverified component is never treated as 0%.
        {{ formatPercent(null) }} is not "zero," it is "we do not know yet."
      </p>
    </template>

    <LoadingState v-else />
  </main>
</template>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 56rem;
  margin: 0 auto;
  padding: var(--space-12) var(--space-4) var(--space-8);
}

.view__breadcrumb {
  margin: 0;
  font-size: var(--font-size-sm);
}

.view__breadcrumb a {
  color: var(--color-link);
}

.view__heading-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.view__eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.view__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-extrabold);
  letter-spacing: var(--letter-spacing-tight);
  margin: 0;
}

.view__product-label {
  margin: 0;
  color: var(--color-text-muted);
}

.view__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-6);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.view__section-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.view__narrative {
  margin: 0;
  line-height: 1.6;
  /* Matches AnalysisSummary.vue's identical-purpose handling of
   * item_description/analytical_summary — prompts/trade_narrative.md asks
   * for a single short paragraph today, but this costs nothing and avoids
   * an unexplained inconsistency between two very similar view types if
   * that prompt ever changes to produce multi-line output. */
  white-space: pre-wrap;
}

.view__narrative-note {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-style: italic;
}

.view__regulatory-note {
  margin: 0;
  line-height: 1.6;
  white-space: pre-wrap;
}

.view__fact-value {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-extrabold);
  font-variant-numeric: tabular-nums;
}

.view__fact-detail {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.view__fact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: var(--space-4);
  margin: 0;
}

.view__fact-grid dt {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.view__fact-grid dd {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
}

.view__fact-caveat {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-normal);
  color: var(--color-text-muted);
}

.view__not-applicable-note {
  margin: 0;
  padding: var(--space-4);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
}

.view__provenance {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-align: center;
}

.view__error-note {
  margin: 0;
  font-size: var(--font-size-sm);
}

.view__coverage {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.view__coverage--degraded {
  color: var(--color-danger);
}

.view__coverage-flag {
  font-weight: var(--font-weight-semibold);
}

.view__coverage-breakdown {
  color: var(--color-text-muted);
}

.view__mismatch-intro {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.view__table-scroll {
  overflow-x: auto;
}

.view__metrics-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.view__metrics-table th,
.view__metrics-table td {
  text-align: left;
  padding: var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.view__severity {
  display: inline-block;
  padding: 0.15em 0.6em;
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-semibold);
  border: 1px solid var(--color-border);
}

.view__severity--untrustworthy,
.view__severity--warning {
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
  background-color: color-mix(in srgb, var(--color-danger) 10%, transparent);
}

.view__severity--flag,
.view__severity--quiet {
  color: var(--color-text-muted);
}
</style>
