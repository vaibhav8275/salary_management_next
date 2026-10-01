# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage
# ---------------------------------------------------------------------------
# Debian, not Alpine. Alpine ships musl rather than glibc, and the native modules
# in this dependency tree (sharp for next/image, and anything else with a
# prebuilt binary) would need compiling from source against musl on the first
# build. Debian slim means npm can use the prebuilt binaries and the build stays
# fast, at the cost of a somewhat larger base.
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Dependencies are copied and installed before the rest of the source, so that
# editing a component does not invalidate the 400MB node_modules layer. This
# single layer is the whole reason for the cache mount: without it every build
# re-downloads the tree even when only application code changed.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .

# NEXT_TELEMETRY_DISABLED stops the build printing an anonymous usage ping on
# every deploy. Harmless, just noisy.
ENV NEXT_TELEMETRY_DISABLED=1

# RAILS_API_URL is deliberately NOT set here. src/lib/api.ts reads it, but only
# from Server Components, Server Actions and Route Handlers -- never from the
# browser. That means it is read at run time from the environment, so it belongs
# in config/deploy.yml as a clear value rather than being baked in at build time.
#
# Setting it as a build ARG would also be a lie about how it works: only
# NEXT_PUBLIC_* variables are inlined into the client bundle, so a value added
# here would quietly change nothing for any code that did run in the browser.
#
# Nothing in this image depends on the API URL at build time, which is also why
# the same image is reusable across environments.

RUN npm run build

# ---------------------------------------------------------------------------
# Runtime stage
# ---------------------------------------------------------------------------
# Only the standalone output and the static assets are carried forward. There is
# no package manager, no shell tooling beyond what the image already has, and no
# source tree.
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Unprivileged, matching the numeric uid used by the node image. A container
# process that does not need root should not have it: this is the boundary that
# matters if something is ever pushed to this host.
#
# --chown on COPY is what makes the files readable by the uid the app drops to.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# The standalone bundle: a minimal server.js plus the traced node_modules and a
# copy of public/ and .next/static.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./

# These two live outside standalone/ and would be 404 without them -- the
# standalone server does not serve static files unless you give it the
# directory, it only serves the server and the traced dependencies.
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# next start would ignore standalone entirely and look for a .next directory
# that is not in this image. node server.js is the standalone entrypoint.
#
# Exec form, so node is PID 1 and receives SIGTERM directly for fast shutdown --
# the shell form would swallow the signal and Kamal would have to wait out the
# grace period on every deploy. PORT stays overridable regardless: standalone
# reads it from the environment, which the ENV above already sets.
CMD ["node", "server.js"]
