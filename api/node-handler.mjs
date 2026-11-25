/** Wrap a (env, url) handler as a Vercel Node.js (req, res) function. */
export function nodeHandler(handle) {
  return async (req, res) => {
    try {
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
      const host = req.headers.host || "localhost";
      const url = new URL(req.url, `https://${host}`);
      const result = await handle(process.env, url);
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
}
