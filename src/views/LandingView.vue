<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import AppButton from '@/components/common/AppButton.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import { useThreadStore } from '@/stores/thread'

const router = useRouter()
const threadStore = useThreadStore()
const { loading, error } = storeToRefs(threadStore)

// POST /threads (docs/PLAN.md §3.3) happens here, once, before the user ever
// sees the search screen — a thread must exist before any search or item
// selection can POST /threads/{id}/search or /messages.
//
// Routes into the free-text search screen (2026-08-20 roadmap decision) as
// the primary flow, not /categories — the category/item picker remains
// fully reachable as a browse-first alternative (ProductSearchView.vue's
// own "Browse by category instead" link), it just isn't the first thing a
// user sees anymore.
async function startProcess(): Promise<void> {
  await threadStore.startThread()
  if (!threadStore.error) {
    void router.push({ name: ROUTE_NAMES.PRODUCT_SEARCH })
  }
}
</script>

<template>
  <main class="landing">
    <div class="landing__glow" aria-hidden="true" />
    <div class="landing__content">
      <p class="landing__eyebrow">Grounded, sourced trade intelligence</p>
      <h1 tabindex="-1">Business Analyser</h1>
      <p class="landing__lead">
        Describe a product or pick an HS trade code, and get a grounded 5-year analysis of
        <strong>India's</strong> imports and exports for its top trading partners — every figure
        sourced straight from UN Comtrade.
      </p>
      <ErrorState
        v-if="error"
        :message="error.message"
        :retryable="error.retryable"
        @retry="startProcess"
      />
      <AppButton v-else :disabled="loading" @click="startProcess">
        {{ loading ? 'Starting…' : 'Start my process' }}
      </AppButton>
    </div>
  </main>
</template>

<style scoped>
.landing {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-8) var(--space-4);
  overflow: hidden;
}

.landing__glow {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(
      42rem 24rem at 20% -10%,
      color-mix(in srgb, var(--color-primary) 16%, transparent),
      transparent 65%
    ),
    radial-gradient(
      36rem 24rem at 100% 10%,
      color-mix(in srgb, var(--color-accent) 14%, transparent),
      transparent 60%
    );
  pointer-events: none;
}

.landing__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
  max-width: 40rem;
}

.landing__eyebrow {
  /* --color-text, not --color-primary: see ProductSearchResults.vue's
   * identical fix/comment — --color-primary is a background-only token
   * (tokens.css) and fails AA (~2.6:1) as text against a primary-tinted
   * background this dark in dark mode, even though it happens to pass in
   * light mode alone. */
  margin: 0;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.landing h1 {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-extrabold);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-tight);
  margin: 0;
  /* Solid, always-legible color by default; the gradient treatment below is
   * a progressive enhancement gated on real support for the clip property
   * it depends on, so a browser without it never falls back to invisible
   * (transparent-on-transparent) text. */
  color: var(--color-text);
}

@supports (background-clip: text) or (-webkit-background-clip: text) {
  .landing h1 {
    background: linear-gradient(135deg, var(--color-text) 40%, var(--color-primary));
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
  }
}

.landing__lead {
  color: var(--color-text-muted);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-base);
  margin: 0;
}

.landing__lead strong {
  color: var(--color-text);
}
</style>
