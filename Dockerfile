FROM node:20-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    ca-certificates \
    gettext-base \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ARG SUPERCRONIC_VERSION=v0.2.33
ARG TARGETARCH
RUN case "${TARGETARCH}" in \
      arm64) SUPERCRONIC_ARCH=linux-arm64 ;; \
      *) SUPERCRONIC_ARCH=linux-amd64 ;; \
    esac \
  && curl -fsSL \
    "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-${SUPERCRONIC_ARCH}" \
    -o /usr/local/bin/supercronic \
  && chmod +x /usr/local/bin/supercronic

RUN groupadd -g 1001 nodejs \
  && useradd -u 1001 -g nodejs -m nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY docker/entrypoint.sh docker/crontab.template ./docker/

RUN chmod +x /app/docker/entrypoint.sh \
  && mkdir -p /app/data \
  && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -sf "http://127.0.0.1:3000/login" > /dev/null || exit 1

ENTRYPOINT ["/app/docker/entrypoint.sh"]
