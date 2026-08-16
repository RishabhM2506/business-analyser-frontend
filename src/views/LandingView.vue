<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import { useThreadStore } from '@/stores/thread'

const router = useRouter()
const threadStore = useThreadStore()
const { loading, error } = storeToRefs(threadStore)

// POST /threads (docs/PLAN.md §3.3) happens here, once, before the user ever
// sees the category picker — a thread must exist before any item selection
// can POST /threads/{id}/messages.
async function startProcess(): Promise<void> {
  await threadStore.startThread()
  if (!threadStore.error) {
    void router.push({ name: ROUTE_NAMES.HS_CATEGORY })
  }
}
</script>

<template>
  <main class="landing">
    <h1>Business Analyser</h1>
    <p>
      Pick an HS trade-code category, then an item, and get a grounded 5-year import/export analysis
      for its top trading partners.
    </p>
    <ErrorState
      v-if="error"
      :message="error.message"
      :retryable="error.retryable"
      @retry="startProcess"
    />
    <AppButton v-else :disabled="loading" @click="startProcess">
      {{ loading ? 'Starting…' : 'Start my process' }}
    </AppButton>
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
