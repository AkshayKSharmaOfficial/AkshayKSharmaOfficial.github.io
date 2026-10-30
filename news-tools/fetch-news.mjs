#!/usr/bin/env node
// Usage: node news-tools/fetch-news.mjs [--site ./akshay-website]
// Exit code 0 when at least one source worked (or nothing changed), 1 when ALL sources failed, 2 on internal error.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES } from "./sources.mjs";
import { runAndStore, withLock } from "./job.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf("--site");
const siteDir = path.resolve(i > -1 ? process.argv[i + 1] : path.join(here, ".."));
const lock = path.join(here, ".news.lock");

try {
  const r = await withLock(lock, () => runAndStore({ sources: SOURCES, siteDir }));
  if (r.skipped) { console.log("[news] another run is in progress - skipping"); process.exit(0); }
  process.exit(r.value.anyOk ? 0 : 1);
} catch (e) {
  console.error("[news] internal error:", e && e.message);
  process.exit(2);
}
