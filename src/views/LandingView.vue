<script setup lang="ts">
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import { ROUTE_NAMES } from '@/constants/routes'

const router = useRouter()

// TODO(Phase 3): also call useThreadStore().startThread() here (POST /threads)
// before navigating, so a thread exists before the user picks a category.
function startProcess(): void {
  router.push({ name: ROUTE_NAMES.HS_CATEGORY })
}
</script>

<template>
  <main class="landing">
    <h1>Business Analyser</h1>
    <p>
      Pick an HS trade-code category, then an item, and get a grounded 5-year import/export analysis
      for its top trading partners.
    </p>
    <AppButton @click="startProcess">Start my process</AppButton>
  </main>
</template>

<style scoped>
.landing {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
  max-width: 40rem;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.landing h1 {
  font-size: var(--font-size-xl);
  margin: 0;
}

.landing p {
  color: var(--color-text-muted);
  margin: 0;
}
</style>
