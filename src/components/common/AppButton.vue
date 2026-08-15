<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary'
    type?: 'button' | 'submit'
    disabled?: boolean
  }>(),
  {
    variant: 'primary',
    type: 'button',
    disabled: false,
  },
)

defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="['app-button', `app-button--${variant}`]"
    @click="(event) => $emit('click', event)"
  >
    <slot />
  </button>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.app-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.app-button--primary {
  background-color: var(--color-primary);
  color: var(--color-primary-contrast);
}

.app-button--primary:not(:disabled):hover {
  background-color: var(--color-primary-hover);
}

.app-button--secondary {
  background-color: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.app-button--secondary:not(:disabled):hover {
  background-color: var(--color-surface);
}
</style>
