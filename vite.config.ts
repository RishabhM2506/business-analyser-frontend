import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Dev-only convenience: proxy same-origin `/api` calls to the local backend
    // so the browser never has to deal with cross-origin cookies/CORS in dev.
    //
    // Target is environment-aware (Phase 4 finding B5/Frontend-QA#1): this dev
    // server also runs *inside* the frontend's own Docker container in the
    // docker-compose setup (see Dockerfile), where `localhost` means "this
    // container," not the sibling `backend` service — a hardcoded
    // `localhost:8000` target can never reach it there even though it works
    // fine for `npm run dev` on the host. `docker-compose.yml` sets
    // VITE_PROXY_TARGET=http://backend:8000 for the containerized case; the
    // `localhost:8000` fallback keeps host-side `npm run dev` working
    // unchanged (reachable via Docker's published port).
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
        // The real backend's routes are unprefixed (`/threads`, `/healthz` —
        // not `/api/threads`) — without this rewrite, a request to
        // `/api/threads` is forwarded as `/api/threads` (path unchanged) and
        // 404s (Phase 4 finding ARCH-07, fixed alongside B5 since it's the
        // same proxy config).
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
