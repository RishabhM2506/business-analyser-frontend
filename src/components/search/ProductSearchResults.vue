<script setup lang="ts">
// Disambiguation list for `outcome: "disambiguate"` search results — reuses
// the same virtualised, WAI-ARIA listbox pattern `ItemList.vue` establishes
// (persistently-visible list, not a combobox popup: the listbox element
// itself is the tab stop and carries aria-activedescendant). A short list
// (at most `app.search.service.MAX_DISAMBIGUATE_CANDIDATES` = 5 candidates)
// doesn't strictly need virtualization, but reusing VirtualList keeps this
// component's keyboard/focus behavior identical to the existing pickers
// rather than a third, subtly-different implementation.
//
// Always ends with one extra, non-candidate row — "Something else" — so a
// search never leaves the user stuck picking the least-wrong option
// (2026-09-02 product decision, `app.search.service`'s own module
// docstring: every search that finds anything real ends on this picker,
// never auto-navigates, so the picker itself must always offer a way out).
// Modeled as one more entry in the *same* listbox (not a separate button
// outside it) so arrow-key navigation moves through the real candidates and
// then to "Something else" as one continuous list, matching how a screen
// reader or keyboard-only user would expect a single picker to behave.
import { computed, ref, useId, watch } from 'vue'

import { isListNavigationKey, nextActiveIndex } from '@/components/common/listNavigation'
import VirtualList from '@/components/common/VirtualList.vue'
import { isNavigationBlocked, markNavigating } from '@/router'
import type { RankedCandidateOut } from '@/types/generated'

const ITEM_HEIGHT = 64
const MAX_LIST_HEIGHT = 480

const props = defineProps<{ candidates: RankedCandidateOut[] }>()
const emit = defineEmits<{ select: [candidate: RankedCandidateOut]; other: [] }>()

type DisplayItem = { kind: 'candidate'; candidate: RankedCandidateOut } | { kind: 'other' }

const displayItems = computed<DisplayItem[]>(() => [
  ...props.candidates.map((candidate): DisplayItem => ({ kind: 'candidate', candidate })),
  { kind: 'other' },
])

const activeIndex = ref(-1)
const listboxId = useId()

watch(
  () => props.candidates,
  () => {
    activeIndex.value = -1
  },
)

const activeOptionId = computed(() =>
  activeIndex.value >= 0 && activeIndex.value < displayItems.value.length
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
function activateItem(item: DisplayItem, pointerEvent?: MouseEvent): void {
  if (pointerEvent && isNavigationBlocked(pointerEvent.clientX, pointerEvent.clientY)) {
    return
  }
  if (pointerEvent) {
    markNavigating(pointerEvent.clientX, pointerEvent.clientY)
  }
  if (item.kind === 'other') {
    emit('other')
    return
  }
  emit('select', item.candidate)
}

function onKeydown(event: KeyboardEvent): void {
  const items = displayItems.value
  if (isListNavigationKey(event.key)) {
    if (items.length === 0) {
      return
    }
    event.preventDefault()
    activeIndex.value = nextActiveIndex(activeIndex.value, event.key, items.length)
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    const item = items[activeIndex.value]
    if (item) {
      event.preventDefault()
      activateItem(item)
    }
  }
}
</script>

<template>
  <VirtualList
    :items="displayItems"
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
        v-if="item.kind === 'candidate'"
        :id="optionId(index)"
        role="option"
        :aria-selected="index === activeIndex ? 'true' : 'false'"
        tabindex="-1"
        class="search-results__option"
        :class="{ 'search-results__option--active': index === activeIndex }"
        @mousedown.prevent
        @click="(event) => activateItem(item, event)"
        @keydown.enter.prevent="activateItem(item)"
        @keydown.space.prevent="activateItem(item)"
        @mouseenter="activeIndex = index"
        @focusin="activeIndex = index"
      >
        <div class="search-results__main">
          <span class="search-results__code">{{ item.candidate.hs_code }}</span>
          <span class="search-results__desc" :title="item.candidate.description">{{
            item.candidate.description
          }}</span>
        </div>
        <span class="search-results__confidence">{{
          formatConfidence(item.candidate.relevance_score)
        }}</span>
      </li>
      <li
        v-else
        :id="optionId(index)"
        role="option"
        :aria-selected="index === activeIndex ? 'true' : 'false'"
        tabindex="-1"
        class="search-results__option search-results__option--other"
        :class="{ 'search-results__option--active': index === activeIndex }"
        @mousedown.prevent
        @click="(event) => activateItem(item, event)"
        @keydown.enter.prevent="activateItem(item)"
        @keydown.space.prevent="activateItem(item)"
        @mouseenter="activeIndex = index"
        @focusin="activeIndex = index"
      >
        <div class="search-results__main">
          <span class="search-results__desc">Something else — describe it again</span>
        </div>
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

.search-results__option--other .search-results__desc {
  color: var(--color-text-muted);
  font-style: italic;
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
