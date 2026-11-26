// @ts-nocheck
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { localApiPlugin } from "./api/dev-middleware.mjs";
import { handleOg } from "./api/og.mjs";
import { handleInstagram } from "./api/instagram.mjs";
import { handlePosts } from "./api/posts.mjs";
import { handleSettings } from "./api/settings.mjs";

function ogHtmlPlugin(handle, env, param) {
  const run = async (req, res, next) => {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `http://${host}`);
    const pathId = url.pathname.match(new RegExp(`^/${param}/([^/]+)/?$`));
    if (pathId && !url.searchParams.get(param)) url.searchParams.set(param, decodeURIComponent(pathId[1]));
    if (url.pathname !== "/" && !pathId) return next();
    if (!url.searchParams.get(param) && !pathId) return next();
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    try {
      const result = await handle(env, url);
      res.statusCode = result.status;
      for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
      if (req.method === "HEAD") res.end();
      else res.end(result.body);
    } catch {
      next();
    }
  };
  return {
    name: "og-html",
    configurePreviewServer(server) {
      server.middlewares.use(run);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverEnv = { SUPABASE_URL: env.SUPABASE_URL, SUPABASE_KEY: env.SUPABASE_KEY };
  return {
    plugins: [
      react(),
      ogHtmlPlugin(handleOg, serverEnv, "p"),
      localApiPlugin(
        { "/api/posts": handlePosts, "/api/instagram": handleInstagram, "/api/settings": handleSettings, "/api/og": handleOg },
        serverEnv,
      ),
    ],
    build: { outDir: "dist", sourcemap: false },
  };
});
