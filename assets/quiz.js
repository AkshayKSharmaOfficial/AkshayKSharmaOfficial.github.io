/* Quiz runner + certificate generator. The quiz runs in the browser; after a pass, name/mobile/score are sent to /api/certificate so the certificate can be verified.
   Data comes from assets/quiz-data.js (generated from content/quizzes.mjs). */
(function () {
  "use strict";
  var root = document.getElementById("quiz-root");
  var DATA = window.AKS_QUIZ;
  if (!root || !DATA) return;
  var quiz = DATA.quizzes[root.getAttribute("data-quiz")];
  if (!quiz) return;
  var SIG = window.AKS_SIGNATURES || {};

  function getLang() { try { return localStorage.getItem("aks-lang") || "en"; } catch (e) { return "en"; } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /* bilingual snippet: pair = [english, hindi] */
  function b(pair) {
    var l = getLang();
    return '<span data-l="en"' + (l === "en" ? "" : " hidden") + ">" + esc(pair[0]) + '</span><span data-l="hi" lang="hi"' + (l === "hi" ? "" : " hidden") + ">" + esc(pair[1]) + "</span>";
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  var total = quiz.questions.length;
  var order, idx, score, answers, name, phone;

  /* ---------- views ---------- */
  function showIntro() {
    root.innerHTML =
      '<div class="quiz-card">' +
      '<h2>' + b(["Before you start", "शुरू करने से पहले"]) + "</h2>" +
      '<ul class="quiz-points">' +
      "<li>" + b([total + " multiple-choice questions. Pass mark: " + quiz.pass + " correct answers.", total + " बहुविकल्पीय प्रश्न। पास होने के लिए " + quiz.pass + " सही उत्तर चाहिए।"]) + "</li>" +
      "<li>" + b(["Only candidates who pass receive the certificate, ready instantly and signed by the Head and Co-Head.", "सिर्फ़ पास होने वालों को सर्टिफ़िकेट मिलता है, जो तुरंत तैयार होता है और जिस पर हेड और को-हेड के हस्ताक्षर हैं।"]) + "</li>" +
      "<li>" + b(["Your name and mobile number are saved on our server only to issue and verify your certificate. They are not shown publicly or shared.", "आपका नाम और मोबाइल नंबर सिर्फ़ आपका सर्टिफ़िकेट जारी और सत्यापित करने के लिए हमारे सर्वर पर सेव होते हैं। इन्हें सार्वजनिक रूप से दिखाया या साझा नहीं किया जाता।"]) + "</li>" +
      "<li>" + b(["You can retake the quiz as many times as you like.", "आप क्विज़ जितनी बार चाहें दोबारा दे सकते हैं।"]) + "</li>" +
      "</ul>" +
      '<form id="quiz-start" novalidate>' +
      '<label for="quiz-name">' + b(["Your full name (printed on the certificate)", "आपका पूरा नाम (सर्टिफ़िकेट पर छपेगा)"]) + "</label>" +
      '<input id="quiz-name" type="text" maxlength="50" autocomplete="name" required>' +
      '<p class="quiz-err" id="quiz-err" role="alert" hidden>' + b(["Please enter your name (at least 2 letters).", "कृपया अपना नाम लिखें (कम से कम 2 अक्षर)।"]) + "</p>" +
      '<label for="quiz-phone">' + b(["Mobile number", "मोबाइल नंबर"]) + "</label>" +
      '<input id="quiz-phone" type="tel" inputmode="numeric" maxlength="14" autocomplete="tel-national" placeholder="10-digit mobile number" required>' +
      '<p class="quiz-err" id="quiz-err2" role="alert" hidden>' + b(["Please enter a valid 10-digit mobile number.", "कृपया सही 10 अंकों का मोबाइल नंबर लिखें।"]) + "</p>" +
      '<button class="btn btn-primary" type="submit">' + b(["Start quiz", "क्विज़ शुरू करें"]) + "</button>" +
      "</form></div>";
    var form = document.getElementById("quiz-start");
    var input = document.getElementById("quiz-name");
    var phoneInput = document.getElementById("quiz-phone");
    if (name) input.value = name;
    if (phone) phoneInput.value = phone;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = input.value.replace(/\s+/g, " ").trim();
      var digits = phoneInput.value.replace(/[\s\-]/g, "").replace(/^(\+91|0091|91|0)(?=\d{10}$)/, "");
      var nameOk = v.length >= 2, phoneOk = /^[6-9]\d{9}$/.test(digits);
      document.getElementById("quiz-err").hidden = nameOk;
      document.getElementById("quiz-err2").hidden = phoneOk;
      if (!nameOk) { input.setAttribute("aria-invalid", "true"); input.focus(); return; }
      if (!phoneOk) { phoneInput.setAttribute("aria-invalid", "true"); phoneInput.focus(); return; }
      name = v; phone = digits;
      start();
    });
  }

  function start() {
    idx = 0; score = 0; answers = [];
    order = quiz.questions.map(function (q) { return shuffle([0, 1, 2, 3]); });
    showQuestion();
  }

  function showQuestion() {
    var q = quiz.questions[idx];
    var opts = order[idx];
    var html =
      '<div class="quiz-card">' +
      '<div class="quiz-progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + idx + '"><span class="qp-bar"></span></div>' +
      '<p class="quiz-count">' + b(["Question " + (idx + 1) + " of " + total, "प्रश्न " + (idx + 1) + " / " + total]) + "</p>" +
      '<h2 class="quiz-q" tabindex="-1">' + b(q.q) + "</h2>" +
      '<div class="quiz-opts" role="group" aria-label="Answer options">' +
      opts.map(function (o, i) {
        return '<button type="button" class="quiz-opt" data-o="' + o + '"><span class="quiz-key">' + "ABCD".charAt(i) + "</span><span>" + b(q.o[o]) + "</span></button>";
      }).join("") +
      "</div>" +
      '<div class="quiz-feedback" id="quiz-fb" aria-live="polite"></div>' +
      '<div class="quiz-actions"><button type="button" class="btn btn-primary" id="quiz-next" hidden>' +
      b([idx + 1 === total ? "See result" : "Next question", idx + 1 === total ? "परिणाम देखें" : "अगला प्रश्न"]) + "</button></div></div>";
    root.innerHTML = html;
    root.querySelector(".qp-bar").style.width = Math.round((idx / total) * 100) + "%";
    root.querySelector(".quiz-q").focus({ preventScroll: true });
    var btns = root.querySelectorAll(".quiz-opt");
    btns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var chosen = Number(btn.getAttribute("data-o"));
        var ok = chosen === q.a;
        if (ok) score++;
        answers.push({ chosen: chosen, ok: ok });
        btns.forEach(function (x) {
          x.disabled = true;
          var v = Number(x.getAttribute("data-o"));
          if (v === q.a) x.classList.add("is-right");
          else if (v === chosen) x.classList.add("is-wrong");
        });
        document.getElementById("quiz-fb").innerHTML =
          '<p class="' + (ok ? "fb-ok" : "fb-bad") + '"><strong>' + (ok ? b(["Correct.", "सही उत्तर।"]) : b(["Not quite.", "सही नहीं।"])) + "</strong> " + b(q.w) + "</p>";
        var next = document.getElementById("quiz-next");
        next.hidden = false;
        next.focus();
        next.addEventListener("click", function () {
          idx++;
          if (idx < total) showQuestion(); else showResult();
        });
      });
    });
  }

  function reviewHtml() {
    return '<details class="quiz-review"><summary>' + b(["Review your answers", "अपने उत्तर देखें"]) + "</summary><ol>" +
      quiz.questions.map(function (q, i) {
        var a = answers[i];
        return '<li class="' + (a.ok ? "rv-ok" : "rv-bad") + '"><p><strong>' + b(q.q) + "</strong></p>" +
          '<p>' + b(["Correct answer: ", "सही उत्तर: "]) + b(q.o[q.a]) + "</p>" +
          (a.ok ? "" : "<p>" + b(["Your answer: ", "आपका उत्तर: "]) + b(q.o[a.chosen]) + "</p>") +
          "<p class=\"rv-why\">" + b(q.w) + "</p></li>";
      }).join("") + "</ol></details>";
  }

  var certData = null;
  function showResult() {
    var pct = Math.round((score / total) * 100);
    var passed = score >= quiz.pass;
    var html = '<div class="quiz-card quiz-result ' + (passed ? "is-pass" : "is-fail") + '">' +
      '<p class="quiz-score">' + score + " / " + total + " <span>(" + pct + "%)</span></p>" +
      "<h2 tabindex=\"-1\" id=\"quiz-res-h\">" + (passed ? b(["Congratulations, " + name + "! You passed.", "बधाई हो, " + name + "! आप पास हो गए।"]) : b(["You did not reach the pass mark this time.", "इस बार आप पास अंक तक नहीं पहुँच पाए।"])) + "</h2>" +
      "<p>" + (passed ? b(["Your certificate is ready below.", "आपका सर्टिफ़िकेट नीचे तैयार है।"]) : b(["You need " + quiz.pass + " correct answers to pass. Review the answers and try again.", "पास होने के लिए " + quiz.pass + " सही उत्तर चाहिए। उत्तर देखें और दोबारा कोशिश करें।"])) + "</p>" +
      '<div class="quiz-actions">' +
      '<button type="button" class="btn ' + (passed ? "btn-outline" : "btn-primary") + '" id="quiz-retry">' + b(["Retake quiz", "क्विज़ दोबारा दें"]) + "</button>" +
      '<a class="btn btn-outline" href="/quiz/">' + b(["All quizzes", "सभी क्विज़"]) + "</a></div></div>" +
      (passed ? '<div class="quiz-card cert-card"><h2>' + b(["Your certificate", "आपका सर्टिफ़िकेट"]) + "</h2>" +
        '<p class="quiz-fine" id="cert-status" role="status">' + b(["Preparing your certificate…", "आपका सर्टिफ़िकेट तैयार हो रहा है…"]) + "</p>" +
        '<canvas id="cert-canvas" class="cert-canvas" width="1754" height="1240" role="img" hidden aria-label="Certificate of achievement for ' + esc(name) + '"></canvas>' +
        '<div class="quiz-actions" id="cert-dl" hidden><button type="button" class="btn btn-primary" id="dl-png">' + b(["Download PNG image", "PNG इमेज डाउनलोड करें"]) + "</button>" +
        '<button type="button" class="btn btn-cyan" id="dl-pdf">' + b(["Download PDF", "PDF डाउनलोड करें"]) + "</button></div>" +
        '<div id="cert-share" hidden><h3 class="quiz-share-h">' + b(["Share your achievement", "अपनी उपलब्धि शेयर करें"]) + "</h3>" +
        '<div class="quiz-actions"><button type="button" class="btn btn-outline" id="sh-wa">' + b(["Share on WhatsApp", "WhatsApp पर शेयर करें"]) + "</button>" +
        '<button type="button" class="btn btn-outline" id="sh-li">' + b(["Share on LinkedIn", "LinkedIn पर शेयर करें"]) + "</button>" +
        '<button type="button" class="btn btn-outline" id="sh-copy">' + b(["Copy link", "लिंक कॉपी करें"]) + "</button></div>" +
        '<p class="quiz-fine" id="sh-msg" role="status"></p></div>' +
        '<p class="quiz-fine">' + b(["This is an educational certificate of participation in an awareness quiz. It is not an accredited qualification.", "यह जागरूकता क्विज़ में भागीदारी का शैक्षिक सर्टिफ़िकेट है। यह कोई मान्यता प्राप्त योग्यता नहीं है।"]) + "</p></div>" : "") +
      '<div class="quiz-card">' + reviewHtml() + "</div>";
    root.innerHTML = html;
    document.getElementById("quiz-res-h").focus({ preventScroll: false });
    document.getElementById("quiz-retry").addEventListener("click", function () { showIntro(); window.scrollTo(0, 0); });
    if (passed) {
      var canvas = document.getElementById("cert-canvas");
      register().then(function (rec) {
        if (document.getElementById("cert-canvas") !== canvas) return;   /* user already retook the quiz */
        certData = { name: name, quiz: quiz.title[0], score: score, total: total, pct: pct, passMark: quiz.pass, date: rec ? new Date(rec.date) : new Date(), id: rec ? rec.id : makeId() };
        drawCertificate(canvas, certData);
        canvas.hidden = false;
        document.getElementById("cert-dl").hidden = false;
        document.getElementById("cert-status").innerHTML = rec
          ? b(["Your certificate is registered. Anyone can check it online with its Certificate ID.", "आपका सर्टिफ़िकेट रजिस्टर हो गया है। कोई भी इसकी Certificate ID से इसे ऑनलाइन जाँच सकता है।"])
          : b(["We could not reach the server, so this certificate is not registered and cannot be verified online. You can still download it.", "सर्वर से संपर्क नहीं हो पाया, इसलिए यह सर्टिफ़िकेट रजिस्टर नहीं हुआ और ऑनलाइन सत्यापित नहीं हो सकता। आप इसे फिर भी डाउनलोड कर सकते हैं।"]);
        document.getElementById("cert-share").hidden = false;
        wireShare(rec ? certData.id : null);
        document.getElementById("dl-png").addEventListener("click", function () {
          canvas.toBlob(function (blob) { if (blob) save(blob, fileBase() + ".png"); }, "image/png");
        });
        document.getElementById("dl-pdf").addEventListener("click", function () {
          var jpg = dataUrlToBytes(canvas.toDataURL("image/jpeg", 0.92));
          save(new Blob([buildPdf(jpg, canvas.width, canvas.height)], { type: "application/pdf" }), fileBase() + ".pdf");
        });
      });
    }
  }

  /* ---------- save the result on the server (returns {id,date} or null if the server is unreachable) ---------- */
  function register() {
    if (typeof fetch !== "function" || location.protocol.indexOf("http") !== 0) return Promise.resolve(null);
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 10000);
    return fetch("/api/certificate", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl ? ctl.signal : undefined,
      body: JSON.stringify({ quizId: root.getAttribute("data-quiz"), name: name, phone: phone, score: score })
    }).then(function (r) { return r.status === 201 ? r.json() : null; })
      .then(function (j) { return j && /^AKS-\d{8}-[A-Z0-9]{6}$/.test(j.id) && !isNaN(new Date(j.date)) ? j : null; })
      .catch(function () { return null; })
      .then(function (v) { clearTimeout(timer); return v; });
  }

  /* ---------- WhatsApp / LinkedIn / copy link ---------- */
  function wireShare(verifiedId) {
    var origin = location.protocol.indexOf("http") === 0 ? location.origin : "";
    var link = origin ? origin + (verifiedId ? "/verify/?id=" + encodeURIComponent(verifiedId) : "/quiz/") : "";
    var msg = document.getElementById("sh-msg");
    function text() {
      var t = getLang() === "hi"
        ? "मैंने Akshay Kumar Sharma का साइबर जागरूकता क्विज़ \"" + quiz.title[1] + "\" पास किया और सर्टिफ़िकेट पाया!"
        : "I passed the \"" + quiz.title[0] + "\" cyber awareness quiz by Akshay Kumar Sharma and earned a certificate!";
      return link ? t + " " + link : t;
    }
    document.getElementById("sh-wa").addEventListener("click", function () {
      window.open("https://wa.me/?text=" + encodeURIComponent(text()), "_blank", "noopener,noreferrer");
    });
    document.getElementById("sh-li").addEventListener("click", function () {
      var u = link || "https://www.linkedin.com/";
      window.open("https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(u), "_blank", "noopener,noreferrer");
    });
    document.getElementById("sh-copy").addEventListener("click", function () {
      var t = text();
      function done(ok) { msg.innerHTML = ok ? b(["Copied. Paste it anywhere.", "कॉपी हो गया। कहीं भी पेस्ट करें।"]) : b(["Could not copy. Please select and copy the text manually.", "कॉपी नहीं हो पाया। कृपया टेक्स्ट खुद चुनकर कॉपी करें।"]); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });
  }

  function makeId() {
    var d = new Date();
    var ymd = d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2);
    var rnd = ""; var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (var i = 0; i < 6; i++) rnd += chars.charAt(Math.floor(Math.random() * chars.length));
    return "AKS-" + ymd + "-" + rnd;
  }
  function fileBase() { return "certificate-" + (root.getAttribute("data-quiz")) + "-" + (name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "participant"); }
  function save(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function dataUrlToBytes(u) {
    var bin = atob(u.split(",")[1]); var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  /* ---------- minimal one-page PDF (A4 landscape) holding the certificate JPEG ---------- */
  function buildPdf(jpg, w, h) {
    var enc = new TextEncoder(); var parts = []; var offsets = []; var pos = 0;
    function add(x) { var u = typeof x === "string" ? enc.encode(x) : x; parts.push(u); pos += u.length; }
    function obj(n, body) { offsets[n] = pos; add(n + " 0 obj\n"); if (typeof body === "string") add(body); else body(); add("\nendobj\n"); }
    var content = "q 842 0 0 595 0 0 cm /Im0 Do Q";
    add("%PDF-1.4\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
    obj(4, function () {
      add("<< /Type /XObject /Subtype /Image /Width " + w + " /Height " + h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpg.length + " >>\nstream\n");
      add(jpg); add("\nendstream");
    });
    obj(5, "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream");
    var xref = pos;
    add("xref\n0 6\n0000000000 65535 f \n");
    for (var i = 1; i <= 5; i++) add(("0000000000" + offsets[i]).slice(-10) + " 00000 n \n");
    add("trailer\n<< /Size 6 /Root 1 0 R /Info << /Title (Certificate) >> >>\nstartxref\n" + xref + "\n%%EOF");
    var out = new Uint8Array(pos); var o = 0;
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  }

  /* ---------- certificate drawing (vector/text only, so the canvas can always be exported) ---------- */
  var NAVY = "#071426", BLUE = "#1677ff", CYAN = "#0ea5c6", GOLD = "#b8892b", INK = "#1e293b", GREY = "#64748b";
  var SERIF = "Georgia, 'Times New Roman', 'Noto Serif', 'Noto Sans Devanagari', 'Nirmala UI', Mangal, serif";
  var SANS = "'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif";
  var SCRIPT = "'Segoe Script','Brush Script MT','Lucida Handwriting','Snell Roundhand','Apple Chancery','URW Chancery L',cursive";

  function fit(ctx, text, font, maxW, startPx, minPx) {
    var px = startPx;
    for (; px > minPx; px -= 2) { ctx.font = font.replace("{px}", px); if (ctx.measureText(text).width <= maxW) break; }
    ctx.font = font.replace("{px}", px);
    return px;
  }
  function centerText(ctx, text, x, y) { ctx.textAlign = "center"; ctx.fillText(text, x, y); }
  function wrapCenter(ctx, text, x, y, maxW, lh) {
    var words = text.split(" "), line = "", lines = [];
    words.forEach(function (w) { var t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    lines.push(line);
    lines.forEach(function (l, i) { centerText(ctx, l, x, y + i * lh); });
    return lines.length;
  }
  function loadImg(src) {
    return new Promise(function (res) { if (!src) return res(null); var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src; });
  }

  function drawCertificate(canvas, d) {
    var W = canvas.width, H = canvas.height, ctx = canvas.getContext("2d");
    var sigImgs = [null, null];
    Promise.all([loadImg(/^data:image\//.test(SIG.head || "") ? SIG.head : ""), loadImg(/^data:image\//.test(SIG.coHead || "") ? SIG.coHead : "")]).then(function (r) {
      sigImgs = r; paint();
    });
    paint();

    function paint() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#fdfcf8"; ctx.fillRect(0, 0, W, H);
      /* fine diagonal guilloche-style texture */
      ctx.save(); ctx.strokeStyle = "rgba(14,60,120,0.045)"; ctx.lineWidth = 1;
      for (var x = -H; x < W; x += 14) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.stroke(); }
      ctx.restore();
      /* frame: navy outer, gold inner, thin cyan hairline */
      ctx.strokeStyle = NAVY; ctx.lineWidth = 22; ctx.strokeRect(34, 34, W - 68, H - 68);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.strokeRect(58, 58, W - 116, H - 116);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.strokeRect(70, 70, W - 140, H - 140);
      ctx.strokeStyle = CYAN; ctx.lineWidth = 1.5; ctx.strokeRect(80, 80, W - 160, H - 160);
      [[80, 80, 1, 1], [W - 80, 80, -1, 1], [80, H - 80, 1, -1], [W - 80, H - 80, -1, -1]].forEach(function (c) { corner(c[0], c[1], c[2], c[3]); });
      /* watermark shield */
      ctx.save(); ctx.globalAlpha = 0.05; shield(ctx, W / 2, H / 2 + 30, 340, NAVY); ctx.restore();

      /* emblem with ring */
      ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(W / 2, 178, 78, 0, 7); ctx.stroke();
      ctx.strokeStyle = CYAN; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(W / 2, 178, 86, 0, 7); ctx.stroke();
      shield(ctx, W / 2, 178, 56, BLUE);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(W / 2 - 20, 178); ctx.lineTo(W / 2 - 5, 194); ctx.lineTo(W / 2 + 23, 160); ctx.stroke();

      ctx.fillStyle = GREY; ctx.font = "600 24px " + SANS; spaced(ctx, "CYBER AWARENESS PROGRAM  ·  AKSHAY KUMAR SHARMA", W / 2, 306, 4);
      ctx.fillStyle = NAVY; ctx.font = "700 92px " + SERIF; spaced(ctx, "CERTIFICATE", W / 2, 408, 10);
      ctx.fillStyle = GOLD; ctx.font = "600 31px " + SANS; spaced(ctx, "OF ACHIEVEMENT", W / 2, 462, 12);
      ornament(W / 2, 492);

      ctx.fillStyle = GREY; ctx.font = "italic 29px " + SERIF; centerText(ctx, "This certificate is proudly presented to", W / 2, 548);
      ctx.fillStyle = NAVY;
      fit(ctx, d.name, "italic 700 {px}px " + SERIF, W - 440, 100, 44);
      centerText(ctx, d.name, W / 2, 648);
      var nw = Math.min(ctx.measureText(d.name).width + 120, W - 360);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2 - nw / 2, 674); ctx.lineTo(W / 2 + nw / 2, 674); ctx.stroke();

      ctx.fillStyle = INK; ctx.font = "29px " + SANS; centerText(ctx, "for successfully passing the cyber awareness assessment", W / 2, 734);
      ctx.fillStyle = BLUE; fit(ctx, d.quiz, "700 {px}px " + SANS, W - 380, 52, 30);
      centerText(ctx, d.quiz, W / 2, 800);
      ctx.fillStyle = INK; ctx.font = "26px " + SANS;
      centerText(ctx, "Score: " + d.score + " / " + d.total + " (" + d.pct + "%)   ·   Pass mark: " + d.passMark + " / " + d.total, W / 2, 850);

      /* signatures */
      var lx = W / 2 - 440, rx = W / 2 + 440, ly = 1005;
      sign(lx, ly, DATA.head.name, DATA.head.title, sigImgs[0]);
      sign(rx, ly, DATA.coHead.name, DATA.coHead.title, sigImgs[1]);

      /* seal with ribbon tails */
      ctx.save(); ctx.translate(W / 2, 960);
      ctx.fillStyle = "#8f6a1c"; ctx.beginPath(); ctx.moveTo(-34, 40); ctx.lineTo(-58, 118); ctx.lineTo(-30, 100); ctx.lineTo(-8, 122); ctx.lineTo(4, 50); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(34, 40); ctx.lineTo(58, 118); ctx.lineTo(30, 100); ctx.lineTo(8, 122); ctx.lineTo(-4, 50); ctx.closePath(); ctx.fill();
      ctx.fillStyle = GOLD; ctx.beginPath();
      for (var i = 0; i < 32; i++) { var a = (i / 32) * Math.PI * 2, r = i % 2 ? 66 : 76; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff8e6"; ctx.beginPath(); ctx.arc(0, 0, 54, 0, 7); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 54, 0, 7); ctx.stroke();
      ctx.strokeStyle = NAVY; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 46, 0, 7); ctx.stroke();
      ctx.fillStyle = NAVY; ctx.font = "700 21px " + SANS; centerText(ctx, "PASSED", 0, -4); ctx.font = "600 17px " + SANS; centerText(ctx, d.pct + "%", 0, 20);
      ctx.restore();

      /* meta */
      var ds = d.date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      ctx.fillStyle = GREY; ctx.font = "22px " + SANS;
      ctx.textAlign = "left"; ctx.fillText("Date: " + ds, 150, 1118);
      ctx.textAlign = "right"; ctx.fillText("Certificate ID: " + d.id, W - 150, 1118);
      ctx.font = "18px " + SANS;
      centerText(ctx, DATA.note, W / 2, 1150);
    }

    function spaced(c, text, x, y, gap) {
      var w = 0, i; for (i = 0; i < text.length; i++) w += c.measureText(text[i]).width + gap; w -= gap;
      var cx = x - w / 2; c.textAlign = "left";
      for (i = 0; i < text.length; i++) { c.fillText(text[i], cx, y); cx += c.measureText(text[i]).width + gap; }
    }
    function ornament(cx, cy) {
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 260, cy); ctx.lineTo(cx - 24, cy); ctx.moveTo(cx + 24, cy); ctx.lineTo(cx + 260, cy); ctx.stroke();
      ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(cx, cy - 9); ctx.lineTo(cx + 9, cy); ctx.lineTo(cx, cy + 9); ctx.lineTo(cx - 9, cy); ctx.closePath(); ctx.fill();
    }
    function corner(x, y, sx, sy) {
      ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
      for (var r = 30; r <= 70; r += 20) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI / 2); ctx.stroke(); }
      ctx.fillStyle = CYAN; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
      ctx.restore();
    }

    function sign(x, y, nm, title, img) {
      if (img) {
        var s = Math.min(320 / img.width, 120 / img.height);
        ctx.drawImage(img, x - (img.width * s) / 2, y - 14 - img.height * s, img.width * s, img.height * s);
      } else {
        ctx.fillStyle = "#0b2a6b"; fit(ctx, nm, "{px}px " + SCRIPT, 330, 62, 34); centerText(ctx, nm, x, y - 18);
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 190, y); ctx.lineTo(x + 190, y); ctx.stroke();
      ctx.fillStyle = NAVY; ctx.font = "700 27px " + SANS; centerText(ctx, nm, x, y + 38);
      ctx.fillStyle = GREY; ctx.font = "22px " + SANS; centerText(ctx, title, x, y + 68);
    }
  }

  function shield(ctx, cx, cy, s, color) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(cx, cy - s); ctx.bezierCurveTo(cx + s * 0.35, cy - s * 0.82, cx + s * 0.8, cy - s * 0.78, cx + s * 0.82, cy - s * 0.7);
    ctx.bezierCurveTo(cx + s * 0.86, cy + s * 0.2, cx + s * 0.5, cy + s * 0.68, cx, cy + s);
    ctx.bezierCurveTo(cx - s * 0.5, cy + s * 0.68, cx - s * 0.86, cy + s * 0.2, cx - s * 0.82, cy - s * 0.7);
    ctx.bezierCurveTo(cx - s * 0.8, cy - s * 0.78, cx - s * 0.35, cy - s * 0.82, cx, cy - s);
    ctx.closePath(); ctx.fill();
  }

  showIntro();
})();
