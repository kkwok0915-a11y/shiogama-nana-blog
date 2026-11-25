// @ts-nocheck
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { localApiPlugin } from "./api/dev-middleware.mjs";
import { handlePosts } from "./api/posts.mjs";
import { handleSettings } from "./api/settings.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      localApiPlugin(
        { "/api/posts": handlePosts, "/api/settings": handleSettings },
        { SUPABASE_URL: env.SUPABASE_URL, SUPABASE_KEY: env.SUPABASE_KEY },
      ),
    ],
    build: { outDir: "dist", sourcemap: false },
  };
});
