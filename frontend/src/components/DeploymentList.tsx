import type { Deployment } from "../hooks/useDeployments";
import { useDeleteDeployment } from "../hooks/useDeployments";

const STATUS_COLOR: Record<string, string> = {
  pending: "#94a3b8",
  building: "#f59e0b",
  deploying: "#3b82f6",
  running: "#22c55e",
  failed: "#ef4444",
};

const s: Record<string, React.CSSProperties> = {
  card: { background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, padding: "16px 20px" },
  title: { fontSize: 13, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em", padding: "4px 8px", borderBottom: "1px solid #222" },
  td: { padding: "8px 8px", borderBottom: "1px solid #1e1e1e", fontSize: 13, verticalAlign: "top" as const },
  empty: { color: "#475569", fontSize: 13, textAlign: "center" as const, padding: "24px 0" },
  link: { color: "#60a5fa", textDecoration: "none" },
  deleteBtn: { background: "transparent", border: "1px solid #333", color: "#94a3b8", borderRadius: 3, padding: "2px 8px", cursor: "pointer", fontSize: 12 },
  selectBtn: { background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: 12, textDecoration: "underline", padding: 0 },
  imageTag: { color: "#64748b", fontSize: 11, fontFamily: "inherit" },
};

function StatusDot({ status }: { status: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLOR[status] ?? "#94a3b8", display: "inline-block" }} />
      <span style={{ color: STATUS_COLOR[status] ?? "#94a3b8" }}>{status}</span>
    </span>
  );
}

interface Props {
  deployments: Deployment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DeploymentList({ deployments, selectedId, onSelect }: Props) {
  const { mutate: del, isPending: deleting } = useDeleteDeployment();

  return (
    <div style={s.card}>
      <div style={s.title}>Deployments ({deployments.length})</div>
      {deployments.length === 0 ? (
        <div style={s.empty}>No deployments yet</div>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>ID</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>URL</th>
              <th style={s.th}>Image</th>
              <th style={s.th}>Logs</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {deployments.map((dep) => (
              <tr key={dep.id} style={{ background: dep.id === selectedId ? "#1e2d40" : "transparent" }}>
                <td style={s.td}>
                  <span style={{ fontFamily: "inherit", fontSize: 12 }}>{dep.id}</span>
                </td>
                <td style={s.td}><StatusDot status={dep.status} /></td>
                <td style={s.td}>
                  {dep.url
                    ? <a href={dep.url} target="_blank" rel="noreferrer" style={s.link}>{dep.url}</a>
                    : <span style={{ color: "#475569" }}>—</span>}
                </td>
                <td style={s.td}>
                  <span style={s.imageTag}>{dep.imageName}</span>
                </td>
                <td style={s.td}>
                  <button style={s.selectBtn} onClick={() => onSelect(dep.id)}>
                    {dep.id === selectedId ? "selected" : "view"}
                  </button>
                </td>
                <td style={s.td}>
                  <button
                    style={s.deleteBtn}
                    onClick={() => del(dep.id)}
                    disabled={deleting}
                  >
                    delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
