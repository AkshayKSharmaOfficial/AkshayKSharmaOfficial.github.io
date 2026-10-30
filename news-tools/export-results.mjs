#!/usr/bin/env node
// Usage: node news-tools/export-results.mjs   (or: npm run export-results)
// Writes data/quiz-results.csv from data/quiz-results.jsonl so you can open it in Excel.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { csvCell } from "./quiz-api.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(here, "..", ".env")); } catch { /* optional */ }
const dir = path.resolve(process.env.QUIZ_DATA_DIR || path.join(here, "..", "data"));
let text = ""; try { text = await fs.readFile(path.join(dir, "quiz-results.jsonl"), "utf8"); } catch { console.log("No results yet (" + dir + ")"); process.exit(0); }
const rows = [["Time (UTC)", "Certificate ID", "Name", "Mobile", "Quiz", "Score", "Out of", "Result"]];
for (const l of text.split("\n")) { if (!l.trim()) continue; try { const r = JSON.parse(l); rows.push([r.at, r.id || "", r.name, r.phone, r.quizTitle, r.score, r.total, r.passed ? "PASSED" : "not passed"]); } catch {} }
const out = path.join(dir, "quiz-results.csv");
await fs.writeFile(out, "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n", { mode: 0o600 });
console.log(`${rows.length - 1} results written to ${out}`);
