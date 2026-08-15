<script setup lang="ts">
import AppButton from './AppButton.vue'

withDefaults(defineProps<{ message?: string }>(), {
  message: 'Something went wrong.',
})

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="state state--error" role="alert">
    <p>{{ message }}</p>
    <AppButton variant="secondary" @click="$emit('retry')">Retry</AppButton>
  </div>
</template>

<style scoped>
.state--error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border-radius: var(--radius-md);
}
</style>
