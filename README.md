# Brimble Deploy Task

A deployment pipeline platform: submit a Git URL or project archive → Railpack builds a container image → Docker runs it → Caddy reverse-proxies traffic to it. Build and deploy logs stream live to the UI over SSE.

## Quick Start

```bash
docker compose up --build
```

Open [http://localhost](http://localhost). No env vars required — sensible defaults are baked in.

> **Prerequisites:** Docker and Docker Compose. Nothing else.

---

## How It Works

```
User → UI → POST /api/deployments
              ↓
         Backend clones repo (or extracts archive)
              ↓
         railpack build → Docker image
              ↓
         docker run --network brimble_net
              ↓
         Caddy admin API → /dep-<id> route added
              ↓
         http://localhost/dep-<id> → live app
```

Build and deploy logs are captured from subprocess stdout/stderr, written synchronously to SQLite, and broadcast to any connected SSE clients. Reconnecting clients replay missed lines via `?from=<lastSeq>`.

## Architecture

| Service | Role |
|---------|------|
| `caddy` | Single ingress on `:80`. Serves frontend, proxies `/api/*` to backend, and routes `/dep-<id>/*` to deployed containers. Routes added/removed dynamically via Caddy's admin API on `:2019`. |
| `backend` | Hono (TypeScript). Manages the pipeline: git clone / archive extract → Railpack build → Docker run → Caddy route. Stores state in SQLite. Streams logs over SSE. |
| `buildkit` | BuildKit daemon. Railpack requires a BuildKit daemon reachable via `BUILDKIT_HOST`. Runs as a privileged container. |
| `frontend` | Vite + React + TanStack Router/Query. Single-page UI. Served as static files by nginx. |

## Key Design Decisions

**Why Hono?** Lightweight, TypeScript-first, with built-in SSE streaming (`streamSSE`). No ceremony. Could have used Express but Hono's request/response model is cleaner.

**Why better-sqlite3 + Drizzle?** SQLite is the right choice for a single-node deployment platform — no separate DB process, zero configuration, and better-sqlite3's synchronous API pairs well with the EventEmitter-based SSE broker (log writes happen inline with broadcasts, no async ordering issues).

**Container networking without host ports.** Deployed containers join `brimble_net` with `--network brimble_net`. Caddy, also on that network, proxies to `app-<id>:<port>` via Docker DNS. No host port allocation = no collisions.

**Caddy dynamic routing via admin API.** The `Caddyfile` only defines the static routes (frontend, backend API). Each new deployment adds a route via `POST /config/apps/http/servers/srv0/routes` with an `@id` tag, allowing exact deletion later via `DELETE /id/route-<id>`. The backend sends a `POST /load` on startup to initialize the empty `srv0` server.

**SSE over WebSocket.** SSE is simpler for unidirectional log streaming — no framing protocol, native browser reconnect semantics, and Hono has `streamSSE` built in. The `?from=<seq>` query parameter lets reconnecting clients replay only missed lines.

**Railpack port discovery.** After `railpack build`, the backend runs `docker inspect --format '{{json .Config.ExposedPorts}}'` on the built image to find what port the app listens on. Falls back to `3000` if nothing is declared, which covers the majority of Node/Python/Ruby frameworks that read `process.env.PORT`.

## Project Structure

```
├── docker-compose.yml
├── Caddyfile
├── backend/
│   ├── src/
│   │   ├── index.ts              # Hono entry point
│   │   ├── db/                   # Schema + migrations + client
│   │   ├── routes/               # deployments CRUD + SSE logs
│   │   ├── pipeline/             # source → build → deploy → caddy
│   │   ├── sse/broker.ts         # EventEmitter pub-sub for live logs
│   │   └── lib/                  # docker wrappers + subprocess
│   └── Dockerfile
└── frontend/
    ├── src/
    │   ├── routes/index.tsx      # single-page UI
    │   ├── components/           # DeploymentForm, DeploymentList, LogViewer
    │   └── hooks/                # useDeployments, useLogStream
    └── Dockerfile
```

## Environment Variables

All have defaults that work out-of-the-box with `docker compose up`. Override via a `.env` file (see `.env.example`).

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `/data/sqlite/db.sqlite` | SQLite file path (inside backend container) |
| `BUILDKIT_HOST` | `docker-container://buildkit` | BuildKit daemon address |
| `CADDY_ADMIN_URL` | `http://caddy:2019` | Caddy admin API |
| `DOCKER_NETWORK` | `brimble_net` | Network deployed containers join |
| `WORKSPACES_DIR` | `/volumes/workspaces` | Where source is cloned/extracted |
| `PORT` | `3001` | Backend port |

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/deployments` | Create deployment. Body: `{ gitUrl }` JSON or `multipart/form-data` with `archive` field (.zip/.tar.gz) |
| `GET` | `/api/deployments` | List all deployments |
| `GET` | `/api/deployments/:id` | Get single deployment |
| `DELETE` | `/api/deployments/:id` | Delete (stops container, removes Caddy route) |
| `GET` | `/api/deployments/:id/logs?from=<seq>` | SSE log stream |

## What I'd Do With More Time

- **Re-deployments.** Right now each `POST` creates a new deployment. I'd add a `POST /api/deployments/:id/redeploy` that tears down the old container, rebuilds, and updates the Caddy route in place.
- **Custom domains.** Caddy's virtual hosting support would make per-deployment subdomains (`<id>.yourdomain.com`) trivial to add.
- **Resource limits.** `docker run` with `--memory` and `--cpus` flags to prevent a single tenant from starving others.
- **Workspace cleanup.** Source directories under `/volumes/workspaces` are never deleted. A simple GC pass on terminal deployments would reclaim disk.
- **Better port detection.** Read `railpack.json` (Railpack's build plan output) for the declared start command and infer the port from it, rather than relying on `EXPOSE`.
- **A real test.** One integration test that boots the full compose stack, deploys a known-good repo, waits for `running`, and asserts the URL responds. That's the only test that actually validates the pipeline.
- **Proper error display in the UI.** Currently `failed` deployments show the error only in the logs pane. A visible error message in the deployment row would be more usable.

## What I'd Rip Out

The `buildkit` sidecar. Railpack can use the local Docker daemon via `BUILDKIT_HOST=docker-container://moby-buildkitd` or by starting its own ephemeral BuildKit instance. I added the explicit sidecar for reliability in the compose setup, but it adds a `privileged: true` container that's unnecessary if you're comfortable with Docker BuildKit's default behavior.


