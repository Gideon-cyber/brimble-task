const CADDY_ADMIN = process.env.CADDY_ADMIN_URL ?? "http://caddy:2019";

async function caddyRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const res = await fetch(`${CADDY_ADMIN}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`Caddy admin API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res;
}

export async function initCaddy(): Promise<void> {
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await caddyRequest("POST", "/load", {
        apps: {
          http: {
            servers: {
              srv0: {
                listen: [":80"],
                routes: [],
              },
            },
          },
        },
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw new Error("Could not initialize Caddy after retries");
}

export async function addCaddyRoute(
  deploymentId: string,
  containerName: string,
  port: number
): Promise<string> {
  const pathPrefix = `/dep-${deploymentId}`;

  await caddyRequest("POST", "/config/apps/http/servers/srv0/routes", {
    "@id": `route-${deploymentId}`,
    match: [{ path: [pathPrefix, `${pathPrefix}/*`] }],
    handle: [
      { handler: "rewrite", strip_path_prefix: pathPrefix },
      {
        handler: "reverse_proxy",
        upstreams: [{ dial: `${containerName}:${port}` }],
      },
    ],
  });

  return pathPrefix;
}

export async function removeCaddyRoute(deploymentId: string): Promise<void> {
  await caddyRequest("DELETE", `/id/route-${deploymentId}`);
}
