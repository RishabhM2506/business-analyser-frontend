<script setup lang="ts">
import { computed } from 'vue'

import type { Provenance } from '@/types/generated'

const props = defineProps<{ provenance: Provenance }>()

// Keyed by the literal union so TS forces this map to stay exhaustive if
// `Provenance['period_type']` ever grows a second variant.
const PERIOD_TYPE_LABELS: Record<Provenance['period_type'], string> = {
  // Explicit, user-facing surfacing of the Gate 0 decision (docs/PLAN.md
  // §3.2/§11): Comtrade data is calendar-year, which is NOT the same window
  // as the Indian fiscal year — worth stating in the UI itself, not only in
  // code comments, so a user comparing this to fiscal-year figures elsewhere
  // isn't misled.
  calendar_year: 'Calendar year (Jan–Dec) — not Indian fiscal year (Apr–Mar)',
}

const periodTypeLabel = computed(() => PERIOD_TYPE_LABELS[props.provenance.period_type])

const retrievedAtDisplay = computed(() => {
  const date = new Date(props.provenance.retrieved_at)
  if (Number.isNaN(date.getTime())) {
    // Defensive: show the raw value rather than "Invalid Date" if the
    // backend ever sends something unparsable.
    return props.provenance.retrieved_at
  }
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
})
</script>

<template>
  <footer class="provenance">
    <!-- Phase 4 finding M22/PBO-04: the only in-app statement of *whose*
         trade data this is — `reporter_country` is optional on the wire
         until the backend fix (parallel PR) lands, so this degrades to
         simply not rendering the line rather than crashing or showing
         "undefined." -->
    <p v-if="provenance.reporter_country" class="provenance__line">
      Reporting country: {{ provenance.reporter_country }}.
    </p>
    <p class="provenance__line">
      Source: {{ provenance.source }} · Currency: {{ provenance.currency }} · Retrieved
      <time :datetime="provenance.retrieved_at">{{ retrievedAtDisplay }}</time>
    </p>
    <p class="provenance__line">Period: {{ periodTypeLabel }}.</p>
    <p class="provenance__meta">Prompt version: {{ provenance.prompt_version }}</p>
  </footer>
</template>

<style scoped>
.provenance {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.provenance__line {
  margin: 0;
}

.provenance__meta {
  margin: 0;
  font-size: 0.75rem;
}
</style>
