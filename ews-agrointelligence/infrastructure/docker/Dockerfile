FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /app
FROM base AS dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile
FROM dependencies AS source
COPY . .
FROM source AS web-build
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @ews/web build
FROM base AS web
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node","apps/web/server.js"]
FROM source AS api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000
USER node
EXPOSE 4000
CMD ["node","apps/api/src/server.ts"]
FROM source AS worker
ENV NODE_ENV=production
USER node
CMD ["node","apps/worker/index.ts"]
FROM source AS test
ENV NODE_ENV=test
CMD ["node","--test","tests/core.test.ts","tests/automation.test.ts","tests/tenant-data.test.ts","tests/transport-migration.test.ts","tests/hardening.test.ts","tests/pilot-flow.test.ts","tests/postgres.test.ts"]
