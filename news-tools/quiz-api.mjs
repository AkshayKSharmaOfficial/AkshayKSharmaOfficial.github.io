// Quiz results + certificate verification API. Zero dependencies.
//   POST /api/quiz/result          the quiz page sends name, mobile, score (needs the person's consent)
//   GET  /api/verify?id=AKS-...    public: is this certificate ID real? (name is partly hidden, mobile is never shown)
//   GET  /api/admin/quiz-results.csv?token=...   owner only: all results as CSV (needs ADMIN_TOKEN in .env)
// Data is stored as one JSON line per result in <data folder>/quiz-results.jsonl (default: ./data).
import { promises as fs } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { timingSafeEqual } from "node:crypto";

const ID_RE = /^AKS-(\d{4})(\d{2})(\d{2})-[A-HJ-NP-Z2-9]{6}$/;
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'\-]{1,49}$/u;
const PHONE_RE = /^[6-9]\d{9}$/;

export async function loadQuizzes(siteDir) {
  const src = await fs.readFile(path.join(siteDir, "assets", "quiz-data.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { timeout: 2000 });
  const q = sandbox.window.AKS_QUIZ && sandbox.window.AKS_QUIZ.quizzes;
  if (!q || typeof q !== "object") throw new Error("quiz-data.js has no quizzes");
  return Object.fromEntries(Object.entries(q).map(([slug, v]) => [slug, { title: v.title[0], pass: v.pass, total: v.questions.length }]));
}

export function maskName(name) {            // "Rahul Kumar Sharma" -> "Rahul K. S."
  const parts = String(name).trim().split(/\s+/);
  return [parts[0], ...parts.slice(1).map((p) => p[0].toUpperCase() + ".")].join(" ");
}
export function csvCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;      // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function limiter(max, windowMs) {
  const hits = new Map();
  return (key, now = Date.now()) => {
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(now); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return true;
  };
}

export function createQuizApi({ siteDir, dataDir, adminToken = "", trustProxy = false }) {
  const file = path.join(dataDir, "quiz-results.jsonl");
  let quizzes = null, byId = null;
  const postLimit = limiter(30, 10 * 60 * 1000), getLimit = limiter(60, 10 * 60 * 1000);

  async function init() {
    if (!quizzes) quizzes = await loadQuizzes(siteDir);
    if (!byId) {
      byId = new Map();
      try { for (const line of (await fs.readFile(file, "utf8")).split("\n")) { if (!line.trim()) continue; try { const r = JSON.parse(line); if (r.id) byId.set(r.id, r); } catch { /* skip a damaged line */ } } }
      catch (e) { if (e.code !== "ENOENT") throw e; }
    }
  }
  const ip = (req) => (trustProxy && String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress || "?";
  const send = (res, code, obj, extra = {}) => res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra }).end(JSON.stringify(obj));
  async function body(req, max = 4096) {
    let size = 0; const chunks = [];
    for await (const c of req) { size += c.length; if (size > max) throw Object.assign(new Error("too large"), { code: 413 }); chunks.push(c); }
    return Buffer.concat(chunks).toString("utf8");
  }

  async function postResult(req, res, now = Date.now()) {
    if (!postLimit(ip(req), now)) return send(res, 429, { ok: false, error: "too many requests" });
    if (!/^application\/json\b/i.test(req.headers["content-type"] || "")) return send(res, 415, { ok: false, error: "send JSON" });
    let b; try { b = JSON.parse(await body(req)); } catch (e) { return send(res, e.code === 413 ? 413 : 400, { ok: false, error: e.code === 413 ? "too large" : "bad JSON" }); }
    if (!b || typeof b !== "object") return send(res, 400, { ok: false, error: "bad request" });
    if (b.consent !== true) return send(res, 400, { ok: false, error: "consent is required" });
    const name = String(b.name ?? "").replace(/\s+/g, " ").trim();
    if (!NAME_RE.test(name)) return send(res, 400, { ok: false, error: "invalid name" });
    const phone = String(b.phone ?? "");
    if (!PHONE_RE.test(phone)) return send(res, 400, { ok: false, error: "invalid mobile number" });
    const q = Object.hasOwn(quizzes, String(b.quiz)) ? quizzes[b.quiz] : null;
    if (!q) return send(res, 400, { ok: false, error: "unknown quiz" });
    const score = Number(b.score), total = Number(b.total);
    if (!Number.isInteger(score) || total !== q.total || score < 0 || score > total) return send(res, 400, { ok: false, error: "invalid score" });
    const passed = score >= q.pass;                             // decided by the server, never by the browser
    let id = null;
    if (passed) {
      const m = ID_RE.exec(String(b.id ?? ""));
      if (!m) return send(res, 400, { ok: false, error: "invalid certificate id" });
      const d = Date.UTC(+m[1], +m[2] - 1, +m[3]);
      if (!Number.isFinite(d) || Math.abs(d - now) > 3 * 86400000) return send(res, 400, { ok: false, error: "certificate id date is not today" });
      id = b.id;
      if (byId.has(id)) return send(res, 409, { ok: false, error: "id already used" });
    }
    const rec = { at: new Date(now).toISOString(), id, name, phone, quiz: b.quiz, quizTitle: q.title, score, total, passed };
    await fs.mkdir(dataDir, { recursive: true });
    await fs.appendFile(file, JSON.stringify(rec) + "\n", { mode: 0o600 });
    if (id) byId.set(id, rec);
    return send(res, 200, { ok: true, passed, id });
  }

  async function verify(req, res, url, now = Date.now()) {
    if (!getLimit(ip(req), now)) return send(res, 429, { valid: false, error: "too many requests" });
    const id = String(url.searchParams.get("id") || "").trim().toUpperCase();
    if (!ID_RE.test(id)) return send(res, 200, { valid: false, reason: "format" });
    const r = byId.get(id);
    if (!r || !r.passed) return send(res, 200, { valid: false, reason: "not-found" });
    return send(res, 200, { valid: true, id, name: maskName(r.name), quiz: r.quizTitle, score: r.score, total: r.total, issued: r.at.slice(0, 10) });
  }

  async function adminCsv(req, res, url) {
    if (adminToken.length < 16) return false;                  // feature is off until ADMIN_TOKEN is set
    if (!getLimit("admin:" + ip(req))) return send(res, 429, { error: "too many requests" });
    const auth = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
    const given = Buffer.from(String((auth && auth[1]) || url.searchParams.get("token") || ""));
    const want = Buffer.from(adminToken);
    if (given.length !== want.length || !timingSafeEqual(given, want)) return send(res, 401, { error: "unauthorised" });
    const rows = [["Time (UTC)", "Certificate ID", "Name", "Mobile", "Quiz", "Score", "Out of", "Result"]];
    let text = ""; try { text = await fs.readFile(file, "utf8"); } catch (e) { if (e.code !== "ENOENT") throw e; }
    for (const line of text.split("\n")) { if (!line.trim()) continue; try { const r = JSON.parse(line); rows.push([r.at, r.id || "", r.name, r.phone, r.quizTitle, r.score, r.total, r.passed ? "PASSED" : "not passed"]); } catch { /* skip */ } }
    res.writeHead(200, { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="quiz-results.csv"', "cache-control": "no-store", "x-content-type-options": "nosniff" })
       .end("\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n");
    return true;
  }

  // returns true when the request was handled here
  async function handle(req, res, p) {
    const url = new URL(req.url, "http://x");
    try {
      if (p === "/api/quiz/result") { if (req.method !== "POST") { send(res, 405, { ok: false }, { allow: "POST" }); return true; } await init(); await postResult(req, res); return true; }
      if (p === "/api/verify") { if (req.method !== "GET" && req.method !== "HEAD") { send(res, 405, { valid: false }, { allow: "GET" }); return true; } await init(); await verify(req, res, url); return true; }
      if (p === "/api/admin/quiz-results.csv") { if (req.method !== "GET") { send(res, 405, {}); return true; } await init(); const r = await adminCsv(req, res, url); if (r === false) return false; return true; }
    } catch (e) { if (!res.headersSent) send(res, 500, { ok: false, error: "server error" }); else res.end(); console.error("[quiz-api]", e && e.message); return true; }
    return false;
  }
  return { handle };
}
