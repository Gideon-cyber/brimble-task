import { useEffect, useRef, useState } from "react";

export interface LogEntry {
  seq: number;
  level: string;
  message: string;
  ts: string;
}

export type StreamState = "connecting" | "streaming" | "done" | "error" | "idle";

export function useLogStream(deploymentId: string | null) {
  const [lines, setLines] = useState<LogEntry[]>([]);
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const esRef = useRef<EventSource | null>(null);
  const lastSeqRef = useRef(0);

  useEffect(() => {
    if (!deploymentId) {
      setLines([]);
      setStreamState("idle");
      return;
    }

    setLines([]);
    lastSeqRef.current = 0;
    setStreamState("connecting");

    function connect(fromSeq: number) {
      const url = `/api/deployments/${deploymentId}/logs?from=${fromSeq}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("log", (e) => {
        const entry = JSON.parse(e.data) as LogEntry;
        lastSeqRef.current = Math.max(lastSeqRef.current, entry.seq);
        setStreamState("streaming");
        setLines((prev) => [...prev, entry]);
      });

      es.addEventListener("status", () => {
        setStreamState("streaming");
      });

      es.addEventListener("done", () => {
        setStreamState("done");
        es.close();
      });

      es.addEventListener("error", (e) => {
        // SSE error events from our server (not connection errors)
        if ((e as MessageEvent).data) {
          setStreamState("error");
          es.close();
          return;
        }
        // Connection error — try to reconnect with last seq
        es.close();
        setStreamState("connecting");
        setTimeout(() => connect(lastSeqRef.current), 2000);
      });
    }

    connect(0);

    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [deploymentId]);

  return { lines, streamState };
}
