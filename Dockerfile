FROM node:24-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat openssl ffmpeg
RUN mkdir -p /app/.data/media && chown -R node:node /app

USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --include=dev

COPY --chown=node:node . .
RUN npm run build

FROM base AS migrator
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runner
RUN npm prune --omit=dev --omit=peer

EXPOSE 3000

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
