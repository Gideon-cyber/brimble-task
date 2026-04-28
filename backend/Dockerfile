FROM node:22-alpine AS base

# System packages: git (clone), docker-cli (run containers), unzip + tar (archive extraction)
RUN apk add --no-cache git curl unzip tar docker-cli ca-certificates

# Install Railpack binary (musl-linked static binary for Alpine)
ARG RAILPACK_VERSION=0.23.0
ARG TARGETARCH=amd64
RUN ARCH="x86_64" && \
    if [ "$TARGETARCH" = "arm64" ]; then ARCH="aarch64"; fi && \
    curl -fsSL \
      "https://github.com/railwayapp/railpack/releases/download/v${RAILPACK_VERSION}/railpack-v${RAILPACK_VERSION}-${ARCH}-unknown-linux-musl.tar.gz" \
      -o /tmp/rp.tar.gz \
    && tar -xzf /tmp/rp.tar.gz -C /usr/local/bin railpack \
    && chmod +x /usr/local/bin/railpack \
    && rm /tmp/rp.tar.gz \
    && railpack --version

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

EXPOSE 3001

CMD ["node", "--import", "tsx/esm", "src/index.ts"]
