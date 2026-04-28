import { spawn, SpawnOptions } from "child_process";

export interface LogSink {
  info(message: string): void;
  error(message: string): void;
  system(message: string): void;
}

export function spawnLogged(
  cmd: string[],
  logSink: LogSink,
  opts?: SpawnOptions & { captureOutput?: boolean }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const [bin, ...args] = cmd;
    const child = spawn(bin, args, {
      ...opts,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const outputLines: string[] = [];

    child.stdout!.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      lines.forEach((line) => {
        if (opts?.captureOutput) outputLines.push(line);
        logSink.info(line);
      });
    });

    child.stderr!.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      lines.forEach((line) => {
        if (opts?.captureOutput) outputLines.push(line);
        logSink.error(line);
      });
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(outputLines.join("\n"));
      } else {
        reject(new Error(`${bin} exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to start ${bin}: ${err.message}`));
    });
  });
}

export async function execCapture(cmd: string[]): Promise<string> {
  const nullSink: LogSink = { info: () => {}, error: () => {}, system: () => {} };
  return spawnLogged(cmd, nullSink, { captureOutput: true });
}
