#!/usr/bin/env node
// Usage: node news-tools/diagnose.mjs
// Tests every source ONCE from THIS computer and prints the real HTTP status, content type, size, number of items
// and the first headlines. It changes no files. Send the output to whoever is helping you fix a source.
import { SOURCES } from "./sources.mjs";
import { parseFeed } from "./lib.mjs";

const UA = "Mozilla/5.0 (compatible; AkshayKumarSharmaSiteNewsBot/1.0; RSS reader; headlines and links only)";
console.log(`Node ${process.version}\n`);
for (const s of SOURCES) {
  const t0 = Date.now();
  try {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(s.url, { signal: ctl.signal, redirect: "follow", headers: { "user-agent": UA, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5" } });
    const body = await r.text(); clearTimeout(timer);
    let info;
    try { const items = parseFeed(body); info = `items=${items.length}` + (items[0] ? ` | first: "${items[0].title.replace(/<!\[CDATA\[|\]\]>/g, "").trim().slice(0, 80)}"` : ""); }
    catch (e) { info = `NOT A FEED (${e.message}); starts with: ${JSON.stringify(body.slice(0, 80))}`; }
    console.log(`${r.ok && !/NOT A FEED/.test(info) ? "OK    " : "PROBLEM"} ${s.id.padEnd(14)} HTTP ${r.status} ${r.headers.get("content-type") || "?"} ${body.length}B ${Date.now() - t0}ms\n        final URL: ${r.url}\n        ${info}`);
  } catch (e) {
    console.log(`FAILED  ${s.id.padEnd(14)} ${e.name === "AbortError" ? "timeout after 15s" : e.message}${e.cause ? " (" + (e.cause.code || e.cause.message) + ")" : ""}`);
  }
}
