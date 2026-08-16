<script setup lang="ts">
// MiniSearch-backed, virtualised HS category (level-2) picker. Implements the
// WAI-ARIA "combobox with listbox popup" pattern: aria-expanded/aria-controls
// on the input (role="combobox"), aria-activedescendant tracking the
// keyboard-highlighted option instead of moving real DOM focus off the
// input, role="option"/aria-selected on each row. Emits the selected
// category; HsCategoryView.vue owns navigation.
import { computed, onMounted, ref, useId, watch } from 'vue'

import ErrorState from '@/components/common/ErrorState.vue'
import { isListNavigationKey, nextActiveIndex } from '@/components/common/listNavigation'
import LoadingState from '@/components/common/LoadingState.vue'
import VirtualList from '@/components/common/VirtualList.vue'
import { useHsTaxonomy, type HsTaxonomyEntry } from '@/composables/useHsTaxonomy'

const ITEM_HEIGHT = 48
const MAX_LIST_HEIGHT = 320

const emit = defineEmits<{ select: [category: HsTaxonomyEntry] }>()

const { isLoading, error, load, search } = useHsTaxonomy()

const query = ref('')
const isOpen = ref(false)
const activeIndex = ref(-1)

const inputId = useId()
const listboxId = useId()
const statusId = useId()

onMounted(() => {
  void load()
})

const results = computed<HsTaxonomyEntry[]>(() => search(query.value))

// A fresh result set should never keep a stale row highlighted.
watch(results, () => {
  activeIndex.value = -1
})

const activeOptionId = computed(() =>
  activeIndex.value >= 0 && activeIndex.value < results.value.length
    ? optionId(activeIndex.value)
    : undefined,
)

const statusMessage = computed(() => {
  if (isLoading.value) {
    return 'Loading HS categories…'
  }
  if (!isOpen.value) {
    return ''
  }
  if (results.value.length === 0) {
    return 'No categories match your search.'
  }
  return `${results.value.length} categor${results.value.length === 1 ? 'y' : 'ies'} available.`
})

function optionId(index: number): string {
  return `${listboxId}-option-${index}`
}

function openList(): void {
  isOpen.value = true
}

function closeList(): void {
  isOpen.value = false
  activeIndex.value = -1
}

function selectEntry(entry: HsTaxonomyEntry): void {
  query.value = entry.description
  closeList()
  emit('select', entry)
}

function onKeydown(event: KeyboardEvent): void {
  if (isListNavigationKey(event.key)) {
    if (results.value.length === 0) {
      return
    }
    event.preventDefault()
    isOpen.value = true
    activeIndex.value = nextActiveIndex(activeIndex.value, event.key, results.value.length)
    return
  }
  if (event.key === 'Enter') {
    const entry = results.value[activeIndex.value]
    if (entry) {
      event.preventDefault()
      selectEntry(entry)
    }
    return
  }
  if (event.key === 'Escape') {
    closeList()
  }
}
</script>

<template>
  <div class="category-search">
    <label :for="inputId" class="category-search__label">
      Search HS categories
      <input
        :id="inputId"
        v-model="query"
        type="text"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        class="category-search__input"
        placeholder="e.g. food, textiles, machinery…"
        :aria-expanded="isOpen"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        :aria-controls="listboxId"
        :aria-activedescendant="activeOptionId"
        :aria-describedby="statusId"
        @focus="openList"
        @blur="closeList"
        @keydown="onKeydown"
      />
    </label>
    <p :id="statusId" class="visually-hidden" role="status" aria-live="polite">
      {{ statusMessage }}
    </p>

    <LoadingState v-if="isLoading && results.length === 0" message="Loading HS categories…" />
    <ErrorState v-else-if="error" :message="error.message" @retry="() => load()" />
    <template v-else-if="isOpen">
      <VirtualList
        v-if="results.length > 0"
        :items="results"
        :item-height="ITEM_HEIGHT"
        :max-height="MAX_LIST_HEIGHT"
        :active-index="activeIndex"
        :list-id="listboxId"
        list-role="listbox"
        list-aria-label="HS category results"
        tag="ul"
        class="category-search__results"
      >
        <template #default="{ item, index }">
          <li
            :id="optionId(index)"
            role="option"
            :aria-selected="index === activeIndex ? 'true' : 'false'"
            tabindex="-1"
            class="category-search__option"
            :class="{ 'category-search__option--active': index === activeIndex }"
            @mousedown.prevent
            @click="selectEntry(item)"
            @keydown.enter.prevent="selectEntry(item)"
            @keydown.space.prevent="selectEntry(item)"
            @mouseenter="activeIndex = index"
            @focusin="activeIndex = index"
          >
            <span class="category-search__code">{{ item.hs_code }}</span>
            <span class="category-search__desc">{{ item.description }}</span>
          </li>
        </template>
      </VirtualList>
      <p v-else class="category-search__empty">No categories match "{{ query.trim() }}".</p>
    </template>
  </div>
</template>

<style scoped>
.category-search {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  max-width: 32rem;
}

.category-search__label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
}

.category-search__input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-base);
  font-family: inherit;
}

.category-search__input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.category-search__empty {
  padding: var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.category-search__option {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
}

.category-search__option:last-child {
  border-bottom: none;
}

.category-search__option--active {
  background-color: var(--color-surface);
}

.category-search__code {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.category-search__desc {
  flex: 1;
}
</style>
