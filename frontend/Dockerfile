# Production image — two-stage build (no host-side npm required).
# Mirrors scripts/build_frontend_dist.sh:
#   npm ci + VITE_IS_DOCKER=true + VITE_FRONTEND_COMMIT
#
# Dist is architecture-independent. The builder uses $BUILDPLATFORM so
# multi-arch CI (linux/amd64,linux/arm64) compiles Vite once on the runner
# instead of qemu-emulating Node, and both runtime images share the same dist.
#
#   docker build --platform linux/amd64 \
#     --build-arg VITE_FRONTEND_COMMIT=$(git rev-parse --short HEAD) \
#     -t wechatopenai/weknora-ui:latest \
#     frontend/
#
# Optional npm mirror (e.g. corporate registry):
#   --build-arg NPM_REGISTRY=https://registry.npmmirror.com
#
# Docker Desktop with a small VM:
#   --build-arg NODE_MAX_OLD_SPACE_SIZE=2048

# ---------------------------------------------------------------------------
# Stage 1 build image. Digest unpinned so an operator-provided registry
# mirror (e.g. in mainland China where Docker Hub is blocked) can resolve the tag.
FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS builder

WORKDIR /frontend

ARG NPM_REGISTRY=
ARG NODE_MAX_OLD_SPACE_SIZE=4096
# Offline build: when set to 1, skip npm ci / npm run build and package the
# dist/ directory already present in the build context (produced on the host
# where npm registry access works). Default 0 keeps the self-contained build.
ARG SKIP_NPM_BUILD=0

ENV VITE_IS_DOCKER=true
# Vite production builds of this SPA routinely exceed Node's default heap.
ENV NODE_OPTIONS="--max-old-space-size=${NODE_MAX_OLD_SPACE_SIZE}"

# The lockfile pins the remote SheetJS archive and its integrity hash.
COPY package.json package-lock.json ./
RUN if [ "$SKIP_NPM_BUILD" != "1" ]; then \
      if [ -n "$NPM_REGISTRY" ]; then \
        npm ci --registry="$NPM_REGISTRY"; \
      else \
        npm ci; \
      fi; \
    fi

COPY . .
# After npm ci so a new commit hash does not bust the dependency layer.
ARG VITE_FRONTEND_COMMIT=unknown
ENV VITE_FRONTEND_COMMIT=${VITE_FRONTEND_COMMIT}
RUN if [ "$SKIP_NPM_BUILD" != "1" ]; then npm run build; fi

# ---------------------------------------------------------------------------
# Stage 2: nginx runtime
# ---------------------------------------------------------------------------
# Base pinned by tag so an operator-provided registry mirror can resolve it;
# the mirror in use (DaoCloud) serves nginx 1.30.3 / Alpine 3.23.5, the same
# base as the working v0.6.3 image.
FROM nginx:1.30.3-alpine

COPY --from=builder /frontend/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copied outside templates/ on purpose: envsubst would eat $host and the other
# nginx variables in it.
COPY nginx-api-proxy.conf /etc/nginx/api-proxy.conf
COPY nginx-http.conf /etc/nginx/conf.d/00-weknora-http.conf

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV MAX_FILE_SIZE_MB=50

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
