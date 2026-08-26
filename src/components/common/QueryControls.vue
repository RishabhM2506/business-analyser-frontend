<script setup lang="ts">
// Real years/top_n configurability (2026-08-26 addition) — until now, how
// many years of trade history and how many top trading partners to show
// were hardcoded server-side with zero frontend control (the "application
// end to end is not working" product gap). Backed by real backend fields:
// `TradeQuery.years`/`TradeQuery.top_n` (app/schemas/query.py) for
// AnalysisView, `TradeReportQuery.years`/`top_n` for TradeReportView —
// both already validate range and reject out-of-bounds input server-side;
// this component's own min/max just keep the UI from offering a value the
// backend would reject anyway.
//
// `null` means "use the backend default" throughout — never defaulted to a
// concrete number client-side, so a request that omits both fields still
// gets the exact same server-computed default it always did.
import { useId } from 'vue'

import AppButton from './AppButton.vue'

const years = defineModel<number | null>('years', { required: true })
const topN = defineModel<number | null>('topN', { required: true })

const yearsInputId = useId()
const topNInputId = useId()

const props = withDefaults(
  defineProps<{
    minYears?: number
    maxYears: number
    minTopN?: number
    maxTopN?: number
    disabled?: boolean
  }>(),
  { minYears: 1, minTopN: 3, maxTopN: 25, disabled: false },
)

const emit = defineEmits<{ apply: [] }>()

function toIntOrNull(raw: string): number | null {
  if (raw.trim() === '') return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function onYearsInput(event: Event): void {
  years.value = toIntOrNull((event.target as HTMLInputElement).value)
}

function onTopNInput(event: Event): void {
  topN.value = toIntOrNull((event.target as HTMLInputElement).value)
}

function resetToDefaults(): void {
  years.value = null
  topN.value = null
  emit('apply')
}
</script>

<template>
  <form class="query-controls" @submit.prevent="emit('apply')">
    <div class="query-controls__field">
      <label :for="yearsInputId" class="query-controls__label">
        Years of history
        <input
          :id="yearsInputId"
          type="number"
          :min="props.minYears"
          :max="props.maxYears"
          step="1"
          placeholder="Default"
          :value="years ?? ''"
          :disabled="props.disabled"
          :aria-describedby="`${yearsInputId}-hint`"
          @input="onYearsInput"
        />
      </label>
      <p :id="`${yearsInputId}-hint`" class="query-controls__hint">
        {{ props.minYears }}–{{ props.maxYears }} years
      </p>
    </div>

    <div class="query-controls__field">
      <label :for="topNInputId" class="query-controls__label">
        Top trading partners
        <input
          :id="topNInputId"
          type="number"
          :min="props.minTopN"
          :max="props.maxTopN"
          step="1"
          placeholder="Default"
          :value="topN ?? ''"
          :disabled="props.disabled"
          :aria-describedby="`${topNInputId}-hint`"
          @input="onTopNInput"
        />
      </label>
      <p :id="`${topNInputId}-hint`" class="query-controls__hint">
        {{ props.minTopN }}–{{ props.maxTopN }} countries
      </p>
    </div>

    <div class="query-controls__actions">
      <AppButton type="submit" variant="primary" :disabled="props.disabled">Apply</AppButton>
      <AppButton
        type="button"
        variant="secondary"
        :disabled="props.disabled"
        @click="resetToDefaults"
      >
        Reset to defaults
      </AppButton>
    </div>
  </form>
</template>

<style scoped>
.query-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-4);
}

.query-controls__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 9rem;
}

.query-controls__label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
}

.query-controls__field input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--font-size-base);
  font-variant-numeric: tabular-nums;
}

.query-controls__field input:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.query-controls__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.query-controls__actions {
  display: flex;
  gap: var(--space-2);
}
</style>
