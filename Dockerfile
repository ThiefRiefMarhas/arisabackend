# ============================================
# ARISA Cloud Backend — Production Dockerfile
# Multi-stage build for Google Cloud Run
# ============================================

# ── Stage 1: Install production dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# ── Stage 2: Build application ──
FROM node:20-alpine AS build
WORKDIR /app

# Copy all dependencies (dev + prod) for building
COPY package.json package-lock.json ./
RUN npm ci

# Copy Prisma schema first for client generation
COPY prisma ./prisma

# Generate Prisma Client (needs DATABASE_URL at build time for schema parsing only)
# We use a dummy URL — actual connection happens at runtime via env vars
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
    npx prisma generate

# Copy source code
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

# Build NestJS
RUN npm run build

# ── Stage 3: Production image ──
FROM node:20-alpine AS production
WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S arisa && \
    adduser -S arisa -u 1001 -G arisa

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build /app/dist ./dist

# Copy Prisma schema + generated client from build stage
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy package.json for metadata
COPY package.json ./

# Switch to non-root user
USER arisa

# Cloud Run injects PORT env var (default 8080)
# Our app reads process.env.PORT (defaults to 3000 for local dev)
EXPOSE 8080

# Health check — Cloud Run uses HTTP health checks
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-8080}/health || exit 1

# Start the application
CMD ["node", "dist/main.js"]
