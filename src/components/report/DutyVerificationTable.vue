<script setup lang="ts">
// Renders `LandedCostResult` (app/report/landed_cost.py) — evidence-first by
// construction: a component's `value_pct` only exists when
// `verification_status` is `VERIFIED`/`EXPIRED`. This table never fills a
// `NOT_VERIFIED`/`CONFLICTING` row's percentage with 0 or a dash that could
// be misread as zero — it says "Not verified" in words instead.
import { computed } from 'vue'

import { formatInrPaise, formatPercent } from '@/components/report/reportValueFormat'
import type { DutyComponent, DutyComponentEvidence, LandedCostResult } from '@/types/generated'

const props = defineProps<{ landedCost: LandedCostResult; asOfPeriod: string | null }>()

const DUTY_COMPONENT_ORDER: DutyComponent[] = ['BCD', 'AIDC', 'SWS', 'IGST']
const DUTY_COMPONENT_LABELS: Record<DutyComponent, string> = {
  BCD: 'Basic Customs Duty',
  AIDC: 'Agriculture Infrastructure & Development Cess',
  SWS: 'Social Welfare Surcharge',
  IGST: 'Integrated GST',
}

const rows = computed(() =>
  DUTY_COMPONENT_ORDER.map((component) => ({
    component,
    evidence: props.landedCost.components[component] ?? null,
  })),
)

function statusLabel(evidence: DutyComponentEvidence | null): string {
  if (!evidence) return 'Not verified'
  switch (evidence.verification_status) {
    case 'VERIFIED':
      return 'Verified'
    case 'EXPIRED':
      return 'Expired (historical)'
    case 'CONFLICTING':
      return 'Conflicting sources'
    default:
      return 'Not verified'
  }
}
</script>

<template>
  <div class="duty">
    <table class="duty__table">
      <caption class="visually-hidden">
        Customs duty components, with verification status
      </caption>
      <thead>
        <tr>
          <th scope="col">Component</th>
          <th scope="col">Status</th>
          <th scope="col">Rate</th>
          <th scope="col">Source</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="row in rows" :key="row.component">
          <tr>
            <th scope="row" class="duty__component">
              {{ row.component }}
              <span class="duty__component-name">{{ DUTY_COMPONENT_LABELS[row.component] }}</span>
            </th>
            <td>
              <span
                class="duty__status"
                :class="`duty__status--${row.evidence?.verification_status ?? 'NOT_VERIFIED'}`"
              >
                {{ statusLabel(row.evidence) }}
              </span>
            </td>
            <td class="duty__rate">{{ formatPercent(row.evidence?.value_pct ?? null) }}</td>
            <td class="duty__source">
              <a
                v-if="row.evidence?.source_url"
                :href="row.evidence.source_url"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ row.evidence.source_authority }}
              </a>
              <span v-else-if="row.evidence?.source_authority">{{
                row.evidence.source_authority
              }}</span>
              <span v-else class="duty__no-source">No source recorded</span>
            </td>
          </tr>
          <tr v-if="row.evidence?.conflicting_candidates?.length" class="duty__conflict-row">
            <td colspan="4">
              <p class="duty__conflict-intro">
                Sources disagree on {{ row.component }} —
                {{ row.evidence.conflicting_candidates.length }} conflicting
                {{ row.evidence.conflicting_candidates.length === 1 ? 'rate' : 'rates' }}
                reported:
              </p>
              <ul class="duty__conflict-list">
                <li
                  v-for="(candidate, index) in row.evidence.conflicting_candidates"
                  :key="index"
                  class="duty__conflict-item"
                >
                  <span class="duty__conflict-rate">{{ formatPercent(candidate.value_pct) }}</span>
                  <span class="duty__conflict-source">
                    <a
                      v-if="candidate.source_url"
                      :href="candidate.source_url"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {{ candidate.source_authority }}
                    </a>
                    <span v-else>{{ candidate.source_authority }}</span>
                    — {{ candidate.source_reference }}
                  </span>
                </li>
              </ul>
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <p v-if="landedCost.is_complete" class="duty__summary duty__summary--complete">
      Landed cost{{ asOfPeriod ? ` as of ${asOfPeriod}` : '' }}:
      <strong>{{ formatInrPaise(landedCost.landed_cost_inr_paise_per_kg) }}/kg</strong>
    </p>
    <p v-else class="duty__summary duty__summary--incomplete">
      Landed cost is <strong>incomplete</strong> — {{ landedCost.excluded_components.join(', ') }}
      {{ landedCost.excluded_components.length === 1 ? 'is' : 'are' }} not verified. Partial figure
      using only verified components{{ asOfPeriod ? ` (as of ${asOfPeriod})` : '' }}:
      <strong>{{ formatInrPaise(landedCost.partial_landed_cost_inr_paise_per_kg) }}/kg</strong>
    </p>
  </div>
</template>

<style scoped>
.duty {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.duty__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.duty__table th,
.duty__table td {
  text-align: left;
  padding: var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--color-border);
  vertical-align: top;
}

.duty__component {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: var(--font-weight-semibold);
}

.duty__component-name {
  font-weight: var(--font-weight-normal);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.duty__status {
  display: inline-block;
  padding: 0.15em 0.6em;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  border: 1px solid var(--color-border);
}

.duty__status--VERIFIED {
  color: var(--color-success);
  border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
  background-color: color-mix(in srgb, var(--color-success) 10%, transparent);
}

.duty__status--NOT_VERIFIED,
.duty__status--CONFLICTING {
  color: var(--color-text-muted);
}

.duty__status--EXPIRED {
  color: var(--color-text-muted);
  font-style: italic;
}

.duty__rate {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.duty__source a {
  color: var(--color-link);
}

.duty__no-source {
  color: var(--color-text-muted);
}

.duty__conflict-row td {
  padding-top: 0;
  border-bottom: 1px solid var(--color-border);
}

.duty__conflict-intro {
  margin: 0 0 var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.duty__conflict-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0 0 0 var(--space-4);
  list-style: none;
  font-size: var(--font-size-sm);
}

.duty__conflict-item {
  display: flex;
  gap: var(--space-2);
}

.duty__conflict-rate {
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.duty__conflict-source {
  color: var(--color-text-muted);
}

.duty__conflict-source a {
  color: var(--color-link);
}

.duty__summary {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.duty__summary--complete {
  background-color: color-mix(in srgb, var(--color-success) 10%, transparent);
}

.duty__summary--incomplete {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
}
</style>
