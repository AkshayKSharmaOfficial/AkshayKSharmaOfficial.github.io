/* Site search: runs in the browser over assets/search-index.js (generated at build time). */
(function () {
  "use strict";
  var DATA = window.AKS_SEARCH, root = document.getElementById("search-root");
  if (!DATA || !root) return;
  var form = document.getElementById("site-search-form"), input = document.getElementById("site-q");
  var list = document.getElementById("search-results"), count = document.getElementById("search-count"), none = document.getElementById("search-none");

  function lang() { try { return localStorage.getItem("aks-lang") || "en"; } catch (e) { return "en"; } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function bi(p) { var l = lang(); return '<span data-l="en"' + (l === "en" ? "" : " hidden") + ">" + esc(p[0]) + '</span><span data-l="hi" lang="hi"' + (l === "hi" ? "" : " hidden") + ">" + esc(p[1]) + "</span>"; }

  /* groups of words that mean the same thing (English and Hindi) */
  var SYN = [
    ["fraud", "scam", "cheating", "ठगी", "धोखाधड़ी", "फ्रॉड", "स्कैम"],
    ["phishing", "fake website", "fake link", "फ़िशिंग", "फिशिंग", "नकली वेबसाइट"],
    ["upi", "payment", "qr", "paytm", "phonepe", "gpay", "पेमेंट", "यूपीआई"],
    ["otp", "pin", "ओटीपी", "पिन"],
    ["password", "passwords", "पासवर्ड", "login", "account"],
    ["deepfake", "ai", "voice clone", "डीपफ़ेक", "एआई"],
    ["job", "investment", "task", "नौकरी", "निवेश"],
    ["malware", "virus", "apk", "ransomware", "मैलवेयर", "वायरस"],
    ["privacy", "footprint", "data", "प्राइवेसी", "गोपनीयता"],
    ["social media", "instagram", "facebook", "whatsapp", "सोशल मीडिया"],
    ["student", "children", "kids", "family", "विद्यार्थी", "बच्चे", "परिवार"],
    ["report", "complaint", "helpline", "1930", "रिपोर्ट", "शिकायत", "हेल्पलाइन"],
    ["digital arrest", "police", "video call", "डिजिटल अरेस्ट", "पुलिस"]
  ];
  function expand(tok) {
    var out = [tok];
    SYN.forEach(function (g) { if (g.some(function (w) { return w === tok || (tok.length > 3 && w.indexOf(tok) === 0); })) g.forEach(function (w) { if (out.indexOf(w) < 0) out.push(w); }); });
    return out;
  }
  var prepared = DATA.map(function (it) {
    return { it: it, title: (it.t[0] + " " + it.t[1]).toLowerCase(), body: (it.d[0] + " " + it.d[1] + " " + it.k[0] + " " + it.k[1] + " " + it.x).toLowerCase() };
  });

  function search(q) {
    var toks = q.toLowerCase().split(/[\s,]+/).filter(Boolean);
    if (!toks.length) return [];
    var res = [];
    prepared.forEach(function (p) {
      var score = 0, matched = 0;
      toks.forEach(function (tok) {
        var alts = expand(tok), best = 0;
        alts.forEach(function (a, i) {
          var w = i === 0 ? 1 : 0.5;
          if (p.title.indexOf(a) >= 0) best = Math.max(best, 6 * w);
          else if (p.body.indexOf(a) >= 0) best = Math.max(best, 2 * w);
        });
        if (best) { matched++; score += best; }
      });
      if (matched === toks.length) res.push({ it: p.it, s: score });
      else if (matched && toks.length > 1) res.push({ it: p.it, s: score * 0.3 });
    });
    res.sort(function (a, b) { return b.s - a.s; });
    return res.slice(0, 30);
  }

  function render(q) {
    q = q.trim();
    if (!q) { list.innerHTML = ""; count.innerHTML = ""; none.hidden = true; return; }
    var r = search(q);
    none.hidden = r.length > 0;
    count.innerHTML = r.length ? bi([r.length + " result" + (r.length === 1 ? "" : "s"), r.length + " परिणाम"]) : "";
    list.innerHTML = r.map(function (x) {
      var it = x.it, ext = /^https?:/.test(it.u);
      return '<li><a class="card" href="' + esc(it.u) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : "") + '><span class="pill pill-cyan">' + bi(it.k) + "</span><h3>" + bi(it.t) + "</h3><p>" + bi(it.d) + "</p></a></li>";
    }).join("");
  }

  var timer;
  input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { render(input.value); }, 120); });
  form.addEventListener("submit", function (e) {
    e.preventDefault(); render(input.value);
    try { history.replaceState(null, "", "?q=" + encodeURIComponent(input.value.trim())); } catch (er) {}
  });
  root.querySelectorAll("[data-q]").forEach(function (b) {
    b.addEventListener("click", function () { input.value = b.getAttribute("data-q"); render(input.value); input.focus(); });
  });
  var m = location.search.match(/[?&]q=([^&]*)/);
  if (m) { try { input.value = decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) {} render(input.value); }
})();
