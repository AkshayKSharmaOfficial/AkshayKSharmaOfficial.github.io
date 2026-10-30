// Tests with REAL feed excerpts (tests/fixtures/*.xml were copied from the live feeds on 29 Oct 2026).
// No network is used: fetch is replaced by a function that returns the saved XML.
import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES } from "../sources.mjs";
import { runIngestion } from "../job.mjs";
import { isSafeHttpUrl } from "../lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (n) => fs.readFile(path.join(here, "fixtures", n), "utf8");
const NOW = Date.parse("2026-10-29T08:00:00Z");
const byId = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
const ok = (body) => ({ ok: true, status: 200, url: "https://x.example.org/", headers: new Headers(), text: async () => body, body: null });
const bad = (status) => ({ ok: false, status, url: "https://x.example.org/", headers: new Headers(), text: async () => "", body: null });

test("source list: the 6 verified-or-documented feeds, https only, unique ids, CISA is official", () => {
  assert.deepEqual(SOURCES.map((s) => s.id), ["thn", "bleeping", "krebs", "securityweek", "darkreading", "cisa"]);
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length);
  assert.ok(SOURCES.every((s) => isSafeHttpUrl(s.url)));
  assert.equal(byId.cisa.kind, "official");
  assert.ok(SOURCES.filter((s) => s.id !== "cisa").every((s) => s.kind === "media"));
});

test("real feed excerpts parse: all items valid, dates converted to UTC, text is plain", async () => {
  const files = { thn: "thn.xml", bleeping: "bleeping.xml", darkreading: "darkreading.xml", krebs: "krebs.xml" };
  const map = {}; for (const [id, f] of Object.entries(files)) map[byId[id].url] = await fx(f);
  const fetchImpl = async (url) => ok(map[url]);
  const { data, anyOk } = await runIngestion({ sources: Object.keys(files).map((i) => byId[i]), existing: null, opts: { fetchImpl, retries: 0 }, now: NOW });
  assert.ok(anyOk);
  assert.deepEqual(data.sources.map((s) => [s.id, s.ok, s.count]), [["thn", true, 6], ["bleeping", true, 6], ["darkreading", true, 6], ["krebs", true, 3]]);
  assert.equal(data.articles.length, 21);
  assert.ok(data.articles.every((a) => a.url.startsWith("https://") && a.title && a.published && a.source));
  assert.ok(data.articles.every((a) => !/[<>]/.test(a.title + a.summary)), "no markup may survive");
  assert.ok(data.articles.every((a) => !/alert\(1\)/.test(a.summary)), "script from content:encoded must never be used");
  const cisco = data.articles.find((a) => /Cisco SD-WAN/.test(a.title));
  assert.equal(cisco.published, "2026-10-29T08:24:22.000Z");               // 13:54:22 +0530
  assert.equal(cisco.source, "The Hacker News");
  assert.equal(cisco.kind, "media");
  assert.equal(data.articles[0].published >= data.articles[1].published, true);   // newest first
  const sbi = data.articles.find((a) => /State Bank of India/.test(a.title));
  assert.ok(sbi.categories.includes("breach") && sbi.categories.includes("india"));
  const entity = data.articles.find((a) => /Securing the Next 250/.test(a.title));
  assert.match(entity.title, /Securing the Next 250" & Beyond/);              // &amp; decoded once, not shown as "&amp;"
});

test("one source failing never blocks the others; failure is recorded; old articles survive", async () => {
  const old = { schema: 1, lastSuccess: "2026-10-28T00:00:00.000Z", sources: [], articles: [{ id: "k1", title: "Old Krebs story", url: "https://krebsonsecurity.com/2026/10/old/", source: "KrebsOnSecurity", sourceId: "krebs", kind: "media", published: "2026-10-27T00:00:00.000Z", summary: "", categories: [], firstSeen: "2026-10-27T01:00:00.000Z" }] };
  const thn = await fx("thn.xml");
  const fetchImpl = async (url) => (url === byId.thn.url ? ok(thn) : bad(503));
  const { data, failed } = await runIngestion({ sources: [byId.thn, byId.krebs, byId.cisa], existing: old, opts: { fetchImpl, retries: 0, backoffMs: 0 }, now: NOW });
  assert.equal(data.sources.find((s) => s.id === "thn").ok, true);
  assert.equal(data.sources.find((s) => s.id === "krebs").ok, false);
  assert.equal(data.sources.find((s) => s.id === "cisa").error, "HTTP 503");
  assert.deepEqual(failed.map((f) => f.id).sort(), ["cisa", "krebs"]);
  assert.ok(data.articles.some((a) => a.title === "Old Krebs story"), "last good articles stay visible");
  assert.equal(data.articles.filter((a) => a.sourceId === "thn").length, 6);
});

test("HTML block page / garbage instead of a feed is rejected, not displayed", async () => {
  const fetchImpl = async () => ok("<!DOCTYPE html><html><body>Access denied (bot protection)</body></html>");
  const { data, anyOk } = await runIngestion({ sources: [byId.securityweek], existing: null, opts: { fetchImpl, retries: 0 }, now: NOW });
  assert.equal(anyOk, false); assert.equal(data.articles.length, 0);
  assert.match(data.sources[0].error, /HTML/);
});

test("running the same feed twice does not create duplicates", async () => {
  const bl = await fx("bleeping.xml");
  const fetchImpl = async () => ok(bl);
  const r1 = await runIngestion({ sources: [byId.bleeping], existing: null, opts: { fetchImpl, retries: 0 }, now: NOW });
  const r2 = await runIngestion({ sources: [byId.bleeping], existing: r1.data, opts: { fetchImpl, retries: 0 }, now: NOW + 900000 });
  assert.equal(r1.data.articles.length, 6); assert.equal(r2.data.articles.length, 6);
});
