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
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter "@sige/api..."

FROM deps AS development
COPY packages/config packages/config
COPY packages/types packages/types
COPY apps/api apps/api
EXPOSE 4000
CMD ["pnpm", "--filter", "@sige/api", "dev"]

FROM deps AS build
COPY packages/config packages/config
COPY packages/types packages/types
COPY apps/api apps/api
RUN pnpm --filter @sige/types build
RUN pnpm --filter @sige/api build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod --filter "@sige/api..."
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
RUN pnpm --filter @sige/api exec prisma generate

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache openssl \
    && addgroup -S sige \
    && adduser -S sige -G sige \
    && mkdir -p /app/almacen \
    && chown sige:sige /app/almacen
COPY --from=prod-deps --chown=sige:sige /app/package.json ./package.json
COPY --from=prod-deps --chown=sige:sige /app/node_modules ./node_modules
COPY --from=prod-deps --chown=sige:sige /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps --chown=sige:sige /app/apps/api/package.json ./apps/api/package.json
COPY --from=prod-deps --chown=sige:sige /app/apps/api/prisma ./apps/api/prisma
COPY --from=prod-deps --chown=sige:sige /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=prod-deps --chown=sige:sige /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=build --chown=sige:sige /app/packages/types/package.json ./packages/types/package.json
COPY --from=build --chown=sige:sige /app/packages/types/dist ./packages/types/dist
COPY --from=build --chown=sige:sige /app/apps/api/dist ./apps/api/dist
COPY --chown=sige:sige apps/api/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
USER sige
WORKDIR /app/apps/api
EXPOSE 4000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main.js"]
