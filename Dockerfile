FROM node:20.11.0 as build
WORKDIR /usr/local/app
ARG VCS_HASH
ARG VCS_BRANCH
ARG VCS_TAG
ARG COMMIT_AT
ARG BUILD_AT

# Install dependencies in a separate layer to maximize Docker build cache reuse.
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source and build.
COPY . .
RUN set -eux; \
    vcs_hash="${VCS_HASH:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"; \
    vcs_name="${VCS_NAME:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')}"; \
    commit_at="${COMMIT_AT:-$(git show -s --format=%cI HEAD 2>/dev/null || echo '')}"; \
    build_at="${BUILD_AT:-$(date -u +"%Y-%m-%dT%H:%M:%S%z")}"; \
    printf '{\n  "vcs_hash": "%s",\n  "vcs_name": "%s",\n  "commit_at": "%s",\n  "build_at": "%s"\n}\n' \
      "$vcs_hash" "$vcs_name" "$commit_at" "$build_at" > src/assets/frontend-version.json
RUN npm run build


FROM nginx:latest
COPY --from=build /usr/local/app/dist/shvatka/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst < /usr/share/nginx/html/assets/env.template.js > /usr/share/nginx/html/assets/env.js && exec nginx -g 'daemon off;'"]
