# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /build

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# Pre-create /data owned by uid 65532 so a fresh Docker volume mount inherits ownership.
RUN mkdir -p /data-stub && chown 65532:65532 /data-stub

# Stage 2: Runtime (distroless, runs as uid 65532 by default — no root)
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app

COPY --from=builder --chown=65532:65532 /build/dist/index.js ./index.js
COPY --from=builder --chown=65532:65532 /data-stub /data

VOLUME ["/data"]
ENV NODE_ENV=production
EXPOSE 3000

CMD ["index.js"]
