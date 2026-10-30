// Zero-dependency helpers for the news job. All external content is treated as untrusted text.
import { createHash } from "node:crypto";

export const LIMITS = { maxArticles: 200, maxAgeDays: 90, maxBytes: 2 * 1024 * 1024, timeoutMs: 15000, retries: 2, perSource: 40, summaryChars: 280, titleChars: 220 };

export const CATEGORY_IDS = ["attack", "breach", "ransomware", "vuln", "malware", "phishing", "ai", "advisory", "india"];

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©" };
export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(code) || code < 32 && ![9, 10, 13].includes(code) || code > 0x10ffff) return "";
      try { return String.fromCodePoint(code); } catch { return ""; }
    }
    const v = NAMED[e.toLowerCase()];
    return v === undefined ? m : v;
  });
}

// Reduce arbitrary feed text to plain, single-line text. Tags are removed, never executed or kept.
export function cleanText(raw, max) {
  if (raw == null) return "";
  let s = String(raw);
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ");
  s = decodeEntities(s);                       // feeds often double-encode HTML
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<[^>]*>/g, " ");
  s = decodeEntities(s).replace(/[<>]/g, " ");
  s = s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (max && s.length > max) {
    const cut = s.slice(0, max - 1);
    const sp = cut.lastIndexOf(" ");
    s = (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-–—]+$/, "") + "…";
  }
  return s;
}

export function isSafeHttpUrl(u) {
  if (typeof u !== "string" || u.length > 2048) return false;
  let p;
  try { p = new URL(u.trim()); } catch { return false; }
  if (p.protocol !== "https:") return false;            // https only
  if (p.username || p.password) return false;
  if (!p.hostname.includes(".") || /^\d+\.\d+\.\d+\.\d+$/.test(p.hostname) || p.hostname === "localhost") return false;
  return true;
}

const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|cmpid$|ocid$|spm$)/i;
export function canonicalUrl(u) {
  const p = new URL(u.trim());
  p.hash = "";
  p.hostname = p.hostname.toLowerCase().replace(/^www\./, "");
  if (p.port === "443") p.port = "";
  for (const k of [...p.searchParams.keys()]) if (TRACKING.test(k)) p.searchParams.delete(k);
  p.searchParams.sort();
  if (p.pathname.length > 1) p.pathname = p.pathname.replace(/\/+$/, "");
  return p.toString();
}
export function normTitle(t) {
  return String(t).toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

// Returns ISO string (UTC) or null when the date is missing, unparsable, or implausible.
export function parseDate(raw, now = Date.now()) {
  if (!raw) return null;
  const s = cleanText(raw).replace(/\s+(UT|GMT)$/i, " GMT");
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  if (t > now + 24 * 3600 * 1000) return null;          // future dates are not reliable
  if (t < Date.UTC(2000, 0, 1)) return null;
  return new Date(t).toISOString();
}

function tag(block, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i");
  const m = block.match(re);
  return m ? m[1] : "";
}

// Parses RSS 2.0, RSS 1.0 (RDF) and Atom. Throws if the document is not a feed.
export function parseFeed(xml) {
  if (typeof xml !== "string" || !xml.trim()) throw new Error("empty response");
  const head = xml.slice(0, 4000);
  if (/^\s*<!doctype\s+html|<html[\s>]/i.test(head)) throw new Error("response is HTML, not a feed");
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(xml)) throw new Error("not an RSS/Atom feed");
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  const items = [];
  for (const b of blocks) {
    let link = "";
    const alt = b.match(/<link\b[^>]*\brel=["']alternate["'][^>]*>/i) || b.match(/<link\b[^>]*\bhref=["'][^"']+["'][^>]*>/i);
    if (alt) { const h = alt[0].match(/href=["']([^"']+)["']/i); if (h) link = decodeEntities(h[1]); }
    if (!link) link = cleanText(tag(b, "link")) || cleanText(tag(b, "guid"));
    items.push({
      title: tag(b, "title"),
      link,
      date: tag(b, "pubDate") || tag(b, "dc:date") || tag(b, "published") || tag(b, "updated"),
      summary: tag(b, "description") || tag(b, "summary") || tag(b, "content:encoded") || tag(b, "content"),
    });
  }
  return items;
}

const RULES = {
  attack: /\b(cyber ?attacks?|attack(s|ed|ers?)?|hack(ed|ers?|ing)?|compromis\w+|intrusions?|ddos|espionage|supply[- ]chain|hijack\w*|takeover|extort\w*|sabotage|seiz(ed|ure)s?)\b/i,
  breach: /\b(data breach\w*|data leak\w*|leaked|breach(ed|es)?|exposed (database|data)|personal data|stolen data|data theft|exfiltrat\w+|pii|privacy)\b/i,
  ransomware: /\b(ransomware|ransom|extortion gang|lockbit|blackcat|alphv|cl0p|clop|akira|black basta|shinyhunters|the gentlemen)\b/i,
  vuln: /\b(cve-\d{4}-\d+|vulnerabilit\w+|zero-?days?|0-?days?|rce|remote code execution|flaws?|security (update|patch)es?|patch(es|ed)?|exploit(ed|s|ation)?|privilege escalation|known exploited)\b/i,
  malware: /\b(malware|trojan|spyware|botnet|infostealer|stealer|backdoor|bootkit|rootkit|worm|loader|keylogger|malicious (app|apk|extension|package)|apk)\b/i,
  phishing: /\b(phishing|smishing|vishing|clickfix|social engineering|scams?|fake (login|website|site|app)|credential (harvest\w*|theft)|business email compromise|bec|digital arrest|upi|otp|sextortion|fraud\w*)\b/i,
  ai: /\b(ai|a\.i\.|artificial intelligence|generative ai|llm|prompt injection|deepfakes?|deep fake|voice clon\w*|ai[- ]generated|ai[- ]powered|ai agents?|agentic|chatgpt|openai|anthropic|claude|gemini|copilot)\b/i,
  india: /\b(india|indian|cert-in|i4c|1930|cybercrime\.gov\.in|rbi|npci|emudhra|delhi|mumbai|bengaluru|bangalore|hyderabad|chennai|kolkata|pune|jaipur|rajasthan|uttar pradesh|maharashtra|gujarat|state bank of india|sbi)\b/i,
};

// An article can belong to several categories. The first one is the primary label shown on the card.
// Order = from the most specific label to the most general one. Articles that match nothing appear only under "All".
export function categorize(a, source) {
  const text = `${a.title} ${a.summary}`;
  const cats = [];
  if (source.kind === "official") cats.push("advisory");
  for (const id of ["ransomware", "breach", "vuln", "malware", "phishing", "ai", "attack"]) if (RULES[id].test(text)) cats.push(id);
  if (source.region === "india" || RULES.india.test(text)) cats.push("india");
  return [...new Set(cats)];
}

export function makeId(canon) { return createHash("sha256").update(canon).digest("hex").slice(0, 16); }

// Convert a parsed raw item into a validated article, or null (with a reason) when it must be rejected.
export function normalizeItem(raw, source, now = Date.now()) {
  const title = cleanText(raw.title, LIMITS.titleChars);
  if (!title) return { reject: "missing title" };
  const link = (raw.link || "").trim();
  if (!isSafeHttpUrl(link)) return { reject: "invalid or non-https url" };
  const summary = cleanText(raw.summary, LIMITS.summaryChars);
  const a = { title, summary: summary === title ? "" : summary };
  if (source.filter && !source.filter.test(`${title} ${summary}`)) return { reject: "not cyber related" };
  const canon = canonicalUrl(link);
  return {
    article: {
      id: makeId(canon), title, url: link, canon, summary: a.summary,
      source: source.publisher, sourceId: source.id, kind: source.kind,
      published: parseDate(raw.date, now), categories: categorize(a, source),
    },
  };
}

// Dedupe by canonical URL, then by normalized title. The first (richest/oldest-known) entry wins.
export function dedupe(list) {
  const byUrl = new Map(), byTitle = new Set(), out = [];
  for (const a of list) {
    const ck = a.canon || canonicalUrl(a.url), tk = normTitle(a.title);
    if (byUrl.has(ck) || (tk && byTitle.has(tk))) continue;
    byUrl.set(ck, true); if (tk) byTitle.add(tk); out.push(a);
  }
  return out;
}

export function sortArticles(list) {
  const key = (a) => Date.parse(a.published || a.firstSeen || 0) || 0;
  return [...list].sort((x, y) => key(y) - key(x));
}

export function toPublic(a) {
  const { canon, ...rest } = a;
  return rest;
}
