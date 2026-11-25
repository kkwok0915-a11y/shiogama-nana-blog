/** Vite dev/preview middleware that serves the same /api handlers as production. */
export function localApiPlugin(handlers, env) {
  const run = async (req, res, next) => {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `http://${host}`);
    const handle = handlers[url.pathname];
    if (!handle) return next();
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, HEAD, OPTIONS");
      res.end();
      return;
    }
    try {
      const result = await handle(env, url);
      res.statusCode = result.status;
      for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
      if (req.method === "HEAD") res.end();
      else res.end(result.body);
    } catch {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({ error: "unavailable" }));
    }
  };
  return {
    name: "local-api",
    configureServer(server) {
      server.middlewares.use(run);
    },
    configurePreviewServer(server) {
      server.middlewares.use(run);
    },
  };
}
