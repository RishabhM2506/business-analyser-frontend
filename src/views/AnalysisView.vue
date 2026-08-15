<script setup lang="ts">
// TODO(Phase 3): call useThreadStore().submitQuery({ hs_code: hsCode }), then
// render TradeTable (imports/exports), AnalysisSummary, and
// ProvenanceFootnote from the resulting TradeAnalysisResponse. Loading/error
// states from common/ wire in here.
defineProps<{ hsCode: string }>()
</script>

<template>
  <main class="view">
    <h1>AnalysisView</h1>
    <p>Phase 3: chat-style rendered result for HS code {{ hsCode }}.</p>
  </main>
</template>
