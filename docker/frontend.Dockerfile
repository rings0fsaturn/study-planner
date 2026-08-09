# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

RUN npm install -g pnpm@10.33.2

WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/design-tokens/package.json packages/design-tokens/package.json
COPY packages/progress/package.json packages/progress/package.json
COPY packages/roadmap-engine/package.json packages/roadmap-engine/package.json
COPY apps/app/package.json apps/app/package.json
COPY apps/marketing/package.json apps/marketing/package.json

RUN pnpm install --frozen-lockfile

COPY packages/design-tokens packages/design-tokens
COPY packages/progress packages/progress
COPY packages/roadmap-engine packages/roadmap-engine
COPY apps/app apps/app
COPY apps/marketing apps/marketing

ARG SUPABASE_URL
ARG SUPABASE_PUBLISHABLE_KEY
ARG VITE_INTELLIGENCE_URL=/api
ARG VITE_INITIAL_RESTORE_TIMEOUT_MS=8000
ENV SUPABASE_URL=$SUPABASE_URL \
    SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY \
    VITE_INTELLIGENCE_URL=$VITE_INTELLIGENCE_URL \
    VITE_INITIAL_RESTORE_TIMEOUT_MS=$VITE_INITIAL_RESTORE_TIMEOUT_MS

RUN pnpm build

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/apps/marketing/dist/ /usr/share/nginx/html/
COPY --from=builder /repo/apps/app/dist/ /usr/share/nginx/html/study/

EXPOSE 80
