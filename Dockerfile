# Stage 1: Build the TypeScript Discord bot
FROM node:26-bookworm-slim AS bot-builder

WORKDIR /build

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm ci --omit=dev

# Stage 2: Runner binary stage
FROM node:26-bookworm-slim AS runner-base

ARG RUNNER_VERSION=2.321.0
ARG TARGETARCH=amd64

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    jq \
    libicu72 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /runner

RUN ARCH_NAME=$([ "$TARGETARCH" = "arm64" ] && echo "arm64" || echo "x64") && \
    curl -fsSL -o actions-runner.tar.gz \
      "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-${ARCH_NAME}-${RUNNER_VERSION}.tar.gz" && \
    tar xzf actions-runner.tar.gz && \
    rm actions-runner.tar.gz

# Stage 3: Final image containing /bot and /runner
FROM runner-base AS runtime

# Place bot under /bot
WORKDIR /bot
COPY --from=bot-builder /build/package*.json ./
COPY --from=bot-builder /build/node_modules ./node_modules
COPY --from=bot-builder /build/dist ./dist

# Place runner setup script under /runner
WORKDIR /runner
COPY --chmod=755 <<'EOF' /runner/start-runner.sh
#!/usr/bin/env bash
set -euo pipefail

: "${REPO_URL:?REPO_URL is required}"
: "${RUNNER_TOKEN:?RUNNER_TOKEN is required}"

RUNNER_NAME="${RUNNER_NAME:-docker-runner-$(hostname)}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,linux,docker}"
RUNNER_WORK_DIR="${RUNNER_WORK_DIR:-/runner/_work}"

cleanup() {
  if [ -f /runner/.runner ]; then
    /runner/config.sh remove --unattended --token "${RUNNER_TOKEN}" || true
  fi
}
trap cleanup EXIT INT TERM

if [ ! -f /runner/.runner ]; then
  /runner/config.sh \
    --url "${REPO_URL}" \
    --token "${RUNNER_TOKEN}" \
    --name "${RUNNER_NAME}" \
    --labels "${RUNNER_LABELS}" \
    --work "${RUNNER_WORK_DIR}" \
    --unattended \
    --replace
fi

exec /runner/run.sh
EOF

CMD ["node", "/bot/dist/index.js"]