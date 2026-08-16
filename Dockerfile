# Local-dev / compose image. Copies the source at build time rather than
# relying on a bind mount — deliberate, not the usual pattern.
#
# On a host where the project directory lives under a cloud-synced folder
# (iCloud Drive, Dropbox, OneDrive), Docker Desktop's bind-mount file
# sharing races with the sync daemon's on-demand file virtualization and
# Vite's dependency scanner intermittently fails with EDEADLK ("Unknown
# system error -35") reading source files through the mount. A build-time
# COPY reads the source exactly once, outside that race, so it's reliable
# regardless of where the repo happens to sit on the host.
#
# Trade-off accepted: no host-edit hot-reload through this image — that's
# what `npm run dev` on the host (or `docker compose up --build` after a
# change) is for. See docs/CONVENTIONS.md.

FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
