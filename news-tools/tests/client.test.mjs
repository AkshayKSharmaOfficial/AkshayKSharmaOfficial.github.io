import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
const req = createRequire(import.meta.url);
const N = req(existsSync(new URL("../../assets/news.js", import.meta.url)) ? "../../assets/news.js" : "../../akshay-website/assets/news.js");

const L = [
  { title: "UPI fraud in Pune", url: "https://a.example.com/1", summary: "Police arrest gang", source: "P1", categories: ["phishing", "india"] },
  { title: "Router advisory", url: "https://a.example.com/2", summary: "", source: "CISA", categories: ["advisory"] },
  { title: "Deepfake scam", url: "https://a.example.com/3", source: "P2", categories: ["ai"] },
];
test("client: invalid articles are dropped (unsafe url, empty title, wrong types)", () => {
  const d = N.normalize({ lastSuccess: "2026-10-29T00:00:00Z", articles: [...L, { title: "x", url: "javascript:alert(1)" }, { title: "  ", url: "https://a.example.com/9" }, null, 5, { url: "https://a.example.com/8" }, { title: "http", url: "http://a.example.com/7" }] });
  assert.equal(d.articles.length, 3);
});
test("client: malformed payloads give null (-> error state)", () => {
  for (const x of [null, undefined, "str", 5, {}, { articles: "no" }]) assert.equal(N.normalize(x), null);
  assert.deepEqual(N.normalize({ articles: [] }).articles, []);   // empty list is valid (-> empty state)
});
test("client: category filter and search (AND of words, case-insensitive, source searchable)", () => {
  assert.equal(N.filterArticles(L, "india", "").length, 1);
  assert.equal(N.filterArticles(L, "all", "").length, 3);
  assert.equal(N.filterArticles(L, "all", "UPI pune").length, 1);
  assert.equal(N.filterArticles(L, "all", "cisa").length, 1);
  assert.equal(N.filterArticles(L, "phishing", "deepfake").length, 0);
  assert.equal(N.filterArticles(L, "nonexistent", "").length, 0);
  assert.equal(N.filterArticles(L, "all", "<script>").length, 0);
});
test("client: date formatting is safe for missing/invalid dates", () => {
  assert.equal(N.fmtDate(null, "en"), ""); assert.equal(N.fmtDate("garbage", "en"), "");
  assert.match(N.fmtDate("2026-10-29T08:00:00Z", "en"), /2026/);
});
test("client: all 9 required categories exist (+All) with Hindi labels", () => {
  assert.deepEqual(N.CATS.map((c) => c.id), ["all", "attack", "breach", "ransomware", "vuln", "malware", "phishing", "ai", "advisory", "india"]);
  assert.ok(N.CATS.every((c) => c.en && c.hi));
});
test("client: source status list is kept and failed sources are reported", () => {
  const d = N.normalize({ articles: L, sources: [{ id: "a", name: "Src A", ok: true }, { id: "b", name: "Src B", ok: false, error: "HTTP 503" }, null, { ok: false }] });
  assert.equal(d.sources.length, 2);
  assert.deepEqual(N.failedSources(d).map((x) => x.name), ["Src B"]);
  assert.deepEqual(N.failedSources(N.normalize({ articles: [] })), []);
});
