<script setup lang="ts">
// Disambiguation list for `outcome: "disambiguate"` search results — reuses
// the same virtualised, WAI-ARIA listbox pattern `ItemList.vue` establishes
// (persistently-visible list, not a combobox popup: the listbox element
// itself is the tab stop and carries aria-activedescendant). A short list
// (typically <= 8 candidates, `app/search/rerank.py`'s `RerankOutput.
// ranked_candidates` cap) doesn't strictly need virtualization, but reusing
// VirtualList keeps this component's keyboard/focus behavior identical to
// the existing pickers rather than a third, subtly-different implementation.
import { computed, ref, useId, watch } from 'vue'

import { isListNavigationKey, nextActiveIndex } from '@/components/common/listNavigation'
import VirtualList from '@/components/common/VirtualList.vue'
import { isNavigationBlocked, markNavigating } from '@/router'
import type { RankedCandidateOut } from '@/types/generated'

const ITEM_HEIGHT = 64
const MAX_LIST_HEIGHT = 480

const props = defineProps<{ candidates: RankedCandidateOut[] }>()
const emit = defineEmits<{ select: [candidate: RankedCandidateOut] }>()

const activeIndex = ref(-1)
const listboxId = useId()

watch(
  () => props.candidates,
  () => {
    activeIndex.value = -1
  },
)

const activeOptionId = computed(() =>
  activeIndex.value >= 0 && activeIndex.value < props.candidates.length
    ? optionId(activeIndex.value)
    : undefined,
)

function optionId(index: number): string {
  return `${listboxId}-option-${index}`
}

function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}% match`
}

/** Mirrors ItemList.vue's identical M18/Frontend-QA#6 guard. */
function selectCandidate(candidate: RankedCandidateOut, pointerEvent?: MouseEvent): void {
  if (pointerEvent && isNavigationBlocked(pointerEvent.clientX, pointerEvent.clientY)) {
    return
  }
  if (pointerEvent) {
    markNavigating(pointerEvent.clientX, pointerEvent.clientY)
  }
  emit('select', candidate)
}

function onKeydown(event: KeyboardEvent): void {
  if (isListNavigationKey(event.key)) {
    if (props.candidates.length === 0) {
      return
    }
    event.preventDefault()
    activeIndex.value = nextActiveIndex(activeIndex.value, event.key, props.candidates.length)
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    const candidate = props.candidates[activeIndex.value]
    if (candidate) {
      event.preventDefault()
      selectCandidate(candidate)
    }
  }
}
</script>

<template>
  <VirtualList
    :items="candidates"
    :item-height="ITEM_HEIGHT"
    :max-height="MAX_LIST_HEIGHT"
    :active-index="activeIndex"
    :list-id="listboxId"
    list-role="listbox"
    list-aria-label="Matching HS product codes"
    list-tabindex="0"
    :list-active-descendant="activeOptionId"
    tag="ul"
    class="search-results"
    @keydown="onKeydown"
  >
    <template #default="{ item, index }">
      <li
        :id="optionId(index)"
        role="option"
        :aria-selected="index === activeIndex ? 'true' : 'false'"
        tabindex="-1"
        class="search-results__option"
        :class="{ 'search-results__option--active': index === activeIndex }"
        @mousedown.prevent
        @click="(event) => selectCandidate(item, event)"
        @keydown.enter.prevent="selectCandidate(item)"
        @keydown.space.prevent="selectCandidate(item)"
        @mouseenter="activeIndex = index"
        @focusin="activeIndex = index"
      >
        <div class="search-results__main">
          <span class="search-results__code">{{ item.hs_code }}</span>
          <span class="search-results__desc" :title="item.description">{{ item.description }}</span>
        </div>
        <span class="search-results__confidence">{{ formatConfidence(item.relevance_score) }}</span>
      </li>
    </template>
  </VirtualList>
</template>

<style scoped>
.search-results:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.search-results__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  transition: background-color 0.1s ease;
}

.search-results__option:last-child {
  border-bottom: none;
}

.search-results__option--active {
  background-color: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));
}

.search-results__main {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.search-results__code {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.search-results__desc {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.search-results__confidence {
  /* --color-text, not --color-primary: verified ≥4.5:1 against this tinted
   * background in both themes (light 14.9:1, dark 14.9:1) — --color-primary
   * itself is a background-only token (tokens.css's own doc comment) and
   * measures only ~2.6:1 as text against a primary-tinted background this
   * dark (the same class of failure M16/Frontend-QA#4 fixed elsewhere).
   * The tint + pill shape + weight still read as a distinct badge without
   * needing colored text. */
  flex-shrink: 0;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}
</style>
