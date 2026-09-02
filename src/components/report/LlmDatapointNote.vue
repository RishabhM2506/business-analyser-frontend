<script setup lang="ts">
// Renders `LlmDatapointFact[]` (2026-09-02, Step 4 hardening, Concern 2) —
// a real, cited search result for a field the verified analytics/ref layer
// has nothing for. Rendered *alongside*, never in place of, the verified
// section it sits beside (this component is used inside each of
// TradeReportView's mandi-price/MSP/international-production cards, next
// to — not instead of — that card's own OK/NOT_FOUND/NOT_APPLICABLE
// status) — the backend keeps these two views structurally separate
// (`Facts.mandi_price` vs. `Facts.mandi_price_llm_datapoints`) specifically
// so nothing here is ever blended into the verified figure.
import type { LlmDatapointFact } from '@/types/generated'

defineProps<{ datapoints: LlmDatapointFact[] }>()

// `value` is a generic object (heterogeneous shape per field_name, see
// LlmDatapointFact's own doc comment) — rendered as a plain key/value
// list rather than assuming any specific field names, so this component
// works for any of the three backfillable fields without per-field markup.
function formatKey(key: string): string {
  return key.replace(/_/g, ' ')
}
</script>

<template>
  <div v-if="datapoints.length > 0" class="llm-note">
    <p class="llm-note__heading">
      <span class="llm-note__badge">Cited, not independently verified</span>
    </p>
    <div v-for="(entry, index) in datapoints" :key="index" class="llm-note__entry">
      <dl class="llm-note__values">
        <div v-for="(value, key) in entry.value" :key="key">
          <dt>{{ formatKey(String(key)) }}</dt>
          <dd>{{ value }}</dd>
        </div>
      </dl>
      <p class="llm-note__source">
        {{ entry.effective_period }} ·
        <a
          v-if="entry.source_url"
          :href="entry.source_url"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ entry.source_authority }}
        </a>
        <span v-else>{{ entry.source_authority }}</span>
        — {{ entry.source_reference }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.llm-note {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  /* Dashed, not solid - visually distinct from every verified card's own
   * solid-bordered surface, matching this session's "not_yet_curated"
   * honest-absence treatment established elsewhere in this pipeline. */
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
}

.llm-note__heading {
  margin: 0;
}

.llm-note__badge {
  display: inline-block;
  padding: 0.15em 0.6em;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  font-style: italic;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.llm-note__entry {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.llm-note__entry:not(:first-of-type) {
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.llm-note__values {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: var(--space-2) var(--space-4);
  margin: 0;
}

.llm-note__values dt {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-transform: capitalize;
}

.llm-note__values dd {
  margin: 0;
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
}

.llm-note__source {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.llm-note__source a {
  color: var(--color-link);
}
</style>
