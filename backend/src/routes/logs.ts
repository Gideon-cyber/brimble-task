import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "../db/client.js";
import { deployments, logs } from "../db/schema.js";
import { broker } from "../sse/broker.js";

export const logsRouter = new Hono();

logsRouter.get("/:id/logs", (c) => {
  const { id } = c.req.param();
  const fromSeq = Number(c.req.query("from") ?? 0);

  const dep = db.select().from(deployments).where(eq(deployments.id, id)).get();
  if (!dep) return c.json({ error: "Not found" }, 404);

  return streamSSE(c, async (stream) => {
    // 1. Replay stored lines
    const historical = db
      .select()
      .from(logs)
      .where(and(eq(logs.deploymentId, id), gt(logs.seq, fromSeq)))
      .orderBy(asc(logs.seq))
      .all();

    for (const line of historical) {
      await stream.writeSSE({
        event: "log",
        data: JSON.stringify({ seq: line.seq, level: line.level, message: line.message, ts: line.ts }),
        id: String(line.seq),
      });
    }

    // 2. If already terminal, send final status and close
    const isTerminal = dep.status === "running" || dep.status === "failed";
    if (isTerminal) {
      if (dep.status === "running") {
        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({ status: "running", url: dep.url }),
        });
      } else {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ status: "failed", error: dep.error }),
        });
      }
      return;
    }

    // 3. Subscribe for live lines
    let closed = false;
    const unsubLog = broker.subscribe(id, async (line) => {
      if (closed) return;
      await stream.writeSSE({
        event: "log",
        data: JSON.stringify(line),
        id: String(line.seq),
      }).catch(() => { closed = true; });
    });

    const unsubStatus = broker.onStatus(id, async (event) => {
      if (closed) return;
      if (event.status === "running") {
        await stream.writeSSE({ event: "done", data: JSON.stringify(event) }).catch(() => {});
      } else if (event.status === "failed") {
        await stream.writeSSE({ event: "error", data: JSON.stringify(event) }).catch(() => {});
      } else {
        await stream.writeSSE({ event: "status", data: JSON.stringify(event) }).catch(() => {});
      }
    });

    // 4. Wait until terminal or client disconnects
    await new Promise<void>((resolve) => {
      c.req.raw.signal.addEventListener("abort", () => {
        closed = true;
        resolve();
      });
      broker.onceTerminal(id, () => {
        resolve();
      });
    });

    unsubLog();
    unsubStatus();
  });
});
