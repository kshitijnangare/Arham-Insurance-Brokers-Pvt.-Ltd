# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests and install ALL dependencies (including devDependencies for Vite)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and run the production build
COPY . .
RUN npm run build
# Output: /app/dist

# ─── Stage 2: Serve with Nginx ────────────────────────────────────────────────
FROM nginx:stable-alpine AS runner

# Remove the default Nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom Nginx config (handles SPA routing + /api proxy to backend)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (mapped in docker-compose.yml)
EXPOSE 80

# Nginx runs in foreground by default with the base image
CMD ["nginx", "-g", "daemon off;"]
