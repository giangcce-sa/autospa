FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json vitest.config.ts ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir -p /app/data /app/audit-logs /app/kiro-workspaces \
  && chown -R node:node /app/data /app/audit-logs /app/kiro-workspaces
USER node
EXPOSE 8787
CMD ["node", "dist/server.js"]
