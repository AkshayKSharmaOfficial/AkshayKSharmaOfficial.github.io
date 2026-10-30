// Starts the real server on a temporary site folder (with the real quiz-data.js) and exercises the quiz/verify/admin API over HTTP.
import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { maskName, csvCell } from "../quiz-api.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const serve = path.join(root, "news-tools", "serve.mjs");
const SLUG = "phishing-and-fake-websites";
const TOKEN = "test-admin-token-1234567890";

function todayId(rnd = "ABC234") { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `AKS-${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${rnd}`; }

async function withServer(env, fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aks-quiz-"));
  await fs.mkdir(path.join(dir, "assets"));
  await fs.copyFile(path.join(root, "assets", "quiz-data.js"), path.join(dir, "assets", "quiz-data.js"));
  await fs.writeFile(path.join(dir, "index.html"), "<h1>home</h1>");
  await fs.writeFile(path.join(dir, ".env"), "ADMIN_TOKEN=secret-should-never-be-served");
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [serve, "--site", dir, "--port", String(port)], { env: { ...process.env, NEWS_OFFLINE: "1", ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; child.stdout.on("data", (d) => (out += d));
  try {
    for (let i = 0; i < 50 && !/\[site\]/.test(out); i++) await new Promise((r) => setTimeout(r, 100));
    assert.match(out, /\[site\]/, "server did not start");
    await fn(`http://127.0.0.1:${port}`, dir);
  } finally { child.kill(); await fs.rm(dir, { recursive: true, force: true }); }
}
const post = (base, body, headers = {}) => fetch(base + "/api/quiz/result", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const good = (o = {}) => ({ quiz: SLUG, name: "Rahul Kumar Sharma", phone: "9876543210", score: 18, total: 20, consent: true, id: todayId(), ...o });

test("helpers: name is shortened, CSV cells are safe", () => {
  assert.equal(maskName("Rahul Kumar Sharma"), "Rahul K. S."); assert.equal(maskName("Priya"), "Priya");
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)"); assert.equal(csvCell('a,"b"'), '"a,""b"""'); assert.equal(csvCell("plain"), "plain");
});

test("pass: stored, then verifiable; mobile number never returned; name shortened", async () => {
  await withServer({ ADMIN_TOKEN: TOKEN }, async (base, dir) => {
    const id = todayId("PQR789");
    const r = await post(base, good({ id })); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, passed: true, id });
    const v = await (await fetch(`${base}/api/verify?id=${id.toLowerCase()}`)).json();
    assert.equal(v.valid, true); assert.equal(v.name, "Rahul K. S."); assert.equal(v.score, 18); assert.equal(v.quiz, "Phishing and Fake Websites");
    assert.ok(!JSON.stringify(v).includes("9876543210"), "mobile must never be returned");
    const stored = (await fs.readFile(path.join(dir, "data", "quiz-results.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
    assert.equal(stored.length, 1); assert.equal(stored[0].phone, "9876543210"); assert.equal(stored[0].passed, true);
  });
});

test("fail is recorded without an ID and can never be verified", async () => {
  await withServer({}, async (base) => {
    const r = await post(base, good({ score: 14, id: undefined })); assert.deepEqual(await r.json(), { ok: true, passed: false, id: null });
    const r2 = await post(base, good({ score: 14, id: todayId("FAKE22") }));       // a browser claiming an id on a failed score
    assert.equal((await r2.json()).id, null);
    assert.equal((await (await fetch(`${base}/api/verify?id=${todayId("FAKE22")}`)).json()).valid, false);
  });
});

test("the server decides pass/fail itself; forged or invalid submissions are rejected", async () => {
  await withServer({}, async (base) => {
    assert.equal((await post(base, good({ score: 20, id: undefined }))).status, 400);          // passed but no certificate id
    assert.equal((await post(base, good({ consent: false }))).status, 400);
    assert.equal((await post(base, good({ consent: undefined }))).status, 400);
    assert.equal((await post(base, good({ phone: "1234567890" }))).status, 400);
    assert.equal((await post(base, good({ phone: "98765" }))).status, 400);
    assert.equal((await post(base, good({ name: "<script>alert(1)</script>" }))).status, 400);
    assert.equal((await post(base, good({ name: "A" }))).status, 400);
    assert.equal((await post(base, good({ quiz: "no-such-quiz" }))).status, 400);
    assert.equal((await post(base, good({ quiz: "__proto__" }))).status, 400);
    assert.equal((await post(base, good({ total: 5 }))).status, 400);
    assert.equal((await post(base, good({ score: 21 }))).status, 400);
    assert.equal((await post(base, good({ score: -1 }))).status, 400);
    assert.equal((await post(base, good({ score: 1.5 }))).status, 400);
    assert.equal((await post(base, good({ id: "AKS-20200101-ABC234" }))).status, 400);          // old date
    assert.equal((await post(base, good({ id: "nonsense" }))).status, 400);
    assert.equal((await post(base, "not json")).status, 400);
    assert.equal((await post(base, "x".repeat(6000))).status, 413);
    assert.equal((await post(base, "{}", { "content-type": "text/plain" })).status, 415);
    assert.equal((await fetch(base + "/api/quiz/result")).status, 405);
  });
});

test("the same certificate ID cannot be registered twice", async () => {
  await withServer({}, async (base) => {
    const id = todayId("DUP234");
    assert.equal((await post(base, good({ id }))).status, 200);
    assert.equal((await post(base, good({ id, name: "Someone Else" }))).status, 409);
    assert.equal((await (await fetch(`${base}/api/verify?id=${id}`)).json()).name, "Rahul K. S.");     // original owner kept
  });
});

test("verify: unknown / malformed IDs say not valid", async () => {
  await withServer({}, async (base) => {
    assert.deepEqual(await (await fetch(`${base}/api/verify?id=AKS-20261030-ZZZZZ9`)).json(), { valid: false, reason: "not-found" });
    assert.deepEqual(await (await fetch(`${base}/api/verify?id=hello`)).json(), { valid: false, reason: "format" });
    assert.deepEqual(await (await fetch(`${base}/api/verify`)).json(), { valid: false, reason: "format" });
  });
});

test("admin CSV: off without ADMIN_TOKEN, 401 with a wrong token, correct token returns all rows safely", async () => {
  await withServer({}, async (base) => { assert.equal((await fetch(`${base}/api/admin/quiz-results.csv?token=${TOKEN}`)).status, 404); });
  await withServer({ ADMIN_TOKEN: TOKEN }, async (base) => {
    await post(base, good({ name: "Rahul Kumar", id: todayId("CSV234") })); await post(base, good({ name: "Asha Verma", score: 10, id: undefined }));
    assert.equal((await fetch(`${base}/api/admin/quiz-results.csv`)).status, 401);
    assert.equal((await fetch(`${base}/api/admin/quiz-results.csv?token=wrong-token-wrong-token`)).status, 401);
    const r = await fetch(`${base}/api/admin/quiz-results.csv`, { headers: { authorization: "Bearer " + TOKEN } });
    assert.equal(r.status, 200); assert.match(r.headers.get("content-type"), /text\/csv/);
    const t = await r.text(); assert.match(t, /Rahul Kumar,9876543210,Phishing and Fake Websites,18,20,PASSED/); assert.match(t, /Asha Verma,9876543210.*not passed/);
    assert.equal((await fetch(`${base}/api/admin/quiz-results.csv?token=${TOKEN}`)).status, 200);
  });
});

test("private files are never served: results, .env, server code, package.json", async () => {
  await withServer({ ADMIN_TOKEN: TOKEN }, async (base) => {
    await post(base, good({ id: todayId("PRV234") }));
    for (const p of ["/data/quiz-results.jsonl", "/data/", "/.env", "/news-tools/serve.mjs", "/news-tools/quiz-api.mjs", "/package.json", "/%2e%2e/etc/passwd", "/.git/config"]) {
      const r = await fetch(base + p); assert.ok([403, 404].includes(r.status), p + " -> " + r.status);
      assert.ok(!(await r.text()).includes("secret-should-never-be-served"));
    }
    assert.equal((await fetch(base + "/")).status, 200);
  });
});

test("too many submissions from one visitor are rate-limited", async () => {
  await withServer({}, async (base) => {
    let last = 0; for (let i = 0; i < 32; i++) last = (await post(base, good({ score: 3, id: undefined }))).status;
    assert.equal(last, 429);
  });
});
