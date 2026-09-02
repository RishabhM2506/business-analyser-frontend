<script setup lang="ts">
// Free-text product search (2026-08-20 roadmap decision): the primary new
// entry point into an analysis, alongside (not replacing) the existing
// category/item picker at /categories, which stays reachable here as a
// browse-first fallback and is where `no_candidates_found` points back to.
import { storeToRefs } from 'pinia'
import { computed, useId } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import ProductSearchResults from '@/components/search/ProductSearchResults.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import { useSearchStore } from '@/stores/search'
import type { RankedCandidateOut } from '@/types/generated'

const router = useRouter()
const searchStore = useSearchStore()
const { queryText, result, loading, error } = storeToRefs(searchStore)

const inputId = useId()
const statusId = useId()

const outcome = computed(() => result.value?.outcome ?? null)
const candidates = computed<RankedCandidateOut[]>(() => result.value?.candidates ?? [])

const statusMessage = computed(() => {
  if (loading.value) {
    return 'Searching…'
  }
  if (outcome.value === 'disambiguate') {
    return `${candidates.value.length} matching product code${candidates.value.length === 1 ? '' : 's'} found.`
  }
  if (outcome.value === 'no_candidates_found') {
    return 'No matching product codes found.'
  }
  return ''
})

function goToAnalysis(hsCode: string): void {
  void router.push({ name: ROUTE_NAMES.ANALYSIS, params: { hsCode } })
}

async function onSubmit(): Promise<void> {
  const text = queryText.value.trim()
  if (!text || loading.value) {
    return
  }
  await searchStore.runSearch(text)
  if (searchStore.result?.outcome === 'auto_selected' && searchStore.result.selected_hs_code) {
    goToAnalysis(searchStore.result.selected_hs_code)
  }
}

function onSelectCandidate(candidate: RankedCandidateOut): void {
  goToAnalysis(candidate.hs_code)
}
</script>

<template>
  <main class="view">
    <div class="view__intro">
      <h1 tabindex="-1">What product are you analyzing?</h1>
      <p class="view__hint">
        Describe the product in your own words — e.g. "green coffee beans" or "cotton t-shirts" —
        and we'll find the matching trade codes.
      </p>
    </div>

    <div class="view__card">
      <form class="view__form" @submit.prevent="onSubmit">
        <label :for="inputId" class="view__label">
          Product description
          <input
            :id="inputId"
            v-model="queryText"
            type="text"
            autocomplete="off"
            spellcheck="false"
            class="view__input"
            placeholder="e.g. green coffee beans"
            :aria-describedby="statusId"
          />
        </label>
        <AppButton type="submit" :disabled="loading || !queryText.trim()">
          {{ loading ? 'Searching…' : 'Search' }}
        </AppButton>
      </form>
    </div>

    <p :id="statusId" class="visually-hidden" role="status" aria-live="polite">
      {{ statusMessage }}
    </p>

    <LoadingState v-if="loading" message="Searching for matching product codes…" />
    <ErrorState
      v-else-if="error"
      :message="error.message"
      :retryable="error.retryable"
      @retry="onSubmit"
    />
    <ProductSearchResults
      v-else-if="outcome === 'disambiguate'"
      :candidates="candidates"
      @select="onSelectCandidate"
    />
    <EmptyState
      v-else-if="outcome === 'no_candidates_found'"
      message="No matching product codes found."
    >
      <p class="view__empty-hint">Try describing it differently, or browse by category instead.</p>
    </EmptyState>

    <p class="view__browse">
      <RouterLink :to="{ name: ROUTE_NAMES.HS_CATEGORY }">Browse by category instead →</RouterLink>
    </p>
  </main>
</template>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 42rem;
  margin: 0 auto;
  padding: var(--space-12) var(--space-4) var(--space-8);
}

.view__intro {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.view h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-extrabold);
  letter-spacing: var(--letter-spacing-tight);
  margin: 0;
}

.view__hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-lg);
  margin: 0;
}

.view__card {
  padding: var(--space-6);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.view__form {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
}

.view__label {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
}

.view__input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-base);
  font-family: inherit;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.view__input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.view__empty-hint {
  margin: 0;
  font-size: var(--font-size-sm);
}

.view__browse {
  margin: 0;
  text-align: center;
  font-size: var(--font-size-sm);
}

.view__browse a {
  color: var(--color-link);
  font-weight: var(--font-weight-semibold);
}
</style>
