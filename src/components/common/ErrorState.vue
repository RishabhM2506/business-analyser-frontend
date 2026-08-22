<script setup lang="ts">
import AppButton from './AppButton.vue'

withDefaults(defineProps<{ message?: string; retryable?: boolean }>(), {
  message: 'Something went wrong.',
  // Most callers show a transient/network-ish failure where retrying makes
  // sense; callers backed by a structured error (ApiError.retryable, mirroring
  // the backend's own ErrorResponse.retryable — docs/PLAN.md §3.2) should
  // pass that value through explicitly instead of relying on this default.
  retryable: true,
})

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="state state--error" role="alert">
    <p>{{ message }}</p>
    <AppButton v-if="retryable" variant="secondary" @click="$emit('retry')">Retry</AppButton>
    <slot />
  </div>
</template>

<style scoped>
.state--error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-8);
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border-radius: var(--radius-lg);
  /* Same --color-danger token already used for the text above — the border
   * doesn't need independent AA verification (a decorative, non-text
   * outline), but reusing the verified token keeps it visually coherent
   * with the text it surrounds rather than introducing an unverified color. */
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
}
</style>
