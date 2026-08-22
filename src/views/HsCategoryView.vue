<script setup lang="ts">
import { useRouter } from 'vue-router'

import CategorySearch from '@/components/hs-picker/CategorySearch.vue'
import type { HsTaxonomyEntry } from '@/composables/useHsTaxonomy'
import { ROUTE_NAMES } from '@/constants/routes'

const router = useRouter()

function onSelect(category: HsTaxonomyEntry): void {
  void router.push({ name: ROUTE_NAMES.HS_ITEM, params: { categoryCode: category.hs_code } })
}
</script>

<template>
  <main class="view">
    <div class="view__intro">
      <h1 tabindex="-1">Choose a category</h1>
      <p class="view__hint">Search by name (e.g. "food", "textiles") or by chapter number.</p>
    </div>
    <CategorySearch @select="onSelect" />
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
</style>
