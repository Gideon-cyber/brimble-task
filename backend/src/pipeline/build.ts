import { execCapture, spawnLogged, type LogSink } from "../lib/subprocess.js";

const BUILDKIT_POLL_TIMEOUT = 60_000;
const BUILDKIT_POLL_INTERVAL = 1_000;

async function waitForBuildkit(): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < BUILDKIT_POLL_TIMEOUT) {
    try {
      await execCapture(["docker", "inspect", "--format", "{{.State.Running}}", "buildkit"]);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, BUILDKIT_POLL_INTERVAL));
    }
  }
  throw new Error("BuildKit did not become ready in time");
}

export async function stageBuild(
  imageName: string,
  workspacePath: string,
  logSink: LogSink
): Promise<void> {
  logSink.system("Waiting for BuildKit...");
  await waitForBuildkit();
  logSink.system("BuildKit ready. Starting Railpack build...");

  await spawnLogged(
    ["railpack", "build", "--name", imageName, "--progress", "plain", workspacePath],
    logSink,
    { env: { ...process.env } }
  );

  logSink.system(`Image built: ${imageName}`);
}
