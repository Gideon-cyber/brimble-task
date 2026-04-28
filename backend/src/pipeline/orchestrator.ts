import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { deployments } from "../db/schema.js";
import { broker } from "../sse/broker.js";
import { stageSource } from "./source.js";
import { stageBuild } from "./build.js";
import { stageDeploy } from "./deploy.js";
import { addCaddyRoute } from "./caddy.js";
import { dockerStop, dockerRemove } from "../lib/docker.js";
import { unlinkSync } from "fs";

function setStatus(id: string, status: string, extra: Partial<{ url: string; error: string; internalPort: number }> = {}) {
  db.update(deployments)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(deployments.id, id))
    .run();
}

export function runPipeline(deploymentId: string, archivePath: string | null): void {
  // Fire-and-forget: runs entirely in background
  void (async () => {
    const dep = db.select().from(deployments).where(eq(deployments.id, deploymentId)).get();
    if (!dep) return;

    const logSink = broker.createSink(deploymentId);

    try {
      // ── Stage: source ────────────────────────────────────────────────────
      setStatus(deploymentId, "building");
      broker.broadcastStatus(deploymentId, { status: "building" });

      await stageSource(dep.workspacePath, dep.gitUrl, archivePath, logSink);

      if (archivePath) {
        try { unlinkSync(archivePath); } catch { /* ignore */ }
      }

      // ── Stage: build ─────────────────────────────────────────────────────
      await stageBuild(dep.imageName, dep.workspacePath, logSink);

      // ── Stage: deploy container ──────────────────────────────────────────
      setStatus(deploymentId, "deploying");
      broker.broadcastStatus(deploymentId, { status: "deploying" });

      const port = await stageDeploy(dep.containerName, dep.imageName, logSink);

      // ── Stage: register Caddy route ──────────────────────────────────────
      logSink.system("Registering Caddy route...");
      const pathPrefix = await addCaddyRoute(deploymentId, dep.containerName, port);
      const url = `http://localhost${pathPrefix}`;

      setStatus(deploymentId, "running", { url, internalPort: port });
      broker.broadcastStatus(deploymentId, { status: "running", url });
      logSink.system(`Deployment live at ${url}`);

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(deploymentId, "failed", { error: message });
      broker.broadcastStatus(deploymentId, { status: "failed", error: message });
      logSink.error(`Pipeline failed: ${message}`);

      // best-effort cleanup
      await dockerStop(dep.containerName).catch(() => {});
      await dockerRemove(dep.containerName).catch(() => {});
    }
  })();
}
