# DTax API — Multi-stage Docker build
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/tax-engine/package.json packages/tax-engine/
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod=false

# Build
FROM deps AS build
COPY packages/tax-engine/ packages/tax-engine/
COPY packages/shared-types/ packages/shared-types/
COPY apps/api/ apps/api/
RUN pnpm --filter @dtax/shared-types run build && \
    pnpm --filter @dtax/tax-engine run build && \
    pnpm --filter @dtax/api run build
RUN pnpm --filter @dtax/api exec prisma generate

# Production image
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/tax-engine/dist ./packages/tax-engine/dist
COPY --from=build /app/packages/tax-engine/package.json ./packages/tax-engine/
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
