import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { mkdtempSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createCertApi, makeId, isValidId, normalizePhone, csvCell, toCsv } from "../certs.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteDir = existsSync(path.join(here, "../../assets/quiz-data.js")) ? path.resolve(here, "../..") : path.resolve(here, "../../akshay-website");
const TOKEN = "test-token-123456";

async function boot(opts = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "certs-"));
  const api = createCertApi({ siteDir, dataFile: path.join(dir, "data", "c.json"), adminToken: TOKEN, ...opts });
  const srv = http.createServer(async (req, res) => { if (!(await api(req, res, new URL(req.url, "http://x")))) res.writeHead(404).end(); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  return { base, close: () => new Promise((r) => srv.close(r)) };
}
const post = (base, body, headers = {}) => fetch(base + "/api/certificate", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const good = { quizId: "password-and-account-security", name: "  Riya   Sharma ", phone: "+91 98765-43210", score: 18 };

test("helpers: id format, phone normalisation, csv formula guard", () => {
  assert.ok(isValidId(makeId()));
  assert.ok(!isValidId("AKS-20261029-ABC01O") && !isValidId("x") && !isValidId(null));
  assert.equal(normalizePhone("+91 98765 43210"), "9876543210");
  assert.equal(normalizePhone("12345"), null);
  assert.equal(csvCell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
  assert.equal(csvCell("a,b"), "\"a,b\"");
  assert.ok(toCsv([]).startsWith("\uFEFFCertificate ID,"));
});

test("api: pass is saved, ID returned, phone never returned, verify works", async () => {
  const s = await boot();
  try {
    const r = await post(s.base, good);
    assert.equal(r.status, 201);
    const j = await r.json();
    assert.ok(isValidId(j.id)); assert.equal(j.phone, undefined);
    const v = await (await fetch(`${s.base}/api/verify?id=${j.id.toLowerCase()}`)).json();
    assert.equal(v.valid, true); assert.equal(v.name, "Riya Sharma"); assert.equal(v.score, 18); assert.equal(v.phone, undefined);
    assert.ok(!JSON.stringify(v).includes("9876543210"));
  } finally { await s.close(); }
});

test("api: bad input is rejected (low score, impossible score, bad phone, short name, unknown quiz, non-JSON, wrong origin)", async () => {
  const s = await boot();
  try {
    for (const bad of [{ ...good, score: 1 }, { ...good, score: 999 }, { ...good, score: "18" }, { ...good, phone: "123" }, { ...good, name: "A" }, { ...good, quizId: "nope" }, null]) assert.equal((await post(s.base, bad)).status, 400);
    assert.equal((await post(s.base, "{not json")).status, 400);
    assert.equal((await post(s.base, good, { "content-type": "text/plain" })).status, 415);
    assert.equal((await post(s.base, good, { origin: "https://evil.example" })).status, 403);
    assert.equal((await post(s.base, "x".repeat(10000))).status, 413);
    assert.equal((await fetch(s.base + "/api/certificate")).status, 405);
  } finally { await s.close(); }
});

test("api: verify handles unknown and malformed IDs", async () => {
  const s = await boot();
  try {
    assert.equal((await fetch(s.base + "/api/verify?id=AKS-20260101-AAAAAA")).status, 404);
    assert.equal((await fetch(s.base + "/api/verify?id=<script>")).status, 400);
    assert.equal((await fetch(s.base + "/api/verify")).status, 400);
  } finally { await s.close(); }
});

test("api: CSV export needs the token; formulas are neutralised; unconfigured token disables it", async () => {
  const s = await boot();
  try {
    await post(s.base, { ...good, name: "=cmd|calc" });
    assert.equal((await fetch(s.base + "/api/admin/export.csv")).status, 401);
    assert.equal((await fetch(s.base + "/api/admin/export.csv?token=wrong-token-123456")).status, 401);
    const ok = await fetch(s.base + "/api/admin/export.csv", { headers: { authorization: "Bearer " + TOKEN } });
    assert.equal(ok.status, 200); assert.match(ok.headers.get("content-type"), /text\/csv/);
    const t = await ok.text();
    assert.ok(t.includes("9876543210")); assert.ok(t.includes("'=cmd|calc")); assert.ok(!t.includes(",=cmd"));
    assert.equal((await fetch(s.base + "/api/admin/export.csv?token=" + TOKEN)).status, 200);
  } finally { await s.close(); }
  const off = await boot({ adminToken: "" });
  try { assert.equal((await fetch(off.base + "/api/admin/export.csv?token=")).status, 404); } finally { await off.close(); }
});

test("api: 30 simultaneous passes are all saved with unique IDs (no lost writes)", async () => {
  const s = await boot({ });
  try {
    const rs = await Promise.all(Array.from({ length: 30 }, (_, i) => post(s.base, { ...good, name: "User " + i })));
    const ids = new Set();
    for (const r of rs) { if (r.status === 201) ids.add((await r.json()).id); }
    const csv = await (await fetch(s.base + "/api/admin/export.csv", { headers: { authorization: "Bearer " + TOKEN } })).text();
    assert.equal(csv.trim().split("\r\n").length - 1, ids.size);
    assert.equal(ids.size, 20);   // the per-IP limit is 20/hour: the rest get 429, nothing is half-saved
  } finally { await s.close(); }
});
