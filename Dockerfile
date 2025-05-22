
FROM node:24-alpine AS base
LABEL authors="iSQL"
WORKDIR /app
RUN npm install -g pnpm

# ---- Dependencies Stage ----
# This stage will fetch and install all dependencies, including devDependencies like Prisma CLI.
FROM base AS deps
WORKDIR /app
COPY package.json ./
RUN pnpm install

# ---- Builder Stage ----
# This stage builds the application. It will use dependencies from the 'deps' stage.
FROM deps AS builder
WORKDIR /app

# Copy the Prisma schema first to ensure it's available for generation
COPY prisma ./prisma/

# Copy the rest of your application source code
COPY . .

# This ensures it uses the exact schema and dependencies present in this stage.
RUN pnpm exec prisma generate

# Set build-time ARGs for public environment variables
# These must be passed during the 'docker build' command or in docker-compose build args.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_DOMAIN

ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_CLERK_DOMAIN=${NEXT_PUBLIC_CLERK_DOMAIN}
# Add any other NEXT_PUBLIC_* variables needed at build time

# Build the Next.js application
RUN pnpm build

# ---- Runner Stage (Final Production Image) ----
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user and group for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy application artifacts from the builder stage
# For 'standalone' output:
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy the Prisma schema. The Prisma client needs to know where to find the schema file at runtime.
# The generated client code itself should be part of the .next/standalone/node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Switch to the non-root user
USER nextjs

EXPOSE 3000

# The entrypoint for the standalone output is server.js in the root of the copied standalone files
CMD ["node", "server.js"]