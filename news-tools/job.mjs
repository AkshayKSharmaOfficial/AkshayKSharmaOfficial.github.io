// Scheduled ingestion: sources -> fetch -> parse -> validate -> dedupe -> categorize -> store (assets/news.json + news-data.js)
import { promises as fs } from "node:fs";
import path from "node:path";
import { LIMITS, parseFeed, normalizeItem, dedupe, sortArticles, toPublic, canonicalUrl } from "./lib.mjs";

const UA = "Mozilla/5.0 (compatible; AkshayKumarSharmaSiteNewsBot/1.0; RSS reader; headlines and links only)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch with timeout, bounded retries, response size cap and https-only final URL.
export async function fetchText(url, { fetchImpl = fetch, timeoutMs = LIMITS.timeoutMs, retries = LIMITS.retries, maxBytes = LIMITS.maxBytes, headers = {}, backoffMs = 1000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { signal: ctl.signal, redirect: "follow", headers: { "user-agent": UA, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5", ...headers } });
      if (res.url && !res.url.startsWith("https://")) throw Object.assign(new Error("redirected to a non-https URL"), { fatal: true });
      if (res.status === 304) return { notModified: true, status: 304 };
      if (!res.ok) {
        const e = new Error(`HTTP ${res.status}`);
        e.retryable = res.status === 429 || res.status >= 500;
        throw e;
      }
      const len = Number(res.headers.get("content-length") || 0);
      if (len > maxBytes) throw Object.assign(new Error("response too large"), { fatal: true });
      let text = "", size = 0;
      const dec = new TextDecoder("utf-8");
      if (res.body && res.body.getReader) {
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) { try { await reader.cancel(); } catch {} throw Object.assign(new Error("response too large"), { fatal: true }); }
          text += dec.decode(value, { stream: true });
        }
        text += dec.decode();
      } else { text = await res.text(); if (text.length > maxBytes) throw Object.assign(new Error("response too large"), { fatal: true }); }
      return { text, status: res.status, etag: res.headers.get("etag") || null, lastModified: res.headers.get("last-modified") || null };
    } catch (e) {
      lastErr = e.name === "AbortError" ? Object.assign(new Error("timeout"), { retryable: true }) : e;
      if (e.cause && (e.cause.code || e.cause.message) && e.message === "fetch failed") lastErr = Object.assign(new Error(`network error (${e.cause.code || e.cause.message})`), { retryable: true });
      if (lastErr.fatal || lastErr.retryable === false) break;
      if (attempt < retries) await sleep(backoffMs * (attempt + 1));
    } finally { clearTimeout(timer); }
  }
  throw lastErr;
}

// Fetch + parse one source. Never throws: returns {ok, articles, error, ...}.
export async function ingestSource(src, prev = {}, opts = {}) {
  const now = opts.now ?? Date.now();
  const headers = {};
  if (prev.etag) headers["if-none-match"] = prev.etag;
  if (prev.lastModified) headers["if-modified-since"] = prev.lastModified;
  try {
    const r = await fetchText(src.url, { ...opts, headers });
    if (r.notModified) return { ok: true, articles: [], rejected: 0, notModified: true, etag: prev.etag, lastModified: prev.lastModified };
    const items = parseFeed(r.text).slice(0, LIMITS.perSource);
    const articles = []; let rejected = 0;
    for (const it of items) {
      const n = normalizeItem(it, src, now);
      if (n.article) articles.push(n.article); else rejected++;
    }
    return { ok: true, articles, rejected, itemsSeen: items.length, etag: r.etag, lastModified: r.lastModified };
  } catch (e) {
    return { ok: false, articles: [], error: String(e && e.message || e).slice(0, 200) };
  }
}

// Pure merge step (testable without network or files).
export async function runIngestion({ sources, existing, opts = {}, now = Date.now() }) {
  const prevData = existing && Array.isArray(existing.articles) ? existing : { articles: [], sources: [] };
  const prevSrc = Object.fromEntries((prevData.sources || []).map((s) => [s.id, s]));
  const nowIso = new Date(now).toISOString();
  const results = await Promise.all(sources.map(async (s) => [s, await ingestSource(s, prevSrc[s.id], { ...opts, now })]));

  const old = prevData.articles.filter((a) => a && typeof a.url === "string" && typeof a.title === "string");
  const firstSeen = new Map(old.map((a) => [canonicalUrl(a.url), a.firstSeen || nowIso]));
  const fresh = [];
  for (const [, r] of results) for (const a of r.articles) fresh.push({ ...a, firstSeen: firstSeen.get(a.canon) || nowIso });

  const oldWithFs = old.map((a) => ({ ...a, firstSeen: a.firstSeen || nowIso }));
  const cutoff = now - LIMITS.maxAgeDays * 86400000;
  let merged = dedupe(sortArticles([...fresh, ...oldWithFs])); // fresh entries win over stored copies
  merged = sortArticles(merged).filter((a) => (Date.parse(a.published || a.firstSeen) || now) >= cutoff).slice(0, LIMITS.maxArticles);

  const anyOk = results.some(([, r]) => r.ok);
  const report = results.map(([s, r]) => {
    const p = prevSrc[s.id] || {};
    return { id: s.id, name: s.name, ok: r.ok, count: r.articles.length, rejected: r.rejected || 0, error: r.error || null,
      checkedAt: nowIso, lastSuccess: r.ok ? nowIso : (p.lastSuccess || null), etag: r.ok ? (r.etag || null) : (p.etag || null), lastModified: r.ok ? (r.lastModified || null) : (p.lastModified || null) };
  });
  const data = {
    schema: 1,
    lastSuccess: anyOk ? nowIso : (prevData.lastSuccess || null),
    lastAttempt: nowIso,
    sources: report,
    articles: merged.map(toPublic),
  };
  return { data, anyOk, failed: report.filter((r) => !r.ok) };
}

export function toJs(data) {
  const json = JSON.stringify(data).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return `/* generated by news-tools/fetch-news.mjs - do not edit by hand */\nwindow.AKS_NEWS = ${json};\n`;
}

async function atomicWrite(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, text, "utf8");
  await fs.rename(tmp, file);
}

// Lock so two scheduled runs never overlap. A lock older than 15 minutes is treated as stale.
export async function withLock(lockFile, fn, staleMs = 15 * 60 * 1000) {
  let fh;
  try { fh = await fs.open(lockFile, "wx"); }
  catch (e) {
    if (e.code !== "EEXIST") throw e;
    const st = await fs.stat(lockFile).catch(() => null);
    if (st && Date.now() - st.mtimeMs > staleMs) { await fs.rm(lockFile, { force: true }); fh = await fs.open(lockFile, "wx"); }
    else return { skipped: true };
  }
  try { await fh.write(String(process.pid)); await fh.close(); return { skipped: false, value: await fn() }; }
  finally { await fs.rm(lockFile, { force: true }); }
}

export async function runAndStore({ sources, siteDir, opts = {}, now = Date.now(), log = console.log }) {
  const assets = path.join(siteDir, "assets");
  const jsonFile = path.join(assets, "news.json"), jsFile = path.join(assets, "news-data.js");
  let existing = null;
  try { existing = JSON.parse(await fs.readFile(jsonFile, "utf8")); } catch { existing = null; }   // corrupt/missing -> start fresh
  const { data, anyOk, failed } = await runIngestion({ sources, existing, opts, now });
  await atomicWrite(jsonFile, JSON.stringify(data, null, 1) + "\n");
  await atomicWrite(jsFile, toJs(data));
  for (const f of failed) log(`[news] source ${f.id} FAILED: ${f.error}`);
  log(`[news] ${data.articles.length} articles stored; ${data.sources.filter((s) => s.ok).length}/${data.sources.length} sources ok; lastSuccess=${data.lastSuccess}`);
  return { data, anyOk, failed };
}
