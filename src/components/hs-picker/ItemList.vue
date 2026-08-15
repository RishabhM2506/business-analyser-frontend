<script setup lang="ts">
// TODO(Phase 3): list HS items (sub-headings) within the selected category.
// Emits a selected hs_code.
defineProps<{ categoryCode?: string }>()
</script>

<template>
  <section class="placeholder">
    <h2>ItemList</h2>
    <p>Phase 3: items within category {{ categoryCode ?? '(none selected)' }}.</p>
  </section>
</template>
