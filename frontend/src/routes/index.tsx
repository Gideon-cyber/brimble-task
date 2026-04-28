import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDeployments } from "../hooks/useDeployments";
import { DeploymentForm } from "../components/DeploymentForm";
import { DeploymentList } from "../components/DeploymentList";
import { LogViewer } from "../components/LogViewer";

export const Route = createFileRoute("/")({
  component: Index,
});

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", padding: "0 0 40px" },
  header: { borderBottom: "1px solid #1e1e1e", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { fontSize: 15, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.02em" },
  badge: { fontSize: 11, color: "#475569", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 4, padding: "2px 7px" },
  body: { maxWidth: 1100, margin: "0 auto", padding: "24px 24px 0" },
  grid: { display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, marginBottom: 16 },
};

function Index() {
  const { data: deployments = [], isLoading, error } = useDeployments();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.logo}>brimble deploy</span>
        <span style={s.badge}>local</span>
      </div>
      <div style={s.body}>
        <div style={s.grid}>
          <DeploymentForm />
          <div>
            {isLoading && <p style={{ color: "#475569", fontSize: 13 }}>Loading…</p>}
            {error && <p style={{ color: "#f87171", fontSize: 13 }}>Failed to load deployments</p>}
            {!isLoading && (
              <DeploymentList
                deployments={deployments}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </div>
        </div>
        <LogViewer deploymentId={selectedId} />
      </div>
    </div>
  );
}
