/* Latest Cyber Crime News - client side. Reads window.AKS_NEWS (assets/news-data.js) and, on http(s), a fresher assets/news.json.
   All article text is inserted with textContent only (never innerHTML). Failures stay inside the news block. */
(function () {
  "use strict";

  var CATS = [
    { id: "all", en: "Latest Cyber Security News", hi: "ताज़ा साइबर सुरक्षा समाचार" },
    { id: "attack", en: "Cyber Attacks", hi: "साइबर हमले" },
    { id: "breach", en: "Data Breaches", hi: "डेटा ब्रीच" },
    { id: "ransomware", en: "Ransomware", hi: "रैनसमवेयर" },
    { id: "vuln", en: "Vulnerabilities", hi: "सुरक्षा कमज़ोरियाँ" },
    { id: "malware", en: "Malware", hi: "मैलवेयर" },
    { id: "phishing", en: "Phishing", hi: "फ़िशिंग" },
    { id: "ai", en: "AI Security", hi: "एआई सुरक्षा" },
    { id: "advisory", en: "Government Advisories", hi: "सरकारी एडवाइज़री" },
    { id: "india", en: "Indian Cybersecurity News", hi: "भारतीय साइबर सुरक्षा समाचार" }
  ];
  var PAGE = 9, HOME_COUNT = 6, STALE_MS = 6 * 3600 * 1000, REFRESH_MS = 5 * 60 * 1000;

  /* ---------- pure helpers (also exported for tests when loaded under Node) ---------- */
  function isSafeUrl(u) {
    if (typeof u !== "string" || u.length > 2048) return false;
    try { var p = new URL(u); return p.protocol === "https:" && !p.username && !p.password; } catch (e) { return false; }
  }
  function validArticle(a) {
    return !!a && typeof a === "object" && typeof a.title === "string" && a.title.trim() !== "" && isSafeUrl(a.url);
  }
  function normalize(data) {
    if (!data || typeof data !== "object" || !Array.isArray(data.articles)) return null;
    return {
      lastSuccess: typeof data.lastSuccess === "string" ? data.lastSuccess : null,
      lastAttempt: typeof data.lastAttempt === "string" ? data.lastAttempt : null,
      articles: data.articles.filter(validArticle),
      sources: Array.isArray(data.sources) ? data.sources.filter(function (x) { return x && typeof x === "object" && typeof x.name === "string"; }).map(function (x) {
        return { id: String(x.id || ""), name: x.name.slice(0, 80), ok: x.ok === true, lastSuccess: typeof x.lastSuccess === "string" ? x.lastSuccess : null };
      }) : []
    };
  }
  function filterArticles(list, cat, q) {
    var toks = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
    return list.filter(function (a) {
      if (cat && cat !== "all" && (!Array.isArray(a.categories) || a.categories.indexOf(cat) < 0)) return false;
      if (!toks.length) return true;
      var hay = (a.title + " " + (a.summary || "") + " " + (a.source || "")).toLowerCase();
      return toks.every(function (t) { return hay.indexOf(t) >= 0; });
    });
  }
  function failedSources(d) {
    if (!d || !Array.isArray(d.sources)) return [];
    return d.sources.filter(function (x) { return x && x.ok === false; });
  }
  function catLabel(id) { for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i]; return null; }
  function fmtDate(iso, lang, withTime) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try {
      var o = withTime ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" };
      return d.toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", o);
    } catch (e) { return d.toISOString().slice(0, 10); }
  }

  if (typeof module !== "undefined" && module.exports) { module.exports = { failedSources: failedSources, isSafeUrl: isSafeUrl, validArticle: validArticle, normalize: normalize, filterArticles: filterArticles, fmtDate: fmtDate, CATS: CATS }; return; }
  if (typeof document === "undefined") return;

  /* ---------- DOM ---------- */
  var root = document.querySelector("[data-aksnews]");
  if (!root) return;
  var mode = root.getAttribute("data-aksnews"); // "page" | "home"
  var listEl = root.querySelector("[data-news-list]"), statusEl = root.querySelector("[data-news-status]");
  var updatedEl = root.querySelector("[data-news-updated]"), moreBtn = root.querySelector("[data-news-more]");
  var countEl = root.querySelector("[data-news-count]"), qEl = root.querySelector("[data-news-q]"), chipsEl = root.querySelector("[data-news-chips]");
  var state = { data: null, cat: "all", q: "", shown: PAGE };
  var noticeEl = null;
  if (mode === "page" && statusEl && statusEl.parentNode) {          // created here so the HTML needs no change
    noticeEl = document.createElement("p"); noticeEl.className = "aksnews-status aksnews-stale-note"; noticeEl.hidden = true; noticeEl.setAttribute("role", "status");
    statusEl.parentNode.insertBefore(noticeEl, statusEl);
  }

  function lang() { try { return localStorage.getItem("aks-lang") || "en"; } catch (e) { return "en"; } }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function bi(tag, cls, en, hi) {
    var l = lang(), w = el(tag, cls);
    var a = el("span", null, en); a.setAttribute("data-l", "en"); a.hidden = l !== "en";
    var b = el("span", null, hi); b.setAttribute("data-l", "hi"); b.setAttribute("lang", "hi"); b.hidden = l !== "hi";
    w.appendChild(a); w.appendChild(b); return w;
  }
  function setStatus(kind, en, hi) {            // kind: loading | error | empty | none
    statusEl.textContent = "";
    statusEl.className = "aksnews-status aksnews-" + kind;
    statusEl.hidden = false;
    if (kind === "loading") statusEl.appendChild(el("span", "aksnews-spinner"));
    statusEl.appendChild(bi("span", null, en, hi));
    statusEl.setAttribute("role", kind === "error" ? "alert" : "status");
  }
  function clearStatus() { statusEl.hidden = true; statusEl.textContent = ""; }

  function card(a) {
    var l = lang(), c = el("article", "card aksnews-card");
    var tags = el("div", "pill-row");
    var primary = a.categories && a.categories[0] ? catLabel(a.categories[0]) : null;
    if (primary) tags.appendChild(bi("span", "pill", primary.en, primary.hi));
    if (a.kind === "official") tags.appendChild(bi("span", "pill pill-cyan", "Official Advisory", "आधिकारिक एडवाइज़री"));
    else tags.appendChild(bi("span", "pill pill-blue", "Media Report", "मीडिया रिपोर्ट"));
    c.appendChild(tags);
    c.appendChild(el("h3", "aksnews-title", a.title));
    var meta = el("p", "aksnews-meta");
    if (a.source) meta.appendChild(el("span", "aksnews-src", a.source));
    var ds = fmtDate(a.published, l, false);
    if (ds) { if (a.source) meta.appendChild(document.createTextNode(" · ")); var t = el("time", null, ds); t.setAttribute("datetime", a.published); meta.appendChild(t); }
    c.appendChild(meta);
    if (a.summary) c.appendChild(el("p", "aksnews-summary", a.summary));
    var foot = el("div", "aksnews-foot");
    var link = el("a", "btn btn-outline btn-sm");
    link.href = a.url; link.target = "_blank"; link.rel = "noopener noreferrer nofollow";
    link.appendChild(bi("span", null, "Read Original Source", "मूल स्रोत पढ़ें"));
    var sr = bi("span", "sr-only", " (opens in a new tab)", " (नए टैब में खुलता है)"); link.appendChild(sr);
    foot.appendChild(link); c.appendChild(foot);
    return c;
  }

  function renderUpdated() {
    if (!updatedEl) return;
    updatedEl.textContent = "";
    var d = state.data, l = lang();
    if (!d || !d.lastSuccess) { updatedEl.appendChild(bi("span", null, "Last updated: no successful update yet", "आख़िरी अपडेट: अभी तक कोई सफल अपडेट नहीं")); return; }
    var en = "Last updated: " + fmtDate(d.lastSuccess, "en", true), hi = "आख़िरी अपडेट: " + fmtDate(d.lastSuccess, "hi", true);
    var t = el("time"); t.setAttribute("datetime", d.lastSuccess); t.appendChild(bi("span", null, en, hi)); updatedEl.appendChild(t);
    if (Date.now() - Date.parse(d.lastSuccess) > STALE_MS) updatedEl.appendChild(bi("span", "aksnews-stale", " · may be outdated", " · जानकारी पुरानी हो सकती है"));
    void l;
  }

  function renderSourceNotice() {
    if (!noticeEl) return;
    noticeEl.textContent = "";
    if (location.protocol === "file:") {          // opened by double-clicking index.html: no server, so no automatic updates
      noticeEl.appendChild(bi("span", null, "You opened this page as a file, so it cannot fetch new articles by itself. Start START-NEWS.bat (or npm start) and open http://localhost:8080/cyber-news/ to get the latest news automatically.", "आपने यह पेज फ़ाइल की तरह खोला है, इसलिए यह खुद नई खबरें नहीं ला सकता। ताज़ा खबरें अपने आप पाने के लिए START-NEWS.bat (या npm start) चलाएँ और http://localhost:8080/cyber-news/ खोलें।"));
      noticeEl.hidden = false; return;
    }
    var bad = failedSources(state.data);
    if (!bad.length || !state.data || !state.data.articles.length) { noticeEl.hidden = true; return; }
    var names = bad.map(function (x) { return x.name; }).join(", ");
    noticeEl.appendChild(bi("span", null, "Some sources are temporarily unavailable (" + names + "). Showing the latest articles that were fetched successfully.", "कुछ स्रोत अभी उपलब्ध नहीं हैं (" + names + ")। सफलतापूर्वक जुटाए गए ताज़ा लेख दिखाए जा रहे हैं।"));
    noticeEl.hidden = false;
  }

  function render() {
    renderUpdated();
    renderSourceNotice();
    var d = state.data;
    listEl.textContent = "";
    if (!d) return;
    if (!d.articles.length) { if (d.lastAttempt && !d.lastSuccess) setStatus("error", "The last update attempt failed: no news source could be reached. Check the terminal where news-tools/serve.mjs is running.", "पिछला अपडेट प्रयास विफल रहा: कोई समाचार स्रोत नहीं खुल सका। जिस टर्मिनल में news-tools/serve.mjs चल रहा है उसे देखें।"); else setStatus("empty", "No news has been collected yet. The first automatic update is still pending.", "अभी कोई समाचार एकत्र नहीं हुआ है। पहला स्वचालित अपडेट बाकी है।"); if (moreBtn) moreBtn.hidden = true; if (countEl) countEl.textContent = ""; return; }
    var res = filterArticles(d.articles, state.cat, state.q);
    var limit = mode === "home" ? HOME_COUNT : state.shown;
    if (!res.length) { setStatus("none", "No articles match your search or category.", "आपकी खोज या श्रेणी से कोई लेख मेल नहीं खाता।"); if (moreBtn) moreBtn.hidden = true; if (countEl) countEl.textContent = ""; return; }
    clearStatus();
    var frag = document.createDocumentFragment();
    res.slice(0, limit).forEach(function (a) { frag.appendChild(card(a)); });
    listEl.appendChild(frag);
    if (countEl) { countEl.textContent = ""; countEl.appendChild(bi("span", null, "Showing " + Math.min(limit, res.length) + " of " + res.length, "दिखा रहे हैं " + Math.min(limit, res.length) + " / " + res.length)); }
    if (moreBtn) moreBtn.hidden = !(mode !== "home" && res.length > limit);
  }

  function buildChips() {
    if (!chipsEl) return;
    CATS.forEach(function (c) {
      var b = el("button", "chip"); b.type = "button"; b.setAttribute("data-cat", c.id); b.setAttribute("aria-pressed", c.id === "all" ? "true" : "false");
      b.appendChild(bi("span", null, c.en, c.hi));
      b.addEventListener("click", function () {
        state.cat = c.id; state.shown = PAGE;
        chipsEl.querySelectorAll(".chip").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        render();
      });
      chipsEl.appendChild(b);
    });
  }

  function fetchJson(url) {
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
    return fetch(url, { cache: "no-cache", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error("http"); return r.json(); })
      .then(function (j) { clearTimeout(timer); var n = normalize(j); if (!n) throw new Error("bad"); return n; },
            function (e) { clearTimeout(timer); throw e; });
  }
  function adopt(n) {                                   // keep whichever data is newer
    if (n && (!state.data || (n.lastSuccess || "") >= (state.data.lastSuccess || ""))) state.data = n;
  }
  // Order: 1) /api/news (live backend)  2) assets/news.json (static host)  3) data embedded in the page.
  function refresh(silent) {
    var api = root.getAttribute("data-api"), url = root.getAttribute("data-json");
    var canFetch = /^https?:$/.test(location.protocol) && typeof fetch === "function";
    if (!canFetch) return Promise.resolve();
    var p = api ? fetchJson(api).catch(function () { return url ? fetchJson(url) : null; }) : (url ? fetchJson(url) : Promise.resolve(null));
    return p.then(adopt, function () { /* keep what we already show */ });
  }
  function load() {
    setStatus("loading", "Loading latest news…", "ताज़ा समाचार लोड हो रहे हैं…");
    state.data = normalize(window.AKS_NEWS);
    function finish() {
      if (!state.data) { setStatus("error", "The news feed could not be loaded right now. Please try again later.", "समाचार फ़ीड अभी लोड नहीं हो सकी। कृपया बाद में पुनः प्रयास करें।"); renderUpdated(); return; }
      render();
    }
    refresh().then(finish);
    // Automatic refresh without reloading the page (only while the tab is visible).
    if (/^https?:$/.test(location.protocol)) setInterval(function () {
      if (document.hidden) return;
      refresh().then(function () { if (state.data) render(); });
    }, REFRESH_MS);
  }

  if (qEl) {
    var timer;
    qEl.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { state.q = qEl.value; state.shown = PAGE; render(); }, 150); });
    var form = qEl.form; if (form) form.addEventListener("submit", function (e) { e.preventDefault(); });
  }
  if (moreBtn) moreBtn.addEventListener("click", function () { state.shown += PAGE; render(); });
  document.querySelectorAll(".lang-toggle button").forEach(function (b) { b.addEventListener("click", function () { setTimeout(function () { if (state.data) render(); }, 0); }); });

  try { buildChips(); load(); }
  catch (e) { try { setStatus("error", "The news feed could not be displayed.", "समाचार फ़ीड नहीं दिखाई जा सकी।"); } catch (e2) {} }
})();
