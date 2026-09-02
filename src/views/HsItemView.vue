<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import ItemList from '@/components/hs-picker/ItemList.vue'
import { useHsTaxonomy, type HsTaxonomyEntry } from '@/composables/useHsTaxonomy'
import { ROUTE_NAMES } from '@/constants/routes'

const props = defineProps<{ categoryCode: string }>()
const router = useRouter()

// Defensive: loads (idempotently) even if the user deep-links straight into
// this route without CategorySearch ever having mounted this session.
const { entries, load } = useHsTaxonomy()
onMounted(() => {
  void load()
})

const category = computed(() =>
  entries.value.find((entry) => entry.level === 2 && entry.hs_code === props.categoryCode),
)

function onSelect(item: HsTaxonomyEntry): void {
  void router.push({ name: ROUTE_NAMES.ANALYSIS, params: { hsCode: item.hs_code } })
}
</script>

<template>
  <main class="view">
    <p class="view__breadcrumb">
      <RouterLink :to="{ name: ROUTE_NAMES.HS_CATEGORY }">← Back to categories</RouterLink>
    </p>
    <div class="view__intro">
      <h1 tabindex="-1">{{ category ? category.description : `Category ${categoryCode}` }}</h1>
      <p class="view__hint">Select an item to see its 5-year import/export analysis.</p>
    </div>
    <ItemList :category-code="categoryCode" @select="onSelect" />
  </main>
</template>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 42rem;
  margin: 0 auto;
  padding: var(--space-12) var(--space-4) var(--space-8);
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
  font-weight: var(--font-weight-semibold);
}

.view__intro {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
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
