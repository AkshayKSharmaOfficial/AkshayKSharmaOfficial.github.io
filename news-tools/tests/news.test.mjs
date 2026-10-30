import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseFeed, cleanText, isSafeHttpUrl, canonicalUrl, parseDate, normalizeItem, dedupe, categorize, LIMITS } from "../lib.mjs";
import { fetchText, ingestSource, runIngestion, runAndStore, withLock, toJs } from "../job.mjs";

// ---- test-only fixtures (never written to the production feed) ----
const RSS = (items) => `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>${items}</channel></rss>`;
const item = (t, l, d, desc = "") => `<item><title>${t}</title><link>${l}</link>${d ? `<pubDate>${d}</pubDate>` : ""}<description>${desc}</description></item>`;
const SRC = { id: "s1", name: "S1", publisher: "Pub One", url: "https://feed.example.org/rss", kind: "media", region: "global", filter: null };
const NOW = Date.parse("2026-10-29T08:00:00Z");
const resp = (body, status = 200, extra = {}) => ({ ok: status >= 200 && status < 300, status, url: extra.url || "https://feed.example.org/rss", headers: new Headers(extra.headers || {}), text: async () => body, body: null });

test("parses RSS 2.0 items", () => {
  const it = parseFeed(RSS(item("Hello", "https://a.example.com/1", "Wed, 28 Oct 2026 10:00:00 GMT", "desc")));
  assert.equal(it.length, 1); assert.equal(it[0].link, "https://a.example.com/1");
});
test("parses Atom entries with href links", () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>A</title><link rel="alternate" href="https://a.example.com/x?a=1&amp;b=2"/><published>2026-10-28T10:00:00Z</published><summary>S</summary></entry></feed>`;
  const it = parseFeed(xml); assert.equal(it[0].link, "https://a.example.com/x?a=1&b=2"); assert.equal(it[0].date, "2026-10-28T10:00:00Z");
});
test("malformed / non-feed responses throw", () => {
  assert.throws(() => parseFeed(""), /empty/);
  assert.throws(() => parseFeed("<html><body>Blocked</body></html>"), /HTML/);
  assert.throws(() => parseFeed("{\"json\":true}"), /not an RSS/);
  assert.deepEqual(parseFeed("<rss><channel><item><title>broken"), []);   // truncated XML: no complete item, no crash
});
test("empty feed gives no items", () => assert.deepEqual(parseFeed(RSS("")), []));
test("missing date -> null, bad date -> null, future date -> null", () => {
  assert.equal(parseDate("", NOW), null); assert.equal(parseDate("not a date", NOW), null);
  assert.equal(parseDate("Wed, 28 Oct 2027 10:00:00 GMT", NOW), null);
  assert.equal(parseDate("Wed, 28 Oct 2026 10:00:00 GMT", NOW), "2026-10-28T10:00:00.000Z");
  const n = normalizeItem({ title: "T", link: "https://a.example.com/1", date: "", summary: "" }, SRC, NOW);
  assert.equal(n.article.published, null);
});
test("invalid or unsafe URLs are rejected", () => {
  for (const u of ["javascript:alert(1)", "data:text/html,x", "http://a.example.com/1", "ftp://a.example.com", "https://user:pw@a.example.com/", "https://localhost/x", "https://127.0.0.1/x", "", "not a url", "https://nodot/x"])
    assert.equal(isSafeHttpUrl(u), false, u);
  assert.equal(isSafeHttpUrl("https://a.example.com/1"), true);
  assert.equal(normalizeItem({ title: "T", link: "javascript:alert(1)" }, SRC, NOW).reject, "invalid or non-https url");
  assert.equal(normalizeItem({ title: "", link: "https://a.example.com/1" }, SRC, NOW).reject, "missing title");
});
test("safe text: tags, scripts, entities and control chars are neutralised", () => {
  const t = cleanText(`<![CDATA[<b>Bold</b><script>alert(1)</script> &lt;img src=x onerror=alert(1)&gt; hi\u0000 ]]>`);
  assert.ok(!/[<>]/.test(t), t); assert.ok(!/script/i.test(t) || !/alert\(1\)<\/script/.test(t));
  assert.ok(!t.includes("\u0000"));
  assert.equal(cleanText("A &amp; B &#8217;s &#x41;"), "A & B ’s A");
  assert.ok(cleanText("word ".repeat(200), 280).length <= 280);
});
test("duplicates removed by canonical URL and by normalised title", () => {
  const mk = (title, url) => normalizeItem({ title, link: url, date: "Wed, 28 Oct 2026 10:00:00 GMT" }, SRC, NOW).article;
  const list = dedupe([mk("Big Scam!", "https://www.a.example.com/p/1?utm_source=x#top"), mk("Other", "https://a.example.com/p/1/"), mk("BIG scam", "https://b.example.com/q"), mk("Unique", "https://b.example.com/z")]);
  assert.deepEqual(list.map((a) => a.title), ["Big Scam!", "Unique"]);
  assert.equal(canonicalUrl("https://WWW.A.com/x/?utm_medium=1&b=2&a=1#f"), "https://a.com/x?a=1&b=2");
});
test("categorisation and official label", () => {
  assert.ok(categorize({ title: "Ransomware gang hits hospital", summary: "" }, SRC).includes("ransomware"));
  assert.ok(categorize({ title: "Database exposed in data breach", summary: "" }, SRC).includes("breach"));
  assert.ok(categorize({ title: "Critical flaw CVE-2026-1234 patched", summary: "" }, SRC).includes("vuln"));
  assert.ok(categorize({ title: "New spyware targets phones", summary: "" }, SRC).includes("malware"));
  assert.ok(categorize({ title: "Phishing campaign steals logins", summary: "" }, SRC).includes("phishing"));
  assert.ok(categorize({ title: "Deepfake voice scam and AI agents", summary: "" }, SRC).includes("ai"));
  assert.ok(categorize({ title: "Hackers compromise supply chain", summary: "" }, SRC).includes("attack"));
  assert.ok(categorize({ title: "Alert AA26", summary: "" }, { ...SRC, kind: "official" }).includes("advisory"));
  assert.ok(!categorize({ title: "Alert AA26", summary: "" }, SRC).includes("advisory"));   // media is never labelled official
  assert.deepEqual(categorize({ title: "Nothing special", summary: "" }, SRC), []);        // no match -> only under "All"
  assert.ok(categorize({ title: "x", summary: "" }, { ...SRC, region: "india" }).includes("india"));
  assert.ok(categorize({ title: "State Bank of India data leak", summary: "" }, SRC).includes("india"));
});
test("keyword filter drops unrelated items for general feeds", () => {
  const src = { ...SRC, filter: /cyber|scam/i };
  assert.equal(normalizeItem({ title: "Phone launch", link: "https://a.example.com/p" }, src, NOW).reject, "not cyber related");
  assert.ok(normalizeItem({ title: "Scam alert", link: "https://a.example.com/p" }, src, NOW).article);
});

test("fetchText: timeout is bounded and retried a limited number of times", async () => {
  let calls = 0;
  const hang = (url, { signal }) => { calls++; return new Promise((_, rej) => signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))); };
  await assert.rejects(fetchText("https://x.example.com", { fetchImpl: hang, timeoutMs: 30, retries: 2, backoffMs: 1 }), /timeout/);
  assert.equal(calls, 3);
});
test("fetchText: 404 is not retried, 503 is", async () => {
  let c = 0;
  await assert.rejects(fetchText("https://x.example.com", { fetchImpl: async () => { c++; return resp("", 404); }, retries: 2, backoffMs: 1 }), /HTTP 404/); assert.equal(c, 1);
  c = 0;
  await assert.rejects(fetchText("https://x.example.com", { fetchImpl: async () => { c++; return resp("", 503); }, retries: 2, backoffMs: 1 }), /HTTP 503/); assert.equal(c, 3);
});
test("fetchText: oversize and non-https redirect are rejected", async () => {
  await assert.rejects(fetchText("https://x.example.com", { fetchImpl: async () => resp("x".repeat(100)), maxBytes: 10, retries: 0 }), /too large/);
  await assert.rejects(fetchText("https://x.example.com", { fetchImpl: async () => resp("<rss/>", 200, { url: "http://evil.example/" }), retries: 0 }), /non-https/);
});

test("ingestSource: never throws, reports malformed feed as failure", async () => {
  const r = await ingestSource(SRC, {}, { fetchImpl: async () => resp("<html>captcha</html>"), retries: 0, now: NOW });
  assert.equal(r.ok, false); assert.match(r.error, /HTML/);
});
test("ingestSource: 304 Not Modified is a success with no new items", async () => {
  const r = await ingestSource(SRC, { etag: "abc" }, { fetchImpl: async (u, o) => { assert.equal(o.headers["if-none-match"], "abc"); return { ...resp("", 304), ok: false }; }, retries: 0, now: NOW });
  assert.equal(r.ok, true); assert.equal(r.notModified, true);
});

const feedA = RSS(item("Alpha scam story", "https://a.example.com/1", "Wed, 28 Oct 2026 10:00:00 GMT", "Alpha <b>summary</b>") + item("Bad link", "javascript:alert(1)", "") + item("Beta", "https://a.example.com/2", ""));
test("runIngestion: partial failure keeps old articles of the failed source and updates lastSuccess", async () => {
  const S2 = { ...SRC, id: "s2", publisher: "Pub Two", url: "https://feed2.example.org/rss" };
  const fetchImpl = async (u) => u.includes("feed2") ? resp("", 500) : resp(feedA);
  const old = { lastSuccess: "2026-10-27T00:00:00.000Z", sources: [], articles: [{ id: "old1", title: "Old article from S2", url: "https://b.example.com/old", source: "Pub Two", sourceId: "s2", kind: "media", published: "2026-10-26T00:00:00.000Z", summary: "", categories: ["global"], firstSeen: "2026-10-26T01:00:00.000Z" }] };
  const { data, anyOk, failed } = await runIngestion({ sources: [SRC, S2], existing: old, opts: { fetchImpl, retries: 0 }, now: NOW });
  assert.equal(anyOk, true); assert.equal(failed.length, 1); assert.equal(failed[0].id, "s2");
  assert.equal(data.lastSuccess, new Date(NOW).toISOString());
  assert.deepEqual(data.articles.map((a) => a.title).sort(), ["Alpha scam story", "Beta", "Old article from S2"].sort());
  assert.ok(data.articles.every((a) => !("canon" in a)));
  assert.equal(data.articles.find((a) => a.title === "Alpha scam story").summary, "Alpha summary");
  assert.equal(data.sources.find((s) => s.id === "s2").ok, false);
});
test("runIngestion: all sources failing keeps old data and old lastSuccess", async () => {
  const old = { lastSuccess: "2026-10-27T00:00:00.000Z", sources: [], articles: [{ id: "o", title: "Kept", url: "https://b.example.com/k", source: "P", sourceId: "s1", kind: "media", published: "2026-10-27T00:00:00.000Z", summary: "", categories: ["global"] }] };
  const { data, anyOk } = await runIngestion({ sources: [SRC], existing: old, opts: { fetchImpl: async () => { throw new Error("network down"); }, retries: 0, backoffMs: 1 }, now: NOW });
  assert.equal(anyOk, false); assert.equal(data.lastSuccess, "2026-10-27T00:00:00.000Z"); assert.equal(data.articles.length, 1);
});
test("runIngestion: empty feed and no previous data gives empty list, lastSuccess set", async () => {
  const { data } = await runIngestion({ sources: [SRC], existing: null, opts: { fetchImpl: async () => resp(RSS("")), retries: 0 }, now: NOW });
  assert.equal(data.articles.length, 0); assert.ok(data.lastSuccess);
});
test("runIngestion: repeated run does not duplicate and keeps firstSeen; limits enforced", async () => {
  const many = RSS(Array.from({ length: 300 }, (_, i) => item(`Scam number ${i}`, `https://a.example.com/${i}`, "Wed, 28 Oct 2026 10:00:00 GMT")).join(""));
  const f = async () => resp(many);
  const r1 = await runIngestion({ sources: [SRC], existing: null, opts: { fetchImpl: f, retries: 0 }, now: NOW });
  assert.equal(r1.data.articles.length, LIMITS.perSource);
  const r2 = await runIngestion({ sources: [SRC], existing: r1.data, opts: { fetchImpl: f, retries: 0 }, now: NOW + 3600000 });
  assert.equal(r2.data.articles.length, LIMITS.perSource);
  assert.equal(r2.data.articles[0].firstSeen, r1.data.articles[0].firstSeen);
});
test("sorted newest first; undated items sort by first-seen", async () => {
  const { data } = await runIngestion({ sources: [SRC], existing: null, opts: { fetchImpl: async () => resp(RSS(item("Old", "https://a.example.com/o", "Mon, 26 Oct 2026 10:00:00 GMT") + item("New", "https://a.example.com/n", "Wed, 28 Oct 2026 10:00:00 GMT"))), retries: 0 }, now: NOW });
  assert.deepEqual(data.articles.map((a) => a.title), ["New", "Old"]);
});

test("runAndStore writes news.json and news-data.js atomically; corrupt old file does not crash", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "news-"));
  await fs.mkdir(path.join(dir, "assets")); await fs.writeFile(path.join(dir, "assets", "news.json"), "{corrupt");
  const log = []; 
  await runAndStore({ sources: [SRC], siteDir: dir, opts: { fetchImpl: async () => resp(feedA), retries: 0 }, now: NOW, log: (m) => log.push(m) });
  const j = JSON.parse(await fs.readFile(path.join(dir, "assets", "news.json"), "utf8"));
  assert.equal(j.articles.length, 2);
  const js = await fs.readFile(path.join(dir, "assets", "news-data.js"), "utf8");
  assert.match(js, /^\/\*.*\*\/\nwindow\.AKS_NEWS = \{/s);
  assert.equal((await fs.readdir(path.join(dir, "assets"))).some((f) => f.endsWith(".tmp")), false);
});
test("scheduled runs do not overlap (lock)", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lock-")); const lock = path.join(dir, "l.lock");
  let inner;
  const outer = await withLock(lock, async () => { inner = await withLock(lock, async () => "never"); return "ran"; });
  assert.equal(outer.value, "ran"); assert.equal(inner.skipped, true);
  assert.equal((await withLock(lock, async () => "again")).value, "again");   // lock released afterwards
});
test("news-data.js escapes line separators", () => assert.ok(!toJs({ a: "x y" }).includes(" ")));
