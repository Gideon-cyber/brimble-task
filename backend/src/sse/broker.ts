import { EventEmitter } from "events";
import { db } from "../db/client.js";
import { logs } from "../db/schema.js";

export interface LogLine {
  seq: number;
  level: string;
  message: string;
  ts: Date;
}

export interface StatusEvent {
  status: string;
  url?: string;
  error?: string;
}

class LogBroker extends EventEmitter {
  private counters = new Map<string, number>();

  private nextSeq(deploymentId: string): number {
    const n = (this.counters.get(deploymentId) ?? 0) + 1;
    this.counters.set(deploymentId, n);
    return n;
  }

  publish(deploymentId: string, level: string, message: string): void {
    const seq = this.nextSeq(deploymentId);
    const ts = new Date();
    const line: LogLine = { seq, level, message, ts };

    db.insert(logs).values({ deploymentId, seq, level, message, ts }).run();

    this.emit(`log:${deploymentId}`, line);
  }

  broadcastStatus(deploymentId: string, event: StatusEvent): void {
    this.emit(`status:${deploymentId}`, event);
  }

  subscribe(deploymentId: string, handler: (line: LogLine) => void): () => void {
    this.on(`log:${deploymentId}`, handler);
    return () => this.off(`log:${deploymentId}`, handler);
  }

  onStatus(deploymentId: string, handler: (event: StatusEvent) => void): () => void {
    this.on(`status:${deploymentId}`, handler);
    return () => this.off(`status:${deploymentId}`, handler);
  }

  onceTerminal(deploymentId: string, resolve: () => void): void {
    const handler = (event: StatusEvent) => {
      if (event.status === "running" || event.status === "failed") {
        this.off(`status:${deploymentId}`, handler);
        resolve();
      }
    };
    this.on(`status:${deploymentId}`, handler);
  }

  createSink(deploymentId: string) {
    return {
      info: (message: string) => this.publish(deploymentId, "info", message),
      error: (message: string) => this.publish(deploymentId, "error", message),
      system: (message: string) => this.publish(deploymentId, "system", message),
    };
  }
}

export const broker = new LogBroker();
broker.setMaxListeners(200);
