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
    <h1>Choose a category</h1>
    <p class="view__hint">Search by name (e.g. "food", "textiles") or by chapter number.</p>
    <CategorySearch @select="onSelect" />
  </main>
</template>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 40rem;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.view h1 {
  font-size: var(--font-size-xl);
  margin: 0;
}

.view__hint {
  color: var(--color-text-muted);
  margin: 0;
}
</style>
