# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy manifests first to leverage Docker layer caching
COPY package.json package-lock.json* ./

# Install production + dev dependencies (dev needed for nodemon in dev, but
# we keep it lean here — only prod for the final image)
RUN npm ci --omit=dev

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Set NODE_ENV so any library that checks it behaves correctly
ENV NODE_ENV=production

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Expose Express port
EXPOSE 5000

# Health-check so Docker Compose wait logic can use it
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "src/index.js"]
