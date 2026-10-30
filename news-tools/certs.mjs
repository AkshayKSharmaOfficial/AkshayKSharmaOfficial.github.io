// Certificate registry: saves quiz results on the server, lets anyone verify a certificate ID,
// and lets the site owner download all participants as a CSV (protected by ADMIN_TOKEN).
// No packages needed. Data is stored in data/certificates.json (never served to the public).
import { promises as fs } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";

const ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // same alphabet the quiz always used
const ID_RE = /^AKS-\d{8}-[A-HJ-NP-Z2-9]{6}$/;
const MAX_BODY = 4096;

export function normalizeName(s) { return String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 50); }
export function normalizePhone(s) {
  const d = String(s ?? "").replace(/[\s\-]/g, "").replace(/^(\+91|0091|91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}
export function isValidId(id) { return typeof id === "string" && ID_RE.test(id); }
export function makeId(now = new Date(), rnd = (n) => crypto.randomInt(n)) {
  const ymd = now.getUTCFullYear() + String(now.getUTCMonth() + 1).padStart(2, "0") + String(now.getUTCDate()).padStart(2, "0");
  let r = ""; for (let i = 0; i < 6; i++) r += ID_CHARS[rnd(ID_CHARS.length)];
  return `AKS-${ymd}-${r}`;
}
// Spreadsheet formula injection guard: a cell starting with = + - @ is prefixed with '
export function csvCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows) {
  const head = ["Certificate ID", "Date (UTC)", "Name", "Mobile", "Quiz", "Score", "Out of", "Percent"];
  const lines = [head.join(",")].concat(rows.map((r) => [r.id, r.date, r.name, r.phone, r.quizTitle, r.score, r.total, r.pct].map(csvCell).join(",")));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";   // BOM so Excel shows Hindi names correctly
}

// Reads the quiz list (title, pass mark, number of questions) from assets/quiz-data.js, the single source of truth.
export async function loadQuizzes(siteDir) {
  const src = await fs.readFile(path.join(siteDir, "assets", "quiz-data.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { timeout: 2000 });
  const q = sandbox.window.AKS_QUIZ && sandbox.window.AKS_QUIZ.quizzes;
  if (!q) throw new Error("quiz-data.js has no quizzes");
  const out = {};
  for (const [id, v] of Object.entries(q)) out[id] = { title: v.title[0], titleHi: v.title[1], pass: v.pass, total: v.questions.length };
  return out;
}

export function createStore(file) {
  let queue = Promise.resolve();
  const read = async () => { try { const j = JSON.parse(await fs.readFile(file, "utf8")); return Array.isArray(j) ? j : []; } catch (e) { if (e.code === "ENOENT") return []; throw e; } };
  const write = async (rows) => { await fs.mkdir(path.dirname(file), { recursive: true }); const tmp = file + ".tmp"; await fs.writeFile(tmp, JSON.stringify(rows, null, 1)); await fs.rename(tmp, file); };
  const run = (fn) => { const p = queue.then(fn); queue = p.catch(() => {}); return p; };   // one write at a time, never lose records
  return {
    all: () => run(read),
    find: (id) => run(async () => (await read()).find((r) => r.id === id) || null),
    add: (rec) => run(async () => { const rows = await read(); rows.push(rec); await write(rows); return rec; }),
  };
}

function rateLimiter(max, windowMs) {
  const hits = new Map();
  return (key, now = Date.now()) => {
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(now); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return true;
  };
}

function send(res, code, obj, extra = {}) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    let tooBig = false;
    req.on("data", (c) => { size += c.length; if (size > MAX_BODY) tooBig = true; else chunks.push(c); });   // keep draining so the 413 reply reaches the client
    req.on("end", () => (tooBig ? reject(Object.assign(new Error("too large"), { code: 413 })) : resolve(Buffer.concat(chunks).toString("utf8"))));
    req.on("error", reject);
  });
}
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest(), hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Returns an async handler: (req, res, url) => true if the request was an /api/ certificate route and has been answered.
export function createCertApi({ siteDir, dataFile, adminToken = process.env.ADMIN_TOKEN, now = () => new Date() }) {
  const store = createStore(dataFile);
  let quizzes = null;
  const postLimit = rateLimiter(20, 60 * 60 * 1000), verifyLimit = rateLimiter(60, 60 * 1000), adminLimit = rateLimiter(10, 60 * 1000);
  const ip = (req) => req.socket.remoteAddress || "?";

  return async function handle(req, res, url) {
    const p = url.pathname;
    if (!p.startsWith("/api/")) return false;
    try {
      if (p === "/api/certificate") {
        if (req.method !== "POST") { send(res, 405, { error: "method" }, { allow: "POST" }); return true; }
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) { send(res, 403, { error: "origin" }); return true; }
        if (!/^application\/json/i.test(req.headers["content-type"] || "")) { send(res, 415, { error: "content-type" }); return true; }
        if (!postLimit(ip(req))) { send(res, 429, { error: "rate" }); return true; }
        let body;
        try { body = JSON.parse(await readBody(req)); } catch (e) { send(res, e.code === 413 ? 413 : 400, { error: "bad-body" }, { connection: "close" }); return true; }
        quizzes = quizzes || await loadQuizzes(siteDir);
        const quiz = quizzes[body && body.quizId];
        const name = normalizeName(body && body.name), phone = normalizePhone(body && body.phone);
        const score = body && body.score;
        if (!quiz || name.length < 2 || !phone || !Number.isInteger(score) || score < quiz.pass || score > quiz.total) { send(res, 400, { error: "invalid" }); return true; }
        const d = now();
        const rec = { id: makeId(d), date: d.toISOString(), name, phone, quizId: body.quizId, quizTitle: quiz.title, score, total: quiz.total, pct: Math.round((score / quiz.total) * 100) };
        await store.add(rec);
        send(res, 201, { id: rec.id, date: rec.date });   // phone is never sent back
        return true;
      }
      if (p === "/api/verify") {
        if (req.method !== "GET") { send(res, 405, { error: "method" }, { allow: "GET" }); return true; }
        if (!verifyLimit(ip(req))) { send(res, 429, { error: "rate" }); return true; }
        const id = String(url.searchParams.get("id") || "").trim().toUpperCase();
        if (!isValidId(id)) { send(res, 400, { valid: false, error: "format" }); return true; }
        const r = await store.find(id);
        if (!r) { send(res, 404, { valid: false }); return true; }
        send(res, 200, { valid: true, id: r.id, name: r.name, quiz: r.quizTitle, quizHi: (quizzes || (quizzes = await loadQuizzes(siteDir)))[r.quizId]?.titleHi || r.quizTitle, score: r.score, total: r.total, pct: r.pct, date: r.date });
        return true;   // mobile number is deliberately not included
      }
      if (p === "/api/admin/export.csv") {
        if (!adminLimit(ip(req))) { send(res, 429, { error: "rate" }); return true; }
        if (!adminToken || adminToken.length < 12) { send(res, 404, { error: "not-configured" }); return true; }
        const auth = req.headers.authorization || "";
        const given = auth.startsWith("Bearer ") ? auth.slice(7) : (url.searchParams.get("token") || "");
        if (!given || !safeEqual(given, adminToken)) { send(res, 401, { error: "unauthorized" }); return true; }
        const csv = toCsv(await store.all());
        res.writeHead(200, { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="participants.csv"', "cache-control": "no-store", "x-content-type-options": "nosniff" });
        res.end(csv);
        return true;
      }
      send(res, 404, { error: "not-found" });
      return true;
    } catch (e) {
      console.error("[certs] error:", e && e.message);
      send(res, 500, { error: "server" });
      return true;
    }
  };
}
