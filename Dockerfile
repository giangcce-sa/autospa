FROM node:24-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT=standalone

RUN apk add --no-cache libc6-compat openssl ffmpeg
RUN mkdir -p /app/.data/media && chown -R node:node /app

USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --include=dev

COPY --chown=node:node . .
RUN npm run build

FROM base AS migrator
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:24-alpine AS runner

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat openssl ffmpeg
RUN mkdir -p /app/.data/media /app/public/uploads && chown -R node:node /app

USER node

# Minimal runtime: traced server + static assets only (no source, no full node_modules)
COPY --chown=node:node --from=base /app/.next/standalone ./
COPY --chown=node:node --from=base /app/.next/static ./.next/static
COPY --chown=node:node --from=base /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
