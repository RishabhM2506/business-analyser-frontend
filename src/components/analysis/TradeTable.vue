<script setup lang="ts">
import type { TradeTable } from '@/types/generated'

// Structured render only — never v-html on this data (master brief §8,
// docs/CONVENTIONS.md security posture). TODO(Phase 3): render `table.rows`
// as an actual top-10 x 5yr table with "—" for null cells.
defineProps<{ title: string; table: TradeTable }>()
</script>

<template>
  <section class="placeholder">
    <h3>TradeTable — {{ title }}</h3>
    <p>Phase 3: {{ table.rows.length }} row(s), years {{ table.years.join(', ') || '—' }}.</p>
  </section>
</template>
