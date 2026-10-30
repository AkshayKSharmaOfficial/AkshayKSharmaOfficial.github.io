#!/usr/bin/env node
// One-time, idempotent patch that adds the "Cyber News" feature to an already built site folder.
// Usage: node news-tools/apply-site-patch.mjs ./akshay-website
// It only: adds one nav item, one homepage section (+ 1 css link + 2 script tags), one new page, and one sitemap entry.
import { promises as fs } from "node:fs";
import path from "node:path";

const site = path.resolve(process.argv[2] || ".");
const MARK = "<!-- aksnews -->";

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "assets") out.push(...await walk(p)); } else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const SEARCH_ICON = '<svg class="icon " viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
const ARROW = '<svg class="icon " viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
const bi = (en, hi) => `<span data-l="en">${en}</span><span data-l="hi" lang="hi" hidden>${hi}</span>`;

function listBlock(mode, jsonPath) {
  return `<div class="aksnews" data-aksnews="${mode}" data-json="${jsonPath}">
  <div class="aksnews-status aksnews-loading" data-news-status role="status"><span class="aksnews-spinner"></span>${bi("Loading latest news…", "ताज़ा समाचार लोड हो रहे हैं…")}</div>
  <noscript><p class="aksnews-status aksnews-error">${bi("JavaScript is needed to show the news list.", "समाचार सूची दिखाने के लिए JavaScript ज़रूरी है।")}</p></noscript>`;
}

function homeSection(prefix) {
  return `${MARK}
<section class="section" id="cyber-news">
  <div class="container">
    <div class="section-head">
      <div>
        <span class="eyebrow">// ${bi("news", "समाचार")}</span>
        <h2>${bi("Latest Cyber Crime News", "ताज़ा साइबर अपराध समाचार")}</h2>
        <p>${bi("Headlines collected automatically from official advisories and reputable publishers. Always read the original source.", "आधिकारिक एडवाइज़री और भरोसेमंद प्रकाशकों से अपने-आप जुटाई गई ख़बरें। हमेशा मूल स्रोत पढ़ें।")}</p>
      </div>
    </div>
    ${listBlock("home", prefix + "assets/news.json")}
    <p class="aksnews-updated" data-news-updated></p>
    <div class="aksnews-grid" data-news-list></div>
    <p class="aksnews-home-foot"><a class="btn btn-primary" href="${prefix}cyber-news/index.html">${bi("View all cyber news", "सभी साइबर समाचार देखें")} ${ARROW}</a></p>
    </div>
  </div>
</section>

`;
}

function newsMain() {
  return `<main id="main" tabindex="-1">

<section class="page-header">
  <div class="container">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="../index.html">Home</a></li><li><span aria-current="page">Cyber News</span></li></ol></nav>
    <h1>${bi("Latest Cyber Crime News", "ताज़ा साइबर अपराध समाचार")}</h1>
    <p>${bi("Real cyber crime, fraud and security news collected automatically from official advisories and reputable publishers, with a link to every original source.", "आधिकारिक एडवाइज़री और भरोसेमंद प्रकाशकों से अपने-आप जुटाई गई असली साइबर अपराध, ठगी और सुरक्षा समाचार, हर ख़बर के मूल स्रोत के लिंक के साथ।")}</p>
    <div class="s27"><div class="lang-toggle" role="group" aria-label="Language / भाषा">
  <button type="button" data-lang="en" aria-pressed="true">English</button>
  <button type="button" data-lang="hi" aria-pressed="false" lang="hi">हिन्दी</button>
</div></div>
  </div>
</section>
<div class="section"><div class="container">
  <div class="notice"><svg class="icon " viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg><p>${bi("Only the headline, a short excerpt, the date and the publisher are shown. The full article is always on the publisher&#39;s website. Items marked &quot;Media Report&quot; are news reports; only items marked &quot;Official Advisory&quot; come from a government or issuing agency. These articles are not written or verified by this website. If you are a victim of cyber fraud, call 1930 or report at cybercrime.gov.in.", "यहाँ केवल शीर्षक, छोटा अंश, तारीख़ और प्रकाशक दिखाए जाते हैं। पूरा लेख हमेशा प्रकाशक की वेबसाइट पर है। &quot;मीडिया रिपोर्ट&quot; वाले आइटम समाचार हैं; केवल &quot;आधिकारिक एडवाइज़री&quot; वाले आइटम सरकारी या जारीकर्ता एजेंसी से हैं। ये लेख इस वेबसाइट द्वारा लिखे या सत्यापित नहीं हैं। साइबर ठगी होने पर 1930 पर कॉल करें या cybercrime.gov.in पर रिपोर्ट करें।")}</p></div>
  <div class="aksnews aksnews-langbox" data-aksnews="page" data-json="../assets/news.json">
    <div class="aksnews-bar">
      <form class="search" role="search">${SEARCH_ICON}<label class="sr-only" for="news-q">${bi("Search news", "समाचार खोजें")}</label><input id="news-q" type="search" data-news-q placeholder="Search news / समाचार खोजें" autocomplete="off" maxlength="80"></form>
      <p class="aksnews-updated" data-news-updated></p>
    </div>
    <div class="chips" data-news-chips role="group" aria-label="Category / श्रेणी"></div>
    <div class="aksnews-status aksnews-loading" data-news-status role="status"><span class="aksnews-spinner"></span>${bi("Loading latest news…", "ताज़ा समाचार लोड हो रहे हैं…")}</div>
    <noscript><p class="aksnews-status aksnews-error">${bi("JavaScript is needed to show the news list.", "समाचार सूची दिखाने के लिए JavaScript ज़रूरी है।")}</p></noscript>
    <div class="aksnews-grid" data-news-list></div>
    <p class="aksnews-count" data-news-count aria-live="polite"></p>
    <div class="aksnews-more"><button type="button" class="btn btn-outline" data-news-more hidden>${bi("Load more", "और दिखाएँ")}</button></div>
  </div>
</div></div>
</main>`;
}

async function main() {
  const pages = await walk(site);
  let navCount = 0;
  for (const f of pages) {
    let h = await fs.readFile(f, "utf8");
    let changed = false;
    if (!h.includes('cyber-news/index.html"')) {
      const re = /(<li><a class="nav-link" href=")((?:\.\.?\/)+)blog\/index\.html("[^>]*>[\s\S]*?<\/a><\/li>)/;
      const m = h.match(re);
      if (m) {
        const li = `<li><a class="nav-link" href="${m[2]}cyber-news/index.html">${bi("Cyber News", "साइबर समाचार")}</a></li>`;
        h = h.replace(re, (all) => all + li); changed = true; navCount++;
      }
    }
    const rel = path.relative(site, f);
    if (rel === "index.html" && !h.includes(MARK)) {
      h = h.replace('<section class="section alt" id="co-head">', homeSection("./") + '<section class="section alt" id="co-head">');
      h = h.replace('<link rel="stylesheet" href="./assets/inline.css">', '<link rel="stylesheet" href="./assets/inline.css">\n<link rel="stylesheet" href="./assets/news.css">');
      h = h.replace('<script src="./assets/app.js" defer></script>', '<script src="./assets/news-data.js" defer></script>\n<script src="./assets/news.js" defer></script>\n<script src="./assets/app.js" defer></script>');
      changed = true;
    }
    if (changed) await fs.writeFile(f, h, "utf8");
  }

  // dedicated page, built from the Quiz page shell so header/footer/theme switch are identical
  let q = await fs.readFile(path.join(site, "quiz", "index.html"), "utf8");
  q = q.replace(/<title>[\s\S]*?<\/title>/, "<title>Latest Cyber Crime News | Akshay Kumar Sharma</title>");
  const desc = "Latest cyber crime, online fraud and cyber security news collected automatically from official advisories and reputable publishers, with links to the original sources.";
  q = q.replace(/(<meta name="description" content=")[^"]*"/, `$1${desc}"`).replace(/(<meta property="og:description" content=")[^"]*"/, `$1${desc}"`).replace(/(<meta name="twitter:description" content=")[^"]*"/, `$1${desc}"`);
  q = q.replace(/Cyber Awareness Quiz and Certificate \| Akshay Kumar Sharma/g, "Latest Cyber Crime News | Akshay Kumar Sharma");
  q = q.replace(/https:\/\/www\.example\.com\/quiz\//g, "https://www.example.com/cyber-news/").replace(/"name":"Quiz"/, '"name":"Cyber News"');
  q = q.replace(/(<a class="nav-link" href="\.\.\/quiz\/index\.html") aria-current="page"/, "$1");
  q = q.replace(/(<a class="nav-link" href="\.\.\/cyber-news\/index\.html")/, '$1 aria-current="page"');
  q = q.replace(/<main id="main"[\s\S]*<\/main>/, newsMain());
  q = q.replace('<link rel="stylesheet" href="../assets/inline.css">', '<link rel="stylesheet" href="../assets/inline.css">\n<link rel="stylesheet" href="../assets/news.css">');
  q = q.replace(/<script src="\.\.\/assets\/(quiz-data|quiz|signatures)\.js"[^>]*><\/script>\n?/g, "");
  q = q.replace('<script src="../assets/app.js" defer></script>', '<script src="../assets/news-data.js" defer></script>\n<script src="../assets/news.js" defer></script>\n<script src="../assets/app.js" defer></script>');
  await fs.mkdir(path.join(site, "cyber-news"), { recursive: true });
  await fs.writeFile(path.join(site, "cyber-news", "index.html"), q, "utf8");

  const sm = path.join(site, "sitemap.xml");
  let s = await fs.readFile(sm, "utf8");
  if (!s.includes("/cyber-news/")) { s = s.replace(/(\s*<url><loc>https:\/\/www\.example\.com\/quiz\/<\/loc><\/url>)/, "$1\n  <url><loc>https://www.example.com/cyber-news/</loc></url>"); await fs.writeFile(sm, s, "utf8"); }
  console.log(`nav item added to ${navCount} pages; home section, cyber-news page and sitemap entry written`);
}
main().catch((e) => { console.error(e); process.exit(1); });
