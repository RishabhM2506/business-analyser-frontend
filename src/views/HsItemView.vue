<script setup lang="ts">
import ItemList from '@/components/hs-picker/ItemList.vue'

// TODO(Phase 3): wire ItemList's selection event to push to
// ROUTE_NAMES.ANALYSIS with the chosen hsCode param.
defineProps<{ categoryCode: string }>()
</script>

<template>
  <main class="view">
    <h1>HsItemView</h1>
    <p>Phase 3: item picker within selected category.</p>
    <ItemList :category-code="categoryCode" />
  </main>
</template>
