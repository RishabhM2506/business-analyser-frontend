<script setup lang="ts">
// Structured render only — never v-html on model output (master brief §8).
// TODO(Phase 3): render `summary` as plain text/structured prose, never markdown-to-HTML.
defineProps<{ summary: string }>()
</script>

<template>
  <section class="placeholder">
    <h3>AnalysisSummary</h3>
    <p>Phase 3: renders the analytical summary as plain text — no v-html.</p>
  </section>
</template>
