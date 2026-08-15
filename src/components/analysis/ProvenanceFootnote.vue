<script setup lang="ts">
import type { Provenance } from '@/types/generated'

// TODO(Phase 3): render source, period, currency, and retrieval timestamp as a footnote.
defineProps<{ provenance: Provenance }>()
</script>

<template>
  <footer class="placeholder">
    <p>ProvenanceFootnote — Phase 3: source / period / currency / retrieved-at.</p>
  </footer>
</template>
