<script setup lang="ts">
// Structured render only — never v-html on model output (master brief §8).
// `item_description` and `analytical_summary` are plain strings on the wire
// (see types/generated.ts's TradeAnalysisResponse) — not markdown, not HTML.
// Rendering them via {{ }} interpolation, split into paragraph blocks, is the
// "structured rendering over markdown-to-HTML" this project's security
// posture asks for (docs/CONVENTIONS.md §11): Vue auto-escapes interpolated
// text, so no markup the model writes can ever execute or be parsed as tags.
import { computed } from 'vue'

import { splitParagraphs } from './textBlocks'

const props = defineProps<{ itemDescription: string; analyticalSummary: string }>()

const descriptionParagraphs = computed(() => splitParagraphs(props.itemDescription))
const summaryParagraphs = computed(() => splitParagraphs(props.analyticalSummary))
</script>

<template>
  <section class="analysis-summary">
    <div v-if="descriptionParagraphs.length > 0" class="analysis-summary__block">
      <h2 class="analysis-summary__heading">What this item is</h2>
      <p v-for="(paragraph, index) in descriptionParagraphs" :key="index">{{ paragraph }}</p>
    </div>

    <div v-if="summaryParagraphs.length > 0" class="analysis-summary__block">
      <h2 class="analysis-summary__heading">Analysis</h2>
      <p v-for="(paragraph, index) in summaryParagraphs" :key="index">{{ paragraph }}</p>
    </div>
  </section>
</template>

<style scoped>
.analysis-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.analysis-summary__block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.analysis-summary__heading {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.analysis-summary__block p {
  margin: 0;
  line-height: var(--line-height-base);
  /* A single long unbroken run (Phase 4 finding M15/Frontend-QA#3 — e.g. a
   * URL, identifier, or long compound name in model-authored prose) would
   * otherwise overflow this container and the whole page horizontally. This
   * is the correct CSS property for "break a single too-long word instead of
   * overflowing," per the reproduction: a 150+ char unbroken token measured
   * a genuine 344px page-level overflow on a 1280px viewport without it. */
  overflow-wrap: break-word;
}
</style>
