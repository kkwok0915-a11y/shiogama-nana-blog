// Write deploy-manifest.json + base64 payloads for deploying via the Vercel MCP tools.
// Usage: node scripts/manifest.mjs [dir]   (dir defaults to "dist")
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dir = join(root, process.argv[2] ?? "dist");
const payloads = join(root, "upload-payloads");
rmSync(payloads, { recursive: true, force: true });
mkdirSync(payloads, { recursive: true });
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const files = walk(dir).sort().map((path) => {
  const buf = readFileSync(path);
  const file = relative(dir, path).split("\\").join("/");
  const b64 = join(payloads, file.replace(/\//g, "__") + ".b64");
  writeFileSync(b64, buf.toString("base64"));
  return { file, sha: createHash("sha1").update(buf).digest("hex"), size: buf.length, b64 };
});
writeFileSync(join(root, "deploy-manifest.json"), JSON.stringify({ dir, files }, null, 2) + "\n");
console.log(files.map((f) => `${f.size}\t${f.sha}\t${f.file}`).join("\n"));
