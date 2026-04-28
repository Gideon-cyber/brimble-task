import { useState, useRef } from "react";
import { useCreateDeployment } from "../hooks/useDeployments";

const s: Record<string, React.CSSProperties> = {
  card: { background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, padding: "16px 20px" },
  title: { fontSize: 13, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 },
  tabs: { display: "flex", gap: 8, marginBottom: 14 },
  tab: { padding: "4px 12px", borderRadius: 4, border: "1px solid #333", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13 },
  tabActive: { background: "#2563eb", border: "1px solid #2563eb", color: "#fff" },
  input: { width: "100%", background: "#0f0f0f", border: "1px solid #333", borderRadius: 4, color: "#e2e8f0", padding: "7px 10px", fontSize: 13, outline: "none", marginBottom: 10 },
  uploadArea: { border: "1px dashed #444", borderRadius: 4, padding: "14px", textAlign: "center", cursor: "pointer", color: "#64748b", fontSize: 13, marginBottom: 10 },
  btn: { padding: "7px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 600 },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  error: { color: "#f87171", fontSize: 12, marginTop: 8 },
};

export function DeploymentForm() {
  const [mode, setMode] = useState<"git" | "upload">("git");
  const [gitUrl, setGitUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate, isPending, error } = useCreateDeployment();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "git" && gitUrl.trim()) {
      mutate({ gitUrl: gitUrl.trim() }, { onSuccess: () => setGitUrl("") });
    } else if (mode === "upload" && file) {
      mutate({ archive: file }, { onSuccess: () => setFile(null) });
    }
  }

  return (
    <div style={s.card}>
      <div style={s.title}>New Deployment</div>
      <div style={s.tabs}>
        <button style={{ ...s.tab, ...(mode === "git" ? s.tabActive : {}) }} onClick={() => setMode("git")}>Git URL</button>
        <button style={{ ...s.tab, ...(mode === "upload" ? s.tabActive : {}) }} onClick={() => setMode("upload")}>Upload</button>
      </div>
      <form onSubmit={submit}>
        {mode === "git" ? (
          <input
            style={s.input}
            placeholder="https://github.com/user/repo.git"
            value={gitUrl}
            onChange={(e) => setGitUrl(e.target.value)}
            disabled={isPending}
            autoComplete="off"
          />
        ) : (
          <>
            <div
              style={s.uploadArea}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) setFile(f);
              }}
            >
              {file ? file.name : "Drop .zip / .tar.gz here, or click to browse"}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.tar.gz,.tgz"
              style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </>
        )}
        <button
          type="submit"
          style={{ ...s.btn, ...(isPending ? s.btnDisabled : {}) }}
          disabled={isPending || (mode === "git" ? !gitUrl.trim() : !file)}
        >
          {isPending ? "Deploying…" : "Deploy"}
        </button>
        {error && <div style={s.error}>{error.message}</div>}
      </form>
    </div>
  );
}
