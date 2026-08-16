<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import AnalysisSummary from '@/components/analysis/AnalysisSummary.vue'
import ProvenanceFootnote from '@/components/analysis/ProvenanceFootnote.vue'
import TradeTable from '@/components/analysis/TradeTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import { useThreadStore } from '@/stores/thread'

const props = defineProps<{ hsCode: string }>()

const store = useThreadStore()
const { messages, loading, error } = storeToRefs(store)

// POST /threads/{id}/messages (docs/PLAN.md §3.3) on item selection —
// re-fires if the route's hsCode ever changes under this same mounted view.
function runQuery(): void {
  void store.submitQuery({ hs_code: props.hsCode })
}

onMounted(runQuery)
watch(() => props.hsCode, runQuery)

// v1 renders only the latest message (no multi-turn UI — out of scope per
// master brief §2.3/§3) even though the store keeps the full thread history
// for when that roadmap item ships.
const latestResult = computed(() => messages.value.at(-1) ?? null)

// A schema-valid, non-error response can still legitimately carry zero
// trading partners for either flow — distinct from an ApiError, and worth
// its own explicit state rather than rendering two silently-empty tables.
const isEmpty = computed(() => {
  const result = latestResult.value
  if (!result) {
    return false
  }
  return result.imports.rows.length === 0 && result.exports.rows.length === 0
})

// Phase 4 finding M17/Frontend-QA#5: router/index.ts's afterEach hook
// focuses the new route's <h1> on every navigation, but this view's <h1>
// doesn't exist in the DOM at all until `latestResult` is set (the fetch is
// asynchronous — the router's one-shot nextTick after the route change fires
// while this is still showing LoadingState). This view is the one place
// that gap matters most (it's the actual destination, not an intermediate
// picker step), so it focuses its own heading the moment it actually
// appears — covering both the initial load and a later hsCode change under
// this same mounted view.
const headingRef = ref<HTMLHeadingElement | null>(null)
watch(latestResult, (result) => {
  if (result) {
    void nextTick(() => {
      headingRef.value?.focus()
    })
  }
})
</script>

<template>
  <main class="view">
    <p class="view__breadcrumb">
      <RouterLink :to="{ name: ROUTE_NAMES.HS_CATEGORY }">← Back to categories</RouterLink>
    </p>

    <LoadingState v-if="loading" message="Fetching trade data…" />

    <ErrorState
      v-else-if="error"
      :message="error.message"
      :retryable="error.retryable"
      @retry="runQuery"
    >
      <!-- BUDGET_EXCEEDED is retryable on the wire (Phase 4 finding
           M19/Frontend-QA#7 — confirmed against the real backend, which
           enforces both a per-thread/session ceiling and a shared per-day
           ceiling under the same error_code with no way for the frontend to
           tell which was hit), but a bare "Retry" button with no context is
           poor UX when the common real cause is a shared daily limit that
           cannot resolve until the next UTC day. Say so plainly instead of
           implying every retry is equally likely to help. -->
      <p v-if="error.isBudgetExceeded" class="view__error-note">
        This limit is shared across all users. Retry may work right away if it was a short-lived
        limit — but if the shared daily limit was reached, it won't reset until tomorrow (UTC).
      </p>
      <RouterLink
        v-if="error.errorCode === 'INVALID_HS_CODE'"
        :to="{ name: ROUTE_NAMES.HS_CATEGORY }"
      >
        Choose a different category
      </RouterLink>
    </ErrorState>

    <EmptyState
      v-else-if="isEmpty"
      message="No trade data is available for this item in the selected period."
    >
      <RouterLink :to="{ name: ROUTE_NAMES.HS_CATEGORY }">Try a different category</RouterLink>
    </EmptyState>

    <template v-else-if="latestResult">
      <h1 ref="headingRef" class="view__title" tabindex="-1">
        Trade analysis — HS {{ latestResult.hs_code }}
      </h1>

      <AnalysisSummary
        :item-description="latestResult.item_description"
        :analytical-summary="latestResult.analytical_summary"
      />

      <TradeTable title="Imports" :table="latestResult.imports" />
      <TradeTable title="Exports" :table="latestResult.exports" />

      <ProvenanceFootnote :provenance="latestResult.provenance" />
    </template>

    <!-- Covers the brief pre-mount tick before onMounted's query has set
         loading — never an empty frame between navigation and the spinner. -->
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
  padding: var(--space-8) var(--space-4);
}

.view__breadcrumb {
  margin: 0;
  font-size: var(--font-size-sm);
}

.view__breadcrumb a {
  /* --color-link, not --color-primary (Phase 4 finding M16/Frontend-QA#4) —
   * see tokens.css's comment: this is a text-on-background use, which needs
   * a lighter dark-mode value than --color-primary's background-under-
   * white-text use can share. */
  color: var(--color-link);
}

.view__title {
  font-size: var(--font-size-xl);
  margin: 0;
}

.view__error-note {
  margin: 0;
  font-size: var(--font-size-sm);
}
</style>
