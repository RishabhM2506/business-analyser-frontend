<script setup lang="ts" generic="T">
// Generic, presentation-only row virtualizer: renders only the rows within
// (or near) the visible viewport instead of the full array, so a 500+ row HS
// chapter (docs/PLAN.md's approved "virtualised list" for the HS pickers)
// doesn't mount hundreds of DOM nodes at once. Two real callers today —
// CategorySearch.vue (combobox popup) and ItemList.vue (plain listbox) —
// which render different row markup, hence a scoped slot rather than a fixed
// template.
//
// Structural note: the scrollable/sizing machinery (viewport + spacer divs)
// deliberately sits *outside* the rendered `tag` element, not between it and
// its rows. A listbox's `role="option"` children must be direct DOM children
// of the `role="listbox"` element for assistive tech to compute the
// owned-elements relationship correctly — inserting wrapper divs in between
// would break that even though nothing would look different visually. `id`
// / `role` / `aria-label` are taken as explicit props (not `$attrs`
// fallthrough) so they land on that exact element deterministically — an
// attrs-forwarded class on a non-root child element wouldn't reliably pick up
// the calling component's `<style scoped>` data attribute, so callers style
// rows via the scoped-slot content instead (which does keep their own scope).
//
// All sizing math is delegated to the pure `computeVirtualRange` (see
// virtualRange.ts) — this component never reads layout back from the DOM
// (no `clientHeight`/`getBoundingClientRect`), so behavior is fully
// deterministic and testable under jsdom, which doesn't perform real layout.
import { computed, ref, watch } from 'vue'

import { computeVirtualRange } from './virtualRange'

const props = withDefaults(
  defineProps<{
    items: readonly T[]
    /** Fixed row height in pixels — required for the offset math to stay O(1). */
    itemHeight: number
    /** Maximum viewport height in pixels; shrinks to fit when there are few items. */
    maxHeight: number
    /** Index to keep scrolled into view (e.g. the keyboard-active option). `-1` = none. */
    activeIndex?: number
    overscan?: number
    /** Element the rows are rendered into — `ul` for a listbox, `div` for a plain popup. */
    tag?: string
    listId?: string
    listRole?: string
    listAriaLabel?: string
    /**
     * For a standalone listbox (ItemList.vue) the *listbox element itself*
     * must be the DOM focus target and must carry `aria-activedescendant` —
     * both have to land on the same element role/id land on, so they're
     * explicit props rather than something the caller could only attach to
     * VirtualList's outer scroll wrapper via native attrs fallthrough.
     */
    listTabindex?: string
    listActiveDescendant?: string
  }>(),
  {
    activeIndex: -1,
    overscan: 4,
    tag: 'ul',
    listId: undefined,
    listRole: 'listbox',
    listAriaLabel: undefined,
    listTabindex: undefined,
    listActiveDescendant: undefined,
  },
)

const emit = defineEmits<{ keydown: [event: KeyboardEvent] }>()

defineSlots<{
  default(scope: { item: T; index: number }): unknown
}>()

const viewportRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)

function onScroll(event: Event): void {
  scrollTop.value = (event.target as HTMLElement).scrollTop
}

const viewportHeight = computed(() =>
  Math.min(props.maxHeight, Math.max(1, props.items.length) * props.itemHeight),
)

const range = computed(() =>
  computeVirtualRange({
    scrollTop: scrollTop.value,
    viewportHeight: viewportHeight.value,
    itemHeight: props.itemHeight,
    itemCount: props.items.length,
    overscan: props.overscan,
  }),
)

const visibleEntries = computed(() => {
  const out: Array<{ item: T; index: number }> = []
  for (let index = range.value.startIndex; index <= range.value.endIndex; index += 1) {
    const item = props.items[index]
    if (item !== undefined) {
      out.push({ item, index })
    }
  }
  return out
})

// Keeps the active row inside the rendered/visible window whenever it moves
// via keyboard (not the mouse) — required so aria-activedescendant always
// points at an element that actually exists in the DOM right now.
watch(
  () => props.activeIndex,
  (index) => {
    const el = viewportRef.value
    if (index === undefined || index < 0 || !el) {
      return
    }
    const itemTop = index * props.itemHeight
    const itemBottom = itemTop + props.itemHeight
    if (itemTop < el.scrollTop) {
      el.scrollTop = itemTop
      scrollTop.value = itemTop
    } else if (itemBottom > el.scrollTop + viewportHeight.value) {
      const next = itemBottom - viewportHeight.value
      el.scrollTop = next
      scrollTop.value = next
    }
  },
)
</script>

<template>
  <div
    ref="viewportRef"
    class="virtual-list-viewport"
    :style="{ maxHeight: `${viewportHeight}px` }"
    @scroll="onScroll"
  >
    <div class="virtual-list-spacer" :style="{ height: `${range.totalHeight}px` }">
      <component
        :is="tag"
        :id="listId"
        :role="listRole"
        :aria-label="listAriaLabel"
        :tabindex="listTabindex"
        :aria-activedescendant="listActiveDescendant"
        class="virtual-list-window"
        :style="{ transform: `translateY(${range.offsetTop}px)` }"
        @keydown="(event: KeyboardEvent) => emit('keydown', event)"
      >
        <template v-for="entry in visibleEntries" :key="entry.index">
          <slot :item="entry.item" :index="entry.index" />
        </template>
      </component>
    </div>
  </div>
</template>

<style scoped>
.virtual-list-viewport {
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-bg);
}

.virtual-list-spacer {
  position: relative;
  width: 100%;
}

.virtual-list-window {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
