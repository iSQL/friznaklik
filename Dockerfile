# Dockerfile

# ---- Base Stage ----
# Use Node.js 23 Alpine image as requested.
FROM node:23-alpine AS base
LABEL authors="iSQL"

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# ---- Dependencies Stage ----
FROM base AS deps
WORKDIR /app

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./
# Copy prisma schema for generation step
COPY prisma ./prisma/

# Install dependencies using pnpm
# --frozen-lockfile ensures pnpm uses the lockfile without generating changes
# Include dev dependencies as Prisma CLI is often a dev dependency
RUN pnpm install --frozen-lockfile

# Generate Prisma client based on your schema
# This needs to happen after dependencies are installed
RUN pnpm exec prisma generate

# ---- Builder Stage ----
FROM base AS builder
WORKDIR /app

# --- Add Build Arguments ---
# Declare arguments that can be passed during the build
ARG NEXT_PUBLIC_SITE_URL

# Copy dependencies and prisma client from the 'deps' stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
# Copy the rest of your application code
COPY . .

# --- Set Environment Variables for Build ---
# Make the build arguments available as environment variables for the build command //TODO: refactor site url usage to not use env var
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

# Build the Next.js application
# The output will be in .next/standalone thanks to `output: 'standalone'` in next.config.ts
# This command now has access to the ENV variables set above
RUN pnpm build

# ---- Runner Stage ----
# Use the Node.js 23 Alpine image for the final stage as well, todo: consider 23-slim if needed for compatibility
FROM node:23-alpine AS runner
WORKDIR /app

# Set environment variable for Node.js to production
ENV NODE_ENV=production
# Optionally, set the NEXT_TELEMETRY_DISABLED flag
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# --- Copy Artifacts ---
# Copy the standalone build output from the builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copy the static files
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Copy the .next/static files (needed for client-side assets)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# --- Explicitly copy node_modules and prisma schema for CLI ---
# Copy the full node_modules from the 'deps' stage to ensure CLI tools are present
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
# Copy the prisma schema needed by the CLI
COPY --from=deps --chown=nextjs:nodejs /app/prisma ./prisma

# Change ownership of the app directory to the non-root user (redundant but safe)
# USER nextjs # Moved USER command after copying

# Switch to the non-root user
USER nextjs

# Expose the port the app runs on (default is 3000)
EXPOSE 3000

# Set the command to start the application
# The standalone output uses a server.js file
CMD ["node", "server.js"]
