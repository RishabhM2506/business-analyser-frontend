<script setup lang="ts">
// Root shell — mostly the router outlet, plus the one piece of persistent,
// cross-route UI this app needs: an aria-live announcement of each
// navigation (Phase 4 finding M17/Frontend-QA#5), since it has to live
// somewhere that survives every route's own component being unmounted.
import { routeAnnouncement } from '@/router'
</script>

<template>
  <p class="visually-hidden" role="status" aria-live="polite">{{ routeAnnouncement }}</p>
  <RouterView />
</template>
