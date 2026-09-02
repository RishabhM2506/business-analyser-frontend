<script setup lang="ts">
withDefaults(defineProps<{ message?: string }>(), {
  message: 'Nothing here yet.',
})
</script>

<template>
  <div class="state state--empty">
    <p>{{ message }}</p>
    <slot />
  </div>
</template>

<style scoped>
.state--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  background-color: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-muted);
  text-align: center;
}
</style>
