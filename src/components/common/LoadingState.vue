<script setup lang="ts">
// Real-Gemini reliability finding (2026-08 live incident, trace_id
// 958f4f88-8fa3-4da3-9af1-fb5f76ea0bac): a describe_item+summarize round
// trip can legitimately take up to ~2 minutes worst case (2 sequential
// model calls, each up to 3 attempts x 20s timeout) with zero client-side
// "still working" signal — indistinguishable from a hang. This never
// changes what's fetched, only what's shown while waiting: after
// `slowAfterMs` a second, muted line appears so a slow-but-healthy request
// reads as "still working," not "broken."
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{ message?: string; slowAfterMs?: number }>(), {
  message: 'Loading…',
  slowAfterMs: 8000,
})

const isSlow = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  timer = setTimeout(() => {
    isSlow.value = true
  }, props.slowAfterMs)
})

onBeforeUnmount(() => {
  clearTimeout(timer)
})
</script>

<template>
  <div class="state state--loading" role="status" aria-live="polite">
    <span class="state__spinner" aria-hidden="true" />
    <p>{{ message }}</p>
    <p v-if="isSlow" class="state__slow-note">
      Still working — this can take up to a couple of minutes when the underlying data sources are
      under heavy demand.
    </p>
  </div>
</template>

<style scoped>
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--color-text-muted);
}

.state__slow-note {
  max-width: 28rem;
  margin: 0;
  font-size: var(--font-size-sm);
  text-align: center;
}

.state__spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
