import { getExposedPort, dockerRun, waitForContainer } from "../lib/docker.js";
import type { LogSink } from "../lib/subprocess.js";

const DOCKER_NETWORK = process.env.DOCKER_NETWORK ?? "brimble_net";

export async function stageDeploy(
  containerName: string,
  imageName: string,
  logSink: LogSink
): Promise<number> {
  const port = await getExposedPort(imageName);
  logSink.system(`Container will listen on port ${port}`);

  logSink.system(`Starting container: ${containerName}`);
  await dockerRun(containerName, imageName, port, DOCKER_NETWORK, logSink);

  logSink.system("Waiting for container to be healthy...");
  await waitForContainer(containerName);
  logSink.system("Container is running");

  return port;
}
