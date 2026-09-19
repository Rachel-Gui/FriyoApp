# ────────────────────────────────────────────────────────────────────────────
# Stage 1 — Builder
# ────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install build tools needed for native modules (sharp, bcrypt)
RUN apk add --no-cache python3 make g++

# Copy dependency manifests first (maximise layer cache)
COPY package*.json ./

RUN npm ci

# Copy source and compile
COPY . .
RUN npm run build

# Prune to production dependencies only
RUN npm prune --omit=dev

# ────────────────────────────────────────────────────────────────────────────
# Stage 2 — Production image
# ────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production

# Security: run as non-root user
RUN addgroup -S friyo && adduser -S friyo -G friyo

WORKDIR /app

# Runtime dependencies (must run as root before USER switch)
RUN apk add --no-cache dumb-init

# Copy compiled output + pruned node_modules from builder
COPY --from=builder --chown=friyo:friyo /app/dist         ./dist
COPY --from=builder --chown=friyo:friyo /app/node_modules ./node_modules
COPY --from=builder --chown=friyo:friyo /app/package.json ./package.json

USER friyo

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]

# ── Health check ──────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1
