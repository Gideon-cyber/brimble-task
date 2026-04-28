import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { writeFileSync } from "fs";
import { nanoid } from "nanoid";
import { db } from "../db/client.js";
import { deployments } from "../db/schema.js";
import { runPipeline } from "../pipeline/orchestrator.js";
import { removeCaddyRoute } from "../pipeline/caddy.js";
import { dockerStop, dockerRemove } from "../lib/docker.js";

const WORKSPACES_DIR = process.env.WORKSPACES_DIR ?? "/volumes/workspaces";

export const deploymentsRouter = new Hono();

deploymentsRouter.get("/", (c) => {
  const all = db.select().from(deployments).orderBy(desc(deployments.createdAt)).all();
  return c.json(all);
});

deploymentsRouter.get("/:id", (c) => {
  const dep = db.select().from(deployments).where(eq(deployments.id, c.req.param("id"))).get();
  if (!dep) return c.json({ error: "Not found" }, 404);
  return c.json(dep);
});

deploymentsRouter.post("/", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  let gitUrl: string | null = null;
  let archivePath: string | null = null;

  if (contentType.includes("application/json")) {
    const body = await c.req.json<{ gitUrl?: string }>();
    if (!body.gitUrl) return c.json({ error: "gitUrl required" }, 400);
    gitUrl = body.gitUrl.trim();
  } else if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody();
    const file = body["archive"];
    if (!(file instanceof File)) return c.json({ error: "archive field required" }, 400);

    const allowed = [".zip", ".tar.gz", ".tgz"];
    const ext = allowed.find((e) => file.name.endsWith(e));
    if (!ext) return c.json({ error: "unsupported archive format (.zip, .tar.gz, .tgz)" }, 400);

    const id = nanoid(8);
    archivePath = `/tmp/${id}${ext}`;
    writeFileSync(archivePath, Buffer.from(await file.arrayBuffer()));
  } else {
    return c.json({ error: "Content-Type must be application/json or multipart/form-data" }, 400);
  }

  const id = nanoid(8);
  const now = new Date();
  const dep = {
    id,
    status: "pending" as const,
    gitUrl,
    containerName: `app-${id}`,
    imageName: `railpack-app-${id}`,
    internalPort: null,
    url: null,
    error: null,
    workspacePath: `${WORKSPACES_DIR}/${id}`,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(deployments).values(dep).run();

  setImmediate(() => runPipeline(id, archivePath));

  return c.json({ id, status: "pending" }, 201);
});

deploymentsRouter.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const dep = db.select().from(deployments).where(eq(deployments.id, id)).get();
  if (!dep) return c.json({ error: "Not found" }, 404);

  await dockerStop(dep.containerName).catch(() => {});
  await dockerRemove(dep.containerName).catch(() => {});
  await removeCaddyRoute(id).catch(() => {});

  db.delete(deployments).where(eq(deployments.id, id)).run();

  return c.body(null, 204);
});
