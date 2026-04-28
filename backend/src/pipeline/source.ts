import { mkdirSync } from "fs";
import { spawnLogged, type LogSink } from "../lib/subprocess.js";

export async function stageSource(
  workspacePath: string,
  gitUrl: string | null,
  archivePath: string | null,
  logSink: LogSink
): Promise<void> {
  mkdirSync(workspacePath, { recursive: true });

  if (gitUrl) {
    logSink.system(`Cloning ${gitUrl}`);
    await spawnLogged(
      ["git", "clone", "--depth=1", "--single-branch", gitUrl, workspacePath],
      logSink,
      { env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }
    );
    logSink.system("Clone complete");
    return;
  }

  if (archivePath) {
    logSink.system(`Extracting archive`);
    if (archivePath.endsWith(".zip")) {
      await spawnLogged(["unzip", "-q", archivePath, "-d", workspacePath], logSink);
    } else {
      await spawnLogged(
        ["tar", "-xzf", archivePath, "-C", workspacePath, "--strip-components=1"],
        logSink
      );
    }
    logSink.system("Extraction complete");
    return;
  }

  throw new Error("No source provided: gitUrl or archivePath required");
}
