import { useEffect, useRef } from "react";
import { useLogStream } from "../hooks/useLogStream";

const LEVEL_COLOR: Record<string, string> = {
  info: "#94a3b8",
  error: "#f87171",
  system: "#60a5fa",
};

const s: Record<string, React.CSSProperties> = {
  card: { background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, overflow: "hidden" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid #222" },
  title: { fontSize: 13, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" },
  state: { fontSize: 11, color: "#475569" },
  body: { height: 320, overflowY: "auto" as const, padding: "10px 16px", background: "#0a0a0a" },
  empty: { color: "#334155", fontSize: 13, textAlign: "center" as const, paddingTop: 80 },
  line: { display: "flex", gap: 10, padding: "1px 0", fontFamily: "inherit", fontSize: 12, lineHeight: 1.6 },
  ts: { color: "#334155", flexShrink: 0 },
  msg: { whiteSpace: "pre-wrap" as const, wordBreak: "break-all" as const },
};

interface Props {
  deploymentId: string | null;
}

export function LogViewer({ deploymentId }: Props) {
  const { lines, streamState } = useLogStream(deploymentId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  return (
    <div style={s.card}>
      <div style={s.header}>
        <div style={s.title}>
          {deploymentId ? `Logs — ${deploymentId}` : "Logs"}
        </div>
        <div style={s.state}>{deploymentId ? streamState : "select a deployment"}</div>
      </div>
      <div style={s.body}>
        {!deploymentId && <div style={s.empty}>Click "view" on a deployment to stream its logs</div>}
        {deploymentId && lines.length === 0 && streamState === "connecting" && (
          <div style={s.empty}>Connecting…</div>
        )}
        {lines.map((line) => (
          <div key={line.seq} style={s.line}>
            <span style={s.ts}>{new Date(line.ts).toISOString().slice(11, 19)}</span>
            <span style={{ color: LEVEL_COLOR[line.level] ?? "#94a3b8", flexShrink: 0, width: 44 }}>
              [{line.level.toUpperCase().slice(0, 3)}]
            </span>
            <span style={{ ...s.msg, color: LEVEL_COLOR[line.level] ?? "#94a3b8" }}>
              {line.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
