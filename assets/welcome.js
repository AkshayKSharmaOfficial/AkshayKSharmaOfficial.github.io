/* Welcome screen: shown once per visit (per browser tab session) with "Welcome" text and an optional spoken welcome.
   Uses the browser's built-in speech (no audio files, nothing is sent anywhere). Browsers only allow sound after a tap,
   so the voice starts when the visitor taps "Enter with voice". Loaded by assets/app.js. */
(function () {
  "use strict";
  var KEY = "aks-welcome";
  try { if (sessionStorage.getItem(KEY)) return; } catch (e) { /* no storage: show every time */ }
  if (document.getElementById("aks-welcome")) return;

  var T = {
    en: {
      hello: "Welcome", sub: "to the website of", name: "Akshay Kumar Sharma", tag: "Educating People. Advancing Cyber Awareness. Building a Safer Digital India.",
      voice: "Enter with voice", silent: "Enter without sound", speaking: "Speaking…",
      say: "Welcome to the website of Akshay Kumar Sharma. Let us build a safer digital India together."
    },
    hi: {
      hello: "स्वागत है", sub: "आपका स्वागत है", name: "अक्षय कुमार शर्मा", tag: "लोगों को शिक्षित करना। साइबर जागरूकता बढ़ाना। एक सुरक्षित डिजिटल भारत बनाना।",
      voice: "आवाज़ के साथ प्रवेश करें", silent: "बिना आवाज़ के प्रवेश करें", speaking: "बोल रहा है…",
      say: "अक्षय कुमार शर्मा की वेबसाइट में आपका स्वागत है। आइए मिलकर एक सुरक्षित डिजिटल भारत बनाएँ।"
    }
  };
  var hasSpeech = typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function getLang() { try { return localStorage.getItem("aks-lang") === "hi" ? "hi" : "en"; } catch (e) { return "en"; } }
  var lang = getLang();

  /* ---------- styles (self-contained, so no other file needs to change) ---------- */
  var css =
    "#aks-welcome{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:1.5rem;overflow:auto;" +
    "background:radial-gradient(1200px 700px at 50% 30%,#10305f 0%,#071426 55%,#050d1a 100%);color:#fff;font-family:var(--font,system-ui,sans-serif);text-align:center;opacity:1;transition:opacity .6s ease}" +
    "#aks-welcome.aks-out{opacity:0;pointer-events:none}" +
    "#aks-welcome .aw-box{max-width:760px;width:100%}" +
    "#aks-welcome .aw-shield{width:84px;height:84px;margin:0 auto 1.2rem;color:#22d3ee}" +
    "#aks-welcome .aw-shield svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}" +
    "#aks-welcome h1{margin:0;font-size:clamp(2.6rem,9vw,5.2rem);line-height:1.1;font-weight:800;letter-spacing:.02em;background:linear-gradient(90deg,#fff,#22d3ee);-webkit-background-clip:text;background-clip:text;color:transparent}" +
    "#aks-welcome .aw-sub{margin:.9rem 0 0;font-size:clamp(1rem,3vw,1.3rem);color:#cbd5e1}" +
    "#aks-welcome .aw-name{margin:.2rem 0 0;font-size:clamp(1.5rem,5vw,2.4rem);font-weight:700}" +
    "#aks-welcome .aw-tag{margin:1.1rem auto 0;max-width:34rem;color:#94a3b8;font-size:.98rem}" +
    "#aks-welcome .aw-actions{display:flex;flex-wrap:wrap;gap:.8rem;justify-content:center;margin-top:1.8rem}" +
    "#aks-welcome button{font:inherit;cursor:pointer;border-radius:999px;padding:.8rem 1.5rem;font-weight:700;border:1.5px solid rgba(34,211,238,.55);background:transparent;color:#fff}" +
    "#aks-welcome button.aw-main{background:#22d3ee;color:#00131a;border-color:#22d3ee}" +
    "#aks-welcome button:hover{filter:brightness(1.1)}" +
    "#aks-welcome button:focus-visible{outline:3px solid #fff;outline-offset:3px}" +
    "#aks-welcome .aw-lang{position:absolute;top:1rem;right:1rem;display:flex;gap:2px;padding:4px;border-radius:999px;border:1px solid rgba(148,163,184,.35)}" +
    "#aks-welcome .aw-lang button{padding:.35rem .9rem;border:0;font-weight:600;font-size:.9rem;color:#cbd5e1}" +
    "#aks-welcome .aw-lang button[aria-pressed=true]{background:#1677ff;color:#fff}" +
    "#aks-welcome .aw-wave{display:none;gap:5px;height:28px;align-items:center;justify-content:center;margin-top:1.4rem}" +
    "#aks-welcome.aw-speaking .aw-wave{display:flex}" +
    "#aks-welcome.aw-speaking .aw-actions button.aw-main,#aks-welcome.aw-speaking .aw-actions button.aw-hidewhenspeaking{display:none}" +
    "#aks-welcome .aw-wave i{width:5px;height:8px;border-radius:3px;background:#22d3ee;animation:awWave 1s ease-in-out infinite}" +
    "#aks-welcome .aw-wave i:nth-child(2){animation-delay:.12s}#aks-welcome .aw-wave i:nth-child(3){animation-delay:.24s}#aks-welcome .aw-wave i:nth-child(4){animation-delay:.36s}#aks-welcome .aw-wave i:nth-child(5){animation-delay:.48s}" +
    "#aks-welcome .aw-say{margin:.6rem 0 0;color:#22d3ee;font-size:.95rem;min-height:1.4em}" +
    "@keyframes awWave{0%,100%{height:8px}50%{height:28px}}" +
    "@keyframes awUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}" +
    "@keyframes awPulse{0%,100%{box-shadow:0 0 0 0 rgba(34,211,238,.45)}50%{box-shadow:0 0 0 18px rgba(34,211,238,0)}}" +
    (reduce ? "" :
      "#aks-welcome .aw-shield,#aks-welcome h1,#aks-welcome .aw-sub,#aks-welcome .aw-name,#aks-welcome .aw-tag,#aks-welcome .aw-actions{animation:awUp .8s ease both}" +
      "#aks-welcome h1{animation-delay:.15s}#aks-welcome .aw-sub{animation-delay:.35s}#aks-welcome .aw-name{animation-delay:.5s}#aks-welcome .aw-tag{animation-delay:.7s}#aks-welcome .aw-actions{animation-delay:.9s}" +
      "#aks-welcome button.aw-main{animation:awPulse 2s ease-in-out 1.8s infinite}");
  var style = document.createElement("style");
  style.id = "aks-welcome-css"; style.textContent = css;
  document.head.appendChild(style);

  /* ---------- markup ---------- */
  var ov = document.createElement("div");
  ov.id = "aks-welcome"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-labelledby", "aw-title");
  ov.innerHTML =
    '<div class="aw-lang" role="group" aria-label="Language / भाषा"><button type="button" data-aw-lang="en">English</button><button type="button" data-aw-lang="hi" lang="hi">हिन्दी</button></div>' +
    '<div class="aw-box">' +
    '<div class="aw-shield" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg></div>' +
    '<h1 id="aw-title"></h1><p class="aw-sub"></p><p class="aw-name"></p><p class="aw-tag"></p>' +
    '<div class="aw-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><p class="aw-say" role="status" aria-live="polite"></p>' +
    '<div class="aw-actions"><button type="button" class="aw-main" id="aw-voice"></button><button type="button" id="aw-silent"></button></div>' +
    "</div>";

  var el = function (s) { return ov.querySelector(s); };
  function render() {
    var t = T[lang];
    ov.setAttribute("lang", lang);
    el("h1").textContent = t.hello;
    el(".aw-sub").textContent = lang === "hi" ? "" : t.sub;
    el(".aw-sub").hidden = lang === "hi";
    el(".aw-name").textContent = lang === "hi" ? "अक्षय कुमार शर्मा की वेबसाइट में" : t.name;
    el(".aw-tag").textContent = t.tag;
    el("#aw-voice").textContent = "🔊 " + t.voice;
    el("#aw-silent").textContent = t.silent;
    el("#aw-voice").hidden = !hasSpeech;
    ov.querySelectorAll("[data-aw-lang]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-aw-lang") === lang ? "true" : "false"); });
  }

  /* ---------- page lock while open ---------- */
  var inerted = [], prevOverflow = "";
  function lockPage() {
    prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    Array.prototype.forEach.call(document.body.children, function (c) { if (c !== ov && !c.hasAttribute("inert")) { c.setAttribute("inert", ""); inerted.push(c); } });
  }
  function unlockPage() {
    document.body.style.overflow = prevOverflow;
    inerted.forEach(function (c) { c.removeAttribute("inert"); }); inerted = [];
  }

  /* ---------- voice ---------- */
  var closed = false, speaking = false, safety = null, utter = null;
  function pickVoice(voices, wanted) {
    var w = wanted.toLowerCase(), base = w.slice(0, 2);
    return voices.filter(function (v) { return (v.lang || "").toLowerCase() === w; })[0] ||
      voices.filter(function (v) { return (v.lang || "").toLowerCase().indexOf(base) === 0; })[0] || null;
  }
  function getVoices(cb) {
    var vs = speechSynthesis.getVoices();
    if (vs.length) return cb(vs);
    var done = false;
    function fin() { if (done) return; done = true; speechSynthesis.removeEventListener && speechSynthesis.removeEventListener("voiceschanged", fin); cb(speechSynthesis.getVoices()); }
    if (speechSynthesis.addEventListener) speechSynthesis.addEventListener("voiceschanged", fin);
    setTimeout(fin, 700);
  }
  function speak() {
    var say = el(".aw-say");
    getVoices(function (voices) {
      if (closed) return;
      var useLang = lang, v = pickVoice(voices, lang === "hi" ? "hi-IN" : "en-IN") || (lang === "en" ? pickVoice(voices, "en-US") : null);
      var text = T[lang].say;
      if (lang === "hi" && !v) { useLang = "en"; v = pickVoice(voices, "en-IN") || pickVoice(voices, "en-US"); text = T.en.say; }   /* no Hindi voice on this device: speak English instead of garbling Hindi */
      try {
        speechSynthesis.cancel();
        utter = new SpeechSynthesisUtterance(text);
        utter.lang = useLang === "hi" ? "hi-IN" : "en-IN";
        if (v) utter.voice = v;
        utter.rate = 0.95; utter.pitch = 1; utter.volume = 1;
        utter.onstart = function () { speaking = true; ov.classList.add("aw-speaking"); say.textContent = T[lang].speaking; };
        utter.onend = utter.onerror = function () { speaking = false; setTimeout(close, 700); };
        speechSynthesis.speak(utter);
        safety = setTimeout(close, 15000);   /* never leave a visitor stuck if speech stalls */
      } catch (e) { close(); }
    });
  }

  function close() {
    if (closed) return; closed = true;
    clearTimeout(safety);
    try { if (hasSpeech) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    try { sessionStorage.setItem(KEY, "1"); } catch (e) { /* ignore */ }
    ov.classList.add("aw-out");
    document.removeEventListener("keydown", onKey, true);
    setTimeout(function () { unlockPage(); ov.remove(); style.remove(); }, reduce ? 0 : 650);
    var main = document.getElementById("main"); if (main && main.focus) { try { main.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    var f = Array.prototype.filter.call(ov.querySelectorAll("button"), function (b) { return !b.hidden && b.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (!ov.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- events ---------- */
  ov.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-aw-lang")) {
      var l = b.getAttribute("data-aw-lang");
      var siteBtn = document.querySelector('.lang-toggle button[data-lang="' + l + '"]');   /* reuse the site's own language switch so the whole page follows */
      if (siteBtn) siteBtn.click(); else { try { localStorage.setItem("aks-lang", l); } catch (err) { /* ignore */ } }
      lang = l; render();
      if (utter) { utter.onstart = utter.onend = utter.onerror = null; }   /* a cancelled voice must not close the screen */
      if (hasSpeech) { try { speechSynthesis.cancel(); } catch (err) { /* ignore */ } }
      clearTimeout(safety); speaking = false; ov.classList.remove("aw-speaking"); el(".aw-say").textContent = ""; el("#aw-voice").disabled = false;
      return;
    }
    if (b.id === "aw-silent") { close(); return; }
    if (b.id === "aw-voice") { b.disabled = true; speak(); }
  });
  document.addEventListener("keydown", onKey, true);

  function show() {
    document.body.appendChild(ov);
    render(); lockPage();
    var first = hasSpeech ? el("#aw-voice") : el("#aw-silent");
    try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  if (document.body) show(); else document.addEventListener("DOMContentLoaded", show);
})();
