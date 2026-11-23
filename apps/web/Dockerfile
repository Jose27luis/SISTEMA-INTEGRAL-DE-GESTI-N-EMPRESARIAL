# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter "@sige/web..."

FROM deps AS development
COPY packages/config packages/config
COPY packages/types packages/types
COPY packages/ui packages/ui
COPY apps/web apps/web
EXPOSE 3000
CMD ["pnpm", "--filter", "@sige/web", "dev"]

FROM deps AS build
COPY packages/config packages/config
COPY packages/types packages/types
COPY packages/ui packages/ui
COPY apps/web apps/web
RUN pnpm --filter @sige/types build
RUN pnpm --filter @sige/web build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S sige && adduser -S sige -G sige
COPY --from=build --chown=sige:sige /app/apps/web/.next/standalone ./
COPY --from=build --chown=sige:sige /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=sige:sige /app/apps/web/public ./apps/web/public
USER sige
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
