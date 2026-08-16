<script setup lang="ts">
// Lists HS6 items (level-6 taxonomy rows) under the selected level-2
// category. No search index here — this step is deliberately "list children
// of this code" (see useHsTaxonomy's getItemsForCategory), not a search
// (master brief §3 Phase 3 slice 1). Implements the WAI-ARIA "listbox" (not
// combobox) pattern: the listbox element itself is the tab stop and carries
// aria-activedescendant, since there's no separate text input here.
import { computed, onMounted, ref, useId, watch } from 'vue'

import EmptyState from '@/components/common/EmptyState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import { isListNavigationKey, nextActiveIndex } from '@/components/common/listNavigation'
import LoadingState from '@/components/common/LoadingState.vue'
import VirtualList from '@/components/common/VirtualList.vue'
import { useHsTaxonomy, type HsTaxonomyEntry } from '@/composables/useHsTaxonomy'

const ITEM_HEIGHT = 56
const MAX_LIST_HEIGHT = 480

const props = defineProps<{ categoryCode: string }>()
const emit = defineEmits<{ select: [item: HsTaxonomyEntry] }>()

const { isLoading, error, load, getItemsForCategory } = useHsTaxonomy()

const activeIndex = ref(-1)
const listboxId = useId()

onMounted(() => {
  void load()
})

const items = computed<HsTaxonomyEntry[]>(() => getItemsForCategory(props.categoryCode))

watch(items, () => {
  activeIndex.value = -1
})

const activeOptionId = computed(() =>
  activeIndex.value >= 0 && activeIndex.value < items.value.length
    ? optionId(activeIndex.value)
    : undefined,
)

function optionId(index: number): string {
  return `${listboxId}-option-${index}`
}

function selectEntry(entry: HsTaxonomyEntry): void {
  emit('select', entry)
}

function onKeydown(event: KeyboardEvent): void {
  if (isListNavigationKey(event.key)) {
    if (items.value.length === 0) {
      return
    }
    event.preventDefault()
    activeIndex.value = nextActiveIndex(activeIndex.value, event.key, items.value.length)
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    const entry = items.value[activeIndex.value]
    if (entry) {
      event.preventDefault()
      selectEntry(entry)
    }
  }
}
</script>

<template>
  <div class="item-list">
    <LoadingState v-if="isLoading" message="Loading HS items…" />
    <ErrorState v-else-if="error" :message="error.message" @retry="() => load()" />
    <EmptyState v-else-if="items.length === 0" message="No items found in this category." />
    <template v-else>
      <p class="item-list__count">{{ items.length }} item{{ items.length === 1 ? '' : 's' }}</p>
      <VirtualList
        :items="items"
        :item-height="ITEM_HEIGHT"
        :max-height="MAX_LIST_HEIGHT"
        :active-index="activeIndex"
        :list-id="listboxId"
        list-role="listbox"
        list-aria-label="HS items in this category"
        list-tabindex="0"
        :list-active-descendant="activeOptionId"
        tag="ul"
        class="item-list__results"
        @keydown="onKeydown"
      >
        <template #default="{ item, index }">
          <li
            :id="optionId(index)"
            role="option"
            :aria-selected="index === activeIndex ? 'true' : 'false'"
            tabindex="-1"
            class="item-list__option"
            :class="{ 'item-list__option--active': index === activeIndex }"
            @mousedown.prevent
            @click="selectEntry(item)"
            @keydown.enter.prevent="selectEntry(item)"
            @keydown.space.prevent="selectEntry(item)"
            @mouseenter="activeIndex = index"
            @focusin="activeIndex = index"
          >
            <span class="item-list__code">{{ item.hs_code }}</span>
            <span class="item-list__desc">{{ item.description }}</span>
          </li>
        </template>
      </VirtualList>
    </template>
  </div>
</template>

<style scoped>
.item-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.item-list__count {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.item-list__results:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.item-list__option {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
}

.item-list__option:last-child {
  border-bottom: none;
}

.item-list__option--active {
  background-color: var(--color-surface);
}

.item-list__code {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.item-list__desc {
  flex: 1;
}
</style>
