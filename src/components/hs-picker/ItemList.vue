<script setup lang="ts">
// Lists HS6 items (level-6 taxonomy rows) under the selected level-2
// category, with a MiniSearch-backed filter (Phase 4 finding M24/PBO-06:
// large categories like Machinery, 538 items, or Electrical machinery, 296,
// were an unfiltered scroll-only list — unlike the excellent category-search
// step). The listbox itself keeps the WAI-ARIA "listbox" (not combobox)
// pattern: it is a persistently-visible list, not a popup, so the search
// input is a plain `role="searchbox"` filtering it in place, not a
// combobox-with-popup — the listbox element itself remains the tab stop and
// carries aria-activedescendant.
import { computed, onMounted, ref, useId, watch } from 'vue'

import EmptyState from '@/components/common/EmptyState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import { isListNavigationKey, nextActiveIndex } from '@/components/common/listNavigation'
import LoadingState from '@/components/common/LoadingState.vue'
import VirtualList from '@/components/common/VirtualList.vue'
import { useHsTaxonomy, type HsTaxonomyEntry } from '@/composables/useHsTaxonomy'
import { isNavigationBlocked, markNavigating } from '@/router'

const ITEM_HEIGHT = 56
const MAX_LIST_HEIGHT = 480

const props = defineProps<{ categoryCode: string }>()
const emit = defineEmits<{ select: [item: HsTaxonomyEntry] }>()

const { isLoading, error, load, getItemsForCategory, searchItemsInCategory } = useHsTaxonomy()

const query = ref('')
const activeIndex = ref(-1)
const listboxId = useId()
const searchInputId = useId()
const statusId = useId()

onMounted(() => {
  void load()
})

// Total items in the category, independent of the search query — used for
// the count line and to distinguish "genuinely empty category" (EmptyState)
// from "search matched nothing" (its own, less final-sounding message).
const allItemsInCategory = computed<HsTaxonomyEntry[]>(() =>
  getItemsForCategory(props.categoryCode),
)
const items = computed<HsTaxonomyEntry[]>(() =>
  searchItemsInCategory(props.categoryCode, query.value),
)

watch(items, () => {
  activeIndex.value = -1
})

// A category switch should also clear any leftover query from the previous category.
watch(
  () => props.categoryCode,
  () => {
    query.value = ''
  },
)

const activeOptionId = computed(() =>
  activeIndex.value >= 0 && activeIndex.value < items.value.length
    ? optionId(activeIndex.value)
    : undefined,
)

const statusMessage = computed(() => {
  if (!query.value.trim()) {
    return ''
  }
  return `${items.value.length} item${items.value.length === 1 ? '' : 's'} match your search.`
})

function optionId(index: number): string {
  return `${listboxId}-option-${index}`
}

/**
 * Phase 4 finding M18/Frontend-QA#6 — see CategorySearch.vue's identical
 * guard for the full rationale. Applied symmetrically here too (not just
 * where the bug was reproduced) since the same hazard could in principle
 * recur at this navigation boundary. `pointerEvent` is present only for a
 * real mouse/touch click, omitted for keyboard Enter/Space.
 */
function selectEntry(entry: HsTaxonomyEntry, pointerEvent?: MouseEvent): void {
  if (pointerEvent && isNavigationBlocked(pointerEvent.clientX, pointerEvent.clientY)) {
    return
  }
  if (pointerEvent) {
    markNavigating(pointerEvent.clientX, pointerEvent.clientY)
  }
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
    <EmptyState
      v-else-if="allItemsInCategory.length === 0"
      message="No items found in this category."
    />
    <template v-else>
      <label :for="searchInputId" class="item-list__label">
        Search items in this category
        <input
          :id="searchInputId"
          v-model="query"
          type="text"
          role="searchbox"
          autocomplete="off"
          spellcheck="false"
          class="item-list__search-input"
          placeholder="e.g. horses, sausages…"
          :aria-controls="listboxId"
          :aria-describedby="statusId"
        />
      </label>
      <p :id="statusId" class="visually-hidden" role="status" aria-live="polite">
        {{ statusMessage }}
      </p>

      <p class="item-list__count">
        {{ items.length }} item{{ items.length === 1 ? '' : 's' }}
        <span v-if="query.trim()">of {{ allItemsInCategory.length }}</span>
      </p>

      <p v-if="items.length === 0" class="item-list__empty">No items match "{{ query.trim() }}".</p>
      <VirtualList
        v-else
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
            @click="(event) => selectEntry(item, event)"
            @keydown.enter.prevent="selectEntry(item)"
            @keydown.space.prevent="selectEntry(item)"
            @mouseenter="activeIndex = index"
            @focusin="activeIndex = index"
          >
            <span class="item-list__code">{{ item.hs_code }}</span>
            <span class="item-list__desc" :title="item.description">{{ item.description }}</span>
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

.item-list__label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
}

.item-list__search-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-base);
  font-family: inherit;
}

.item-list__search-input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.item-list__count {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.item-list__empty {
  padding: var(--space-3);
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
  /* VirtualList's offset math assumes every row is exactly ITEM_HEIGHT tall
   * (Phase 4 finding M12/Frontend-Reviewer#1) — nothing enforced that before
   * this rule, and real taxonomy item descriptions run up to 255 chars
   * (verified against the real checked-in public/hs-taxonomy.json: median 95
   * chars, p90 181, max 255 — not the 13-54 char test fixtures), which wrap
   * to 2-4 lines and break the virtualizer's spacer-height/scroll-offset
   * calculations on both mobile (median case) and desktop (tail case).
   * `min-width: 0` is required alongside `flex: 1` for `text-overflow:
   * ellipsis` to take effect at all inside a flex row.
   */
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
