/* Welcome message: a card on the right side of the screen (above the theme switch), shown once per visit, with an
   optional spoken welcome using the browser's built-in speech (Web Speech API). No libraries, no alert box, no notification
   permission, nothing is sent anywhere. Loaded by assets/app.js.
   "Once per visit" = once per browser tab session: opening the site fresh shows it again, moving between pages does not.
   Browsers may block speech until the visitor interacts with the page. We never bypass that: if the first attempt is blocked,
   the voice starts after the visitor's first click/tap/key press, only if the message is still on screen.
   Voice source, best first: 1) assets/welcome-voice.mp3 if you add that file (a real recording or studio-quality voice),
   2) otherwise the best English voice the visitor's browser offers. */
(function () {
  "use strict";
  var me = document.currentScript;
  var AUDIO_SRC = me && me.src ? me.src.replace(/welcome-toast\.js(\?.*)?$/, "welcome-voice.mp3") : "/assets/welcome-voice.mp3";
  var KEY = "aks-welcome-toast", SHOW_MS = 5000 + 2000, EXIT_MS = 450, HARD_CAP_MS = 12000;
  try { if (sessionStorage.getItem(KEY)) return; } catch (e) { /* storage blocked: still show once on this page */ }
  if (document.getElementById("aks-toast")) return;

  var TITLE = "Welcome to Akshay Kumar Sharma's Cyber Security Awareness Website!";
  var BODY = "Stay Alert, Stay Safe! Explore cyber safety tips and protect yourself from online fraud.";
  var SPOKEN = TITLE + " " + BODY;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasSpeech = typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";

  var css =
    "#aks-toast{position:fixed;right:max(1rem,env(safe-area-inset-right,0px));bottom:calc(4.6rem + env(safe-area-inset-bottom,0px));z-index:120;" +
    "width:min(400px,calc(100% - 2rem));transform:translateX(24px);opacity:0;pointer-events:none;" +
    "transition:transform .5s cubic-bezier(.2,.8,.2,1),opacity .45s ease;" +
    "font-family:var(--font,system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans','Noto Sans Devanagari',Arial,sans-serif)}" +
    "#aks-toast.aks-in{transform:none;opacity:1;pointer-events:auto}" +
    "#aks-toast.aks-out{transform:translateX(24px);opacity:0;pointer-events:none}" +
    "#aks-toast .at-card{position:relative;overflow:hidden;display:flex;gap:.8rem;align-items:flex-start;padding:.95rem 5.2rem 1.1rem .95rem;border-radius:var(--radius,14px);" +
    "background:var(--card,#0e1a2f);color:var(--gray,#cbd5e1);border:1px solid var(--line-strong,rgba(34,211,238,.35));" +
    "box-shadow:0 18px 40px -14px rgba(0,0,0,.65),0 0 0 1px rgba(22,119,255,.12)}" +
    "#aks-toast .at-icon{flex:none;width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:rgba(34,211,238,.12);color:var(--cyan,#22d3ee)}" +
    "#aks-toast .at-icon svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    "#aks-toast .at-title{margin:0;font-size:.98rem;line-height:1.35;font-weight:700;color:var(--white,#fff)}" +
    "#aks-toast .at-body{margin:.25rem 0 0;font-size:.9rem;line-height:1.5}" +
    "#aks-toast .at-tools{position:absolute;top:.45rem;right:.45rem;display:flex;gap:.1rem}" +
    "#aks-toast .at-btn{width:34px;height:34px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;cursor:pointer;background:transparent;color:var(--muted,#94a3b8);font:inherit;font-size:1.5rem;line-height:1}" +
    "#aks-toast .at-btn svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    "#aks-toast .at-btn:hover{background:rgba(148,163,184,.18);color:var(--white,#fff)}" +
    "#aks-toast .at-btn:focus-visible{outline:3px solid var(--cyan,#22d3ee);outline-offset:2px}" +
    "#aks-toast .at-btn[hidden]{display:none}" +
    "#aks-toast .at-speak.is-on{color:var(--cyan,#22d3ee)}" +
    "#aks-toast .at-bar{position:absolute;left:0;bottom:0;height:3px;width:100%;background:linear-gradient(90deg,var(--blue,#1677ff),var(--cyan,#22d3ee));transform-origin:left;transform:scaleX(1)}" +
    "#aks-toast.aks-in .at-bar{animation:atBar " + SHOW_MS + "ms linear forwards}" +
    "#aks-toast.aks-paused .at-bar{animation-play-state:paused}" +
    "@keyframes atBar{from{transform:scaleX(1)}to{transform:scaleX(0)}}" +
    ":root[data-theme=light] #aks-toast .at-card{background:#fff;color:#334155;box-shadow:0 18px 40px -16px rgba(15,23,42,.35)}" +
    ":root[data-theme=light] #aks-toast .at-title{color:#0f172a}" +
    ":root[data-theme=light] #aks-toast .at-btn:hover{color:#0f172a}" +
    "@media (max-width:480px){#aks-toast{width:min(330px,calc(100% - 2rem))}#aks-toast .at-card{padding:.8rem 4.9rem 1rem .8rem;gap:.65rem}#aks-toast .at-icon{width:34px;height:34px}#aks-toast .at-title{font-size:.92rem}#aks-toast .at-body{font-size:.85rem}}" +
    "@media (prefers-reduced-motion:reduce){#aks-toast,#aks-toast.aks-in,#aks-toast.aks-out{transform:none;transition:opacity .3s ease}#aks-toast.aks-in .at-bar{animation:none}}" +
    "@media print{#aks-toast{display:none}}";

  var ICON_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  var ICON_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>';

  var style = document.createElement("style");
  style.id = "aks-toast-css"; style.textContent = css;

  var box = document.createElement("div");
  box.id = "aks-toast"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite"); box.setAttribute("lang", "en");
  box.innerHTML =
    '<div class="at-card">' +
    '<div class="at-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg></div>' +
    '<div><p class="at-title"></p><p class="at-body"></p></div>' +
    '<div class="at-tools"><button type="button" class="at-btn at-speak"></button><button type="button" class="at-btn at-close" aria-label="Close welcome message">\u00d7</button></div>' +
    '<span class="at-bar" aria-hidden="true"></span></div>';
  box.querySelector(".at-title").textContent = TITLE;
  box.querySelector(".at-body").textContent = BODY;
  var speakBtn = box.querySelector(".at-speak"), closeBtn = box.querySelector(".at-close");
  speakBtn.hidden = false;   /* audio file or browser voice: hidden later only if neither works */

  /* ---------- voice ---------- */
  var speaking = false, voiceDone = false, gone = false, myUtter = null, startWatch = null;
  function setSpeakUi() {
    speakBtn.innerHTML = speaking ? ICON_ON : ICON_OFF;
    speakBtn.classList.toggle("is-on", speaking);
    speakBtn.setAttribute("aria-label", speaking ? "Mute welcome voice" : "Replay welcome voice");
    speakBtn.setAttribute("title", speaking ? "Mute voice" : "Play voice");
  }
  function scoreVoice(v) {
    var l = (v.lang || "").toLowerCase().replace("_", "-"), n = v.name || "";
    if (l.indexOf("en") !== 0) return -1;
    var s = 0;
    if (/natural|neural|online/i.test(n)) s += 8;                       /* Microsoft Edge/Windows "Natural" voices sound the most human */
    if (/premium|enhanced/i.test(n)) s += 6;                            /* Apple downloadable high-quality voices */
    if (/google/i.test(n)) s += 4;
    if (/aria|jenny|guy|ryan|sonia|libby|neerja|prabhat|natasha|william|clara|samantha|siri|ava|serena|daniel|karen|moira|rishi|veena/i.test(n)) s += 3;
    if (l === "en-in") s += 2; else if (l === "en-us" || l === "en-gb" || l === "en-au") s += 1;
    if (v.localService === false) s += 1;                               /* cloud voices are usually better than the built-in ones */
    if (/espeak|compact|novelty|whisper|zarvox|bad |bells|bubbles|cellos|organ|trinoids|junior|albert|fred|ralph|kathy|bahh|boing|deranged|good news|hysterical|pipe organ|superstar/i.test(n)) s -= 10;
    return s;
  }
  function pickVoice(list) {
    var best = null, bs = -1;
    list.forEach(function (v) { var s = scoreVoice(v); if (s > bs) { bs = s; best = v; } });
    return best;
  }
  function getVoices(cb) {
    var vs = speechSynthesis.getVoices();
    if (vs && vs.length) return cb(vs);
    var done = false;
    function fin() { if (done) return; done = true; try { speechSynthesis.removeEventListener("voiceschanged", fin); } catch (e) { /* ignore */ } cb(speechSynthesis.getVoices() || []); }
    try { speechSynthesis.addEventListener("voiceschanged", fin); } catch (e) { /* ignore */ }
    setTimeout(fin, 700);
  }
  function stopVoice() {
    clearTimeout(startWatch);
    if (myUtter) { myUtter.onstart = myUtter.onend = myUtter.onerror = null; myUtter = null; try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
    if (audio) { try { audio.pause(); audio.currentTime = 0; } catch (e) { /* ignore */ } }
    speaking = false; setSpeakUi();
  }
  /* viaGesture: true when called from a visitor click, where the browser allows sound */
  function speakTts(viaGesture) {
    if (!hasSpeech || gone) return;
    try {
      getVoices(function (voices) {
        if (gone) return;
        stopVoice();
        var u = new SpeechSynthesisUtterance(SPOKEN);
        u.lang = "en-IN"; u.rate = 0.95; u.pitch = 1; u.volume = 1;   /* slightly slower than default sounds calmer and clearer */
        var v = pickVoice(voices); if (v) { u.voice = v; u.lang = v.lang || u.lang; }
        myUtter = u;
        function blocked() {
          if (myUtter !== u) return;
          stopVoice();
          /* wait for the visitor's first interaction, never force it */
        }
        u.onstart = function () { clearTimeout(startWatch); if (myUtter !== u) return; speaking = true; voiceDone = true; setSpeakUi(); };
        u.onend = function () { if (myUtter !== u) return; myUtter = null; speaking = false; setSpeakUi(); if (!gone && lateHide) arm(0); };
        u.onerror = function (e) { if (myUtter !== u) return; var why = e && e.error; if (why === "not-allowed" || why === "audio-busy" || why === "synthesis-failed") blocked(); else { myUtter = null; speaking = false; setSpeakUi(); } };
        startWatch = setTimeout(function () { if (!speaking) blocked(); }, 1800);   /* silent block (some browsers give no error) */
        speechSynthesis.speak(u);
      });
    } catch (e) { stopVoice(); }
  }

  /* ---------- optional real recording: assets/welcome-voice.mp3 ---------- */
  var audio = null, audioFailed = false;
  function audioUnavailable() {
    audioFailed = true; speaking = false;
    if (gone) return;
    if (hasSpeech) speakTts(false); else { speakBtn.hidden = true; }
    setSpeakUi();
  }
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = "auto";
    audio.addEventListener("playing", function () { speaking = true; voiceDone = true; setSpeakUi(); });
    audio.addEventListener("ended", function () { speaking = false; setSpeakUi(); if (!gone && lateHide) arm(0); });
    audio.addEventListener("error", function () { if (!audioFailed) audioUnavailable(); });   /* file missing or unsupported: use the browser voice instead */
    audio.src = AUDIO_SRC;
    return audio;
  }
  function playAudio() {
    var a = ensureAudio();
    try { a.currentTime = 0; } catch (e) { /* not loaded yet */ }
    var pr;
    try { pr = a.play(); } catch (e) { audioUnavailable(); return; }
    playPending = true;
    if (pr && pr.then) pr.then(function () { playPending = false; }, function () { playPending = false; });
    if (pr && pr.catch) pr.catch(function (err) {
      if (gone || audioFailed) return;
      var n = err && err.name;
      if (n === "NotAllowedError" || n === "AbortError") return;   /* blocked until the visitor interacts (or we stopped it): wait, never force */
      audioUnavailable();
    });
  }
  function speak(viaGesture) {
    if (gone) return;
    stopVoice();
    if (!audioFailed) playAudio(); else speakTts(viaGesture);
  }
  /* Browsers only allow sound after the visitor has touched the page once. We listen from the very first moment, so ANY tap, click
     or key press (even before the card appears) unlocks the sound and the voice starts by itself, no speaker button needed. */
  var gestureEvents = ["pointerdown", "pointerup", "mousedown", "touchstart", "touchend", "keydown", "click"];
  var shown = false, playPending = false;
  function onGesture(e) {
    if (e && e.target && e.target.closest && e.target.closest("#aks-toast .at-btn")) return;   /* the close and speaker buttons handle themselves */
    if (voiceDone || gone) { gestureEvents.forEach(function (n) { document.removeEventListener(n, onGesture, true); }); return; }
    if (shown && !speaking && !playPending) speak(true);   /* a tap while the card is on screen: now the browser allows sound */
  }

  speakBtn.addEventListener("click", function () { if (speaking) { stopVoice(); voiceDone = true; } else { speak(true); rearm(); } });

  /* ---------- show / hide ---------- */
  var timer = null, remaining = SHOW_MS, startedAt = 0, openedAt = 0, lateHide = false;
  function hide() {
    if (gone) return; gone = true;
    clearTimeout(timer); stopVoice(); if (audio) { audio.removeAttribute("src"); try { audio.load(); } catch (e) { /* ignore */ } audio = null; }
    gestureEvents.forEach(function (n) { document.removeEventListener(n, onGesture, true); });
    box.classList.remove("aks-in"); box.classList.add("aks-out");
    setTimeout(function () { box.remove(); style.remove(); }, reduce ? 320 : EXIT_MS + 60);
  }
  /* after the 7 seconds: if the voice is mid-sentence, let it finish (up to a hard cap) so it is not cut off */
  function timeUp() {
    if (gone) return;
    var spent = Date.now() - openedAt;
    if (speaking && audio && isFinite(audio.duration)) {   /* recording: stay until it really ends (the 'ended' event hides us), never cut it, never longer than 30s in total */
      var left = (audio.duration - audio.currentTime) * 1000 + 800;
      if (spent + left <= 30000) { lateHide = true; clearTimeout(timer); timer = setTimeout(hide, left); return; }
    } else if (speaking && spent < HARD_CAP_MS) {         /* browser voice: let it finish, up to the cap */
      lateHide = true; clearTimeout(timer); timer = setTimeout(hide, Math.max(300, HARD_CAP_MS - spent)); return;
    }
    hide();
  }
  function arm(ms) { clearTimeout(timer); startedAt = Date.now(); timer = setTimeout(ms === 0 ? hide : timeUp, ms); }
  function rearm() {
    if (gone) return;
    lateHide = false; remaining = SHOW_MS; openedAt = Date.now();
    box.classList.remove("aks-in"); void box.offsetWidth; box.classList.add("aks-in");   /* restart the progress bar */
    arm(SHOW_MS);
  }
  /* pause while the visitor hovers or focuses the message, so it never disappears while being read or used */
  function pause() { if (gone) return; remaining = Math.max(800, remaining - (Date.now() - startedAt)); clearTimeout(timer); box.classList.add("aks-paused"); }
  function resume() { if (gone) return; box.classList.remove("aks-paused"); arm(remaining); }
  box.addEventListener("mouseenter", pause); box.addEventListener("mouseleave", resume);
  box.addEventListener("focusin", pause); box.addEventListener("focusout", resume);
  closeBtn.addEventListener("click", hide);

  function show() {
    document.head.appendChild(style); document.body.appendChild(box);
    try { sessionStorage.setItem(KEY, "1"); } catch (e) { /* ignore */ }
    setSpeakUi();
    void box.offsetWidth;                       /* make the browser register the start position so the entry animation plays */
    box.classList.add("aks-in");
    openedAt = Date.now(); arm(SHOW_MS);
    shown = true;
    speak(false);                               /* start the voice right away; if the browser blocks it, the visitor's first tap/click/key starts it */
  }
  /* on the very first load the site plays its own 1.5s logo intro; wait for it so the two do not overlap */
  function start() { setTimeout(show, document.documentElement.classList.contains("intro") ? 1650 : 350); }
  gestureEvents.forEach(function (n) { document.addEventListener(n, onGesture, true); });
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
