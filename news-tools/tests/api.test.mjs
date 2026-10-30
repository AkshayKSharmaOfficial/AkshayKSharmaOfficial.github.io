// Starts the real server (serve.mjs) on a temporary site folder and calls /api/news and /api/health over HTTP.
import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serve = path.join(here, "..", "serve.mjs");

async function withServer(newsJson, fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aks-api-"));
  await fs.mkdir(path.join(dir, "assets"));
  await fs.writeFile(path.join(dir, "index.html"), "<h1>home</h1>");
  if (newsJson) await fs.writeFile(path.join(dir, "assets", "news.json"), JSON.stringify(newsJson));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [serve, "--site", dir, "--port", String(port)], { env: { ...process.env, NEWS_OFFLINE: "1", NEWS_INTERVAL_MIN: "15" }, stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; child.stdout.on("data", (d) => (out += d));
  try {
    for (let i = 0; i < 50 && !/\[site\]/.test(out); i++) await new Promise((r) => setTimeout(r, 100));
    assert.match(out, /\[site\]/, "server did not start");
    await fn(`http://127.0.0.1:${port}`);
  } finally { child.kill(); await fs.rm(dir, { recursive: true, force: true }); }
}

const DATA = { schema: 1, lastSuccess: "2026-10-29T08:00:00.000Z", lastAttempt: "2026-10-29T08:00:00.000Z",
  sources: [{ id: "thn", name: "The Hacker News", ok: true, count: 1 }, { id: "cisa", name: "CISA", ok: false, error: "HTTP 503" }],
  articles: [{ id: "1", title: "T", url: "https://a.example.com/1", source: "S", kind: "media", published: "2026-10-29T07:00:00.000Z", summary: "s", categories: ["malware"] }] };

test("GET /api/news returns the stored articles as JSON", async () => {
  await withServer(DATA, async (base) => {
    const r = await fetch(base + "/api/news");
    assert.equal(r.status, 200); assert.match(r.headers.get("content-type"), /application\/json/);
    const j = await r.json();
    assert.equal(j.articles.length, 1); assert.equal(j.articles[0].url, "https://a.example.com/1");
    assert.equal(j.sources.find((s) => s.id === "cisa").ok, false);
  });
});
test("GET /api/health reports freshness and source counts", async () => {
  await withServer(DATA, async (base) => {
    const j = await (await fetch(base + "/api/health")).json();
    assert.equal(j.status, "ok"); assert.equal(j.articles, 1); assert.equal(j.sourcesOk, 1); assert.equal(j.sourcesTotal, 2); assert.equal(j.refreshEveryMinutes, 15);
  });
});
test("no stored data yet: API still answers with an empty list instead of crashing", async () => {
  await withServer(null, async (base) => {
    const j = await (await fetch(base + "/api/news")).json();
    assert.deepEqual(j.articles, []); assert.equal(j.lastSuccess, null);
    assert.equal((await (await fetch(base + "/api/health")).json()).status, "no-data");
  });
});
test("site files are still served and path traversal is blocked", async () => {
  await withServer(DATA, async (base) => {
    assert.match(await (await fetch(base + "/")).text(), /home/);
    const t = await fetch(base + "/..%2f..%2fetc/passwd"); assert.ok([403, 404].includes(t.status));
    assert.equal((await fetch(base + "/api/news", { method: "POST" })).status, 405);
  });
});
