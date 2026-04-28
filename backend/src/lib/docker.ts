import { execCapture } from "./subprocess.js";
import type { LogSink } from "./subprocess.js";
import { spawnLogged } from "./subprocess.js";

export async function dockerInspect(nameOrId: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await execCapture(["docker", "inspect", nameOrId]);
    const parsed = JSON.parse(raw.trim());
    return Array.isArray(parsed) ? parsed[0] : parsed;
  } catch {
    return null;
  }
}

export async function getExposedPort(imageName: string): Promise<number> {
  try {
    const raw = await execCapture([
      "docker",
      "inspect",
      "--format",
      "{{json .Config.ExposedPorts}}",
      imageName,
    ]);
    const ports = JSON.parse(raw.trim());
    const keys = Object.keys(ports ?? {});
    if (keys.length > 0) {
      return parseInt(keys[0].split("/")[0], 10);
    }
  } catch {
    // fall through to default
  }
  return 3000;
}

export async function dockerRun(
  containerName: string,
  imageName: string,
  port: number,
  network: string,
  logSink: LogSink
): Promise<void> {
  await spawnLogged(
    [
      "docker",
      "run",
      "--detach",
      "--name",
      containerName,
      "--network",
      network,
      "--restart",
      "unless-stopped",
      "--env",
      `PORT=${port}`,
      imageName,
    ],
    logSink
  );
}

export async function waitForContainer(containerName: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const info = await dockerInspect(containerName);
    const state = (info as any)?.State;
    if (state?.Running === true) return;
    if (state?.Status === "exited" || state?.Status === "dead") {
      throw new Error(`Container ${containerName} exited unexpectedly`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Container ${containerName} did not start within ${timeoutMs}ms`);
}

export async function dockerStop(containerName: string): Promise<void> {
  try {
    await execCapture(["docker", "stop", containerName]);
  } catch {
    // ignore — container may already be stopped
  }
}

export async function dockerRemove(containerName: string): Promise<void> {
  try {
    await execCapture(["docker", "rm", "-f", containerName]);
  } catch {
    // ignore
  }
}

export async function imageExists(imageName: string): Promise<boolean> {
  try {
    await execCapture(["docker", "image", "inspect", imageName]);
    return true;
  } catch {
    return false;
  }
}
