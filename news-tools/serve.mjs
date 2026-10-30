#!/usr/bin/env node
// Serves the website AND keeps the news fresh. Zero dependencies (Node 20.12+ built-ins only).
// Usage: node news-tools/serve.mjs [--site <folder>] [--port 8080]
// 1) fetches news immediately on start, 2) repeats every NEWS_INTERVAL_MIN minutes (default 15),
// 3) serves the site, the news JSON API (GET /api/news, GET /api/health) and the certificate API (certs.mjs).
// Settings can come from environment variables or a .env file (see .env.example).
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES } from "./sources.mjs";
import { runAndStore, withLock } from "./job.mjs";
import { createCertApi } from "./certs.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const siteDir = path.resolve(arg("--site", path.join(here, "..")));
try { process.loadEnvFile(path.join(siteDir, ".env")); } catch { /* .env is optional */ }
const certApi = createCertApi({ siteDir, dataFile: path.join(siteDir, "data", "certificates.json") });
const port = Number(arg("--port", process.env.PORT || 8080));
const host = process.env.HOST || "127.0.0.1";                       // use HOST=0.0.0.0 on a real server
const INTERVAL = Math.max(5, Number(process.env.NEWS_INTERVAL_MIN) || 15) * 60 * 1000;   // never faster than 5 minutes
const lockFile = path.join(here, ".news.lock");

async function update() {
  if (process.env.NEWS_OFFLINE === "1") return;                       // used by the automatic tests: serve only, never fetch
  try {
    const r = await withLock(lockFile, () => runAndStore({ sources: SOURCES, siteDir }));
    if (r.skipped) console.log("[news] update already running - skipped");
    else { cache = { at: 0, body: null }; if (!r.value.anyOk) console.log("[news] WARNING: no source worked. Check your internet connection / firewall. Old articles (if any) were kept."); }
  } catch (e) { console.error("[news] update error:", e && e.message); }
}


// ---- News JSON API -------------------------------------------------------------------------------------
// The browser talks to THIS server, never to the publishers, so there are no CORS problems.
// The data is the last stored result of the news job (news.json). If every source is down, the old articles stay.
const jsonFile = path.join(siteDir, "assets", "news.json");
let cache = { at: 0, body: null };
async function readNews() {
  if (cache.body && Date.now() - cache.at < 30 * 1000) return cache.body;       // 30 s memory cache
  let body;
  try { body = JSON.parse(await fs.readFile(jsonFile, "utf8")); }
  catch { body = { schema: 1, lastSuccess: null, lastAttempt: null, sources: [], articles: [] }; }
  cache = { at: Date.now(), body };
  return body;
}
async function newsApi(p, req, res) {
  const h = { "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff", "cache-control": "public, max-age=60" };
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { ...h, allow: "GET, HEAD" }).end(); return; }
  const d = await readNews();
  if (p === "/api/health") {
    const ok = (d.sources || []).filter((s) => s.ok).length;
    res.writeHead(200, h).end(JSON.stringify({ status: ok ? "ok" : (d.lastSuccess ? "stale" : "no-data"), lastSuccess: d.lastSuccess, lastAttempt: d.lastAttempt, articles: d.articles.length, sourcesOk: ok, sourcesTotal: (d.sources || []).length, refreshEveryMinutes: INTERVAL / 60000 }));
    return;
  }
  if (req.method === "HEAD") { res.writeHead(200, h).end(); return; }
  res.writeHead(200, h).end(JSON.stringify(d));
}

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".pdf": "application/pdf", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon" };

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/api/news" || u.pathname === "/api/health") { await newsApi(u.pathname, req, res); return; }
    if (await certApi(req, res, u)) return;
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
    let p = decodeURIComponent(u.pathname);
    // never serve private folders/files (saved participants, server code, secrets)
    if (/(^|\/)(\.[^/]*|data|news-tools|node_modules)(\/|$)/i.test(p)) { res.writeHead(404).end("Not found"); return; }
    if (p.includes("\0")) { res.writeHead(400).end(); return; }
    let file = path.join(siteDir, p);
    if (!file.startsWith(siteDir + path.sep) && file !== siteDir) { res.writeHead(403).end("Forbidden"); return; }
    let st = await fs.stat(file).catch(() => null);
    if (st && st.isDirectory()) { file = path.join(file, "index.html"); st = await fs.stat(file).catch(() => null); }
    if (!st) { const nf = await fs.readFile(path.join(siteDir, "404.html")).catch(() => Buffer.from("Not found")); res.writeHead(404, { "content-type": "text/html; charset=utf-8" }).end(nf); return; }
    const headers = { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "x-content-type-options": "nosniff" };
    if (/news\.json$|news-data\.js$/.test(file)) headers["cache-control"] = "no-cache";
    res.writeHead(200, headers);
    if (req.method === "HEAD") res.end(); else res.end(await fs.readFile(file));
  } catch (e) { res.writeHead(500).end("Server error"); }
});

server.listen(port, host, () => {
  console.log(`[site] http://localhost:${port}/   (news page: http://localhost:${port}/cyber-news/   API: http://localhost:${port}/api/news)`);
  console.log(`[news] refreshing every ${INTERVAL / 60000} minutes while this program runs`);
  update();
  setInterval(update, INTERVAL).unref();
});
