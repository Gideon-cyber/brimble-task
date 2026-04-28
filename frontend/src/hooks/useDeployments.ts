import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";

export type DeploymentStatus =
  | "pending"
  | "building"
  | "deploying"
  | "running"
  | "failed";

export interface Deployment {
  id: string;
  status: DeploymentStatus;
  gitUrl: string | null;
  imageName: string;
  containerName: string;
  internalPort: number | null;
  url: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

const TERMINAL = new Set<DeploymentStatus>(["running", "failed"]);

async function fetchDeployments(): Promise<Deployment[]> {
  const res = await fetch("/api/deployments");
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export function useDeployments() {
  return useQuery<Deployment[]>({
    queryKey: ["deployments"],
    queryFn: fetchDeployments,
    refetchInterval: (query) => {
      const data = query.state.data ?? [];
      const allDone = data.length > 0 && data.every((d) => TERMINAL.has(d.status));
      return allDone ? false : 3000;
    },
  });
}

export function useCreateDeployment() {
  return useMutation({
    mutationFn: async (payload: { gitUrl?: string; archive?: File }) => {
      let res: Response;
      if (payload.archive) {
        const form = new FormData();
        form.append("archive", payload.archive);
        res = await fetch("/api/deployments", { method: "POST", body: form });
      } else {
        res = await fetch("/api/deployments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gitUrl: payload.gitUrl }),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? "Failed to create deployment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployments"] });
    },
  });
}

export function useDeleteDeployment() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/deployments/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`${res.status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployments"] });
    },
  });
}
