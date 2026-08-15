<script setup lang="ts">
import CategorySearch from '@/components/hs-picker/CategorySearch.vue'

// TODO(Phase 3): wire CategorySearch's selection event to push to
// ROUTE_NAMES.HS_ITEM with the chosen categoryCode param.
</script>

<template>
  <main class="view">
    <h1>HsCategoryView</h1>
    <p>Phase 3: searchable category picker.</p>
    <CategorySearch />
  </main>
</template>
