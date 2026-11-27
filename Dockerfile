# Arzi — one image: Express API + built React app + Chromium for PDFs.
# Builds on a clean machine (amd64 or arm64); no API keys needed.

# ---------- Stage 1: install deps, compile native modules, build frontend ----------
FROM node:22-bookworm-slim AS build

# Toolchain so better-sqlite3 can compile if no prebuilt binary matches.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# We use the system Chromium from apt, so Puppeteer must not download its own.
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy manifests first so `npm ci` is cached when only source code changes.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build \
 && npm prune --omit=dev --no-audit --no-fund

# ---------- Stage 2: runtime ----------
FROM node:22-bookworm-slim

# Chromium for PDF rendering + Noto fonts as a system fallback for Indian scripts.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-noto-core ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/src/index.js"]
