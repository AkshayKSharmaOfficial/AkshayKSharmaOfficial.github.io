/* Certificate verification page. Asks /api/verify whether a Certificate ID was issued by this site.
   Only name, quiz, score and date are shown; the mobile number is never sent to the browser. */
(function () {
  "use strict";
  var root = document.getElementById("verify-root");
  if (!root) return;

  function getLang() { try { return localStorage.getItem("aks-lang") || "en"; } catch (e) { return "en"; } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function b(pair) {
    var l = getLang();
    return '<span data-l="en"' + (l === "en" ? "" : " hidden") + ">" + esc(pair[0]) + '</span><span data-l="hi" lang="hi"' + (l === "hi" ? "" : " hidden") + ">" + esc(pair[1]) + "</span>";
  }
  var ID_RE = /^AKS-\d{8}-[A-HJ-NP-Z2-9]{6}$/;

  root.innerHTML =
    '<div class="quiz-card"><form id="vf" novalidate>' +
    '<label for="vid">' + b(["Certificate ID", "Certificate ID"]) + "</label>" +
    '<input id="vid" type="text" maxlength="24" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="AKS-20261029-ABC234" required>' +
    '<button class="btn btn-primary" type="submit">' + b(["Verify", "सत्यापित करें"]) + "</button>" +
    '</form></div><div id="vout" aria-live="polite"></div>';

  var form = document.getElementById("vf"), input = document.getElementById("vid"), out = document.getElementById("vout");

  function show(kind, inner) {
    out.innerHTML = '<div class="quiz-card verify-result"><div class="notice ' + kind + '"><p>' + inner + "</p></div></div>";
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString(getLang() === "hi" ? "hi-IN" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  function check(raw) {
    var id = String(raw || "").replace(/\s+/g, "").toUpperCase();
    if (!ID_RE.test(id)) { show("warn", b(["That does not look like a valid Certificate ID. It looks like AKS-20261029-ABC234.", "यह सही Certificate ID नहीं लगती। सही ID ऐसी दिखती है: AKS-20261029-ABC234।"])); return; }
    show("", b(["Checking…", "जाँच हो रही है…"]));
    fetch("/api/verify?id=" + encodeURIComponent(id), { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.status === 200 && res.j && res.j.valid) {
          var j = res.j, hi = getLang() === "hi";
          out.innerHTML = '<div class="quiz-card verify-result"><div class="notice ok"><p><strong>' + b(["Genuine certificate", "असली सर्टिफ़िकेट"]) + "</strong><br>" +
            b(["This certificate was issued by this website.", "यह सर्टिफ़िकेट इसी वेबसाइट द्वारा जारी किया गया है।"]) + "</p></div><dl>" +
            "<dt>" + b(["Name", "नाम"]) + "</dt><dd>" + esc(j.name) + "</dd>" +
            "<dt>" + b(["Quiz", "क्विज़"]) + "</dt><dd>" + esc(hi && j.quizHi ? j.quizHi : j.quiz) + "</dd>" +
            "<dt>" + b(["Score", "स्कोर"]) + "</dt><dd>" + esc(j.score) + " / " + esc(j.total) + " (" + esc(j.pct) + "%)</dd>" +
            "<dt>" + b(["Date", "तारीख"]) + "</dt><dd>" + esc(fmtDate(j.date)) + "</dd>" +
            "<dt>" + b(["Certificate ID", "Certificate ID"]) + "</dt><dd>" + esc(j.id) + "</dd></dl>" +
            '<p class="quiz-fine">' + b(["Check that the name on your copy matches the name shown here.", "अपनी कॉपी पर छपा नाम यहाँ दिखे नाम से मिलाकर देखें।"]) + "</p></div>";
        } else if (res.status === 404) {
          show("danger", b(["No certificate found with this ID. Please check the ID and try again. If the ID is correct, the certificate may not be genuine.", "इस ID का कोई सर्टिफ़िकेट नहीं मिला। कृपया ID जाँचकर दोबारा कोशिश करें। ID सही होने पर भी न मिले तो सर्टिफ़िकेट असली नहीं हो सकता।"]));
        } else if (res.status === 429) {
          show("warn", b(["Too many checks. Please wait a minute and try again.", "बहुत ज़्यादा बार जाँच हुई। कृपया एक मिनट बाद कोशिश करें।"]));
        } else {
          show("warn", b(["Verification is not available right now. Please try again later.", "अभी सत्यापन उपलब्ध नहीं है। कृपया बाद में कोशिश करें।"]));
        }
      })
      .catch(function () { show("warn", b(["Could not reach the verification server. Please try again later.", "सत्यापन सर्वर से संपर्क नहीं हो पाया। कृपया बाद में कोशिश करें।"])); });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    check(input.value);
    try { history.replaceState(null, "", location.pathname + "?id=" + encodeURIComponent(input.value.trim())); } catch (err) { /* ignore */ }
  });

  var q = new URLSearchParams(location.search).get("id");
  if (q) { input.value = q; check(q); }
})();
