# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /build

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# Stage 2: Runtime (distroless, runs as uid 65532 by default — no root)
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app

COPY --from=builder --chown=65532:65532 /build/dist/index.js ./index.js

VOLUME ["/data"]
ENV NODE_ENV=production
EXPOSE 3000

CMD ["index.js"]
