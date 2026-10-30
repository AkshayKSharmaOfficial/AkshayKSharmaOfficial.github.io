/* Akshay Kumar Sharma - site behaviour. No dependencies, no inline scripts (CSP friendly). */
(function () {
  "use strict";

  /* ---------- Mobile navigation ---------- */
  var toggle = document.getElementById("menu-toggle");
  var nav = document.getElementById("site-nav");
  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    var header = document.querySelector(".site-header");
    if (open && header) {   /* bring the header to the top of the screen first, so the menu panel below it fills the rest of the screen */
      try { document.documentElement.style.setProperty("--hdr-h", Math.round(header.getBoundingClientRect().height) + "px"); } catch (e) { /* ignore */ }
      var top = header.getBoundingClientRect().top;
      if (top > 1) { var d = document.documentElement, sb = d.style.scrollBehavior; d.style.scrollBehavior = "auto"; window.scrollBy(0, top); d.style.scrollBehavior = sb; }
    }
    nav.classList.toggle("open", open);
    document.documentElement.style.overflow = open ? "hidden" : "";   /* on the page root (not the body), so the sticky header keeps working while the menu is open */
  }
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        toggle.focus();
      }
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    window.matchMedia("(min-width: 1261px)").addEventListener("change", function (m) {
      if (m.matches) setMenu(false);
    });
  }

  /* ---------- Language toggle (English / Hindi) ---------- */
  var LANG_KEY = "aks-lang";
  function getLang() {
    try { return localStorage.getItem(LANG_KEY) || "en"; } catch (e) { return "en"; }
  }
  function applyLang(lang) {
    document.querySelectorAll("[data-l]").forEach(function (el) {
      el.hidden = el.getAttribute("data-l") !== lang;
    });
    document.querySelectorAll(".lang-toggle button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-lang") === lang ? "true" : "false");
    });
    var s = document.getElementById("search-input");
    var phKey = lang === "hi" ? "phHi" : "phEn";
    if (s && s.dataset[phKey]) s.placeholder = s.dataset[phKey];
    runFilter();
  }
  document.querySelectorAll(".lang-toggle button").forEach(function (b) {
    b.addEventListener("click", function () {
      var lang = b.getAttribute("data-lang");
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
      applyLang(lang);
    });
  });

  /* ---------- Gallery (rendered from assets/gallery-data.js) ---------- */
  var galleryRoot = document.getElementById("gallery-root");
  var galleryGrid = document.getElementById("filter-list");
  if (galleryRoot && galleryGrid) {
    var gItems = Array.isArray(window.GALLERY_ITEMS)
      ? window.GALLERY_ITEMS.filter(function (i) { return i && typeof i.src === "string" && i.src; })
      : [];
    var gScript = document.querySelector('script[src*="gallery-data"]');
    var gBase = gScript ? gScript.src : location.href;
    if (gItems.length) {
      var gEmpty = document.getElementById("gallery-empty");
      if (gEmpty) gEmpty.hidden = true;
      var gCats = [];
      gItems.forEach(function (it, idx) {
        var cat = typeof it.category === "string" ? it.category : "";
        if (cat && gCats.indexOf(cat) === -1) gCats.push(cat);
        var li = document.createElement("li");
        li.className = "g-item";
        li.setAttribute("data-item", "");
        li.setAttribute("data-cats", cat);
        li.setAttribute("data-search", ((it.caption || "") + " " + (it.alt || "") + " " + cat).toLowerCase());
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "g-btn";
        btn.setAttribute("data-idx", String(idx));
        btn.setAttribute("aria-label", "View larger: " + (it.caption || it.alt || "photo"));
        var img = document.createElement("img");
        img.src = new URL(it.src, gBase).href;
        img.alt = it.alt || it.caption || "Photo of Akshay Kumar Sharma";
        img.loading = "lazy";
        img.decoding = "async";
        btn.appendChild(img);
        li.appendChild(btn);
        if (it.caption || it.date) {
          var cap = document.createElement("p");
          cap.className = "g-cap";
          cap.textContent = (it.caption || "") + (it.date ? (it.caption ? " \u00b7 " : "") + it.date : "");
          li.appendChild(cap);
        }
        galleryGrid.appendChild(li);
      });
      var gChips = document.getElementById("gallery-chips");
      if (gChips && gCats.length > 1) {
        ["All"].concat(gCats).forEach(function (c, n) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "chip";
          b.setAttribute("data-filter", n === 0 ? "all" : c);
          b.setAttribute("aria-pressed", n === 0 ? "true" : "false");
          b.textContent = c;
          gChips.appendChild(b);
        });
        gChips.hidden = false;
      }

      var dlg = document.getElementById("lightbox");
      if (dlg && typeof dlg.showModal === "function") {
        var lbImg = dlg.querySelector(".lb-img");
        var lbCap = dlg.querySelector(".lb-cap");
        var lbIndex = 0;
        var visibleBtns = function () {
          return Array.prototype.slice.call(galleryGrid.querySelectorAll("[data-item]:not([hidden]) .g-btn"));
        };
        var showBtn = function (list, i) {
          var n = (i + list.length) % list.length;
          var b = list[n];
          var it = gItems[Number(b.getAttribute("data-idx"))];
          lbIndex = n;
          lbImg.src = b.querySelector("img").src;
          lbImg.alt = it.alt || it.caption || "Photo";
          lbCap.textContent = (it.caption || "") + (it.date ? (it.caption ? " \u00b7 " : "") + it.date : "");
          var single = list.length < 2;
          dlg.querySelector(".lb-prev").hidden = single;
          dlg.querySelector(".lb-next").hidden = single;
        };
        galleryGrid.addEventListener("click", function (e) {
          var b = e.target.closest(".g-btn");
          if (!b) return;
          var list = visibleBtns();
          showBtn(list, list.indexOf(b));
          dlg.showModal();
        });
        dlg.querySelector(".lb-prev").addEventListener("click", function () { var l = visibleBtns(); showBtn(l, lbIndex - 1); });
        dlg.querySelector(".lb-next").addEventListener("click", function () { var l = visibleBtns(); showBtn(l, lbIndex + 1); });
        dlg.querySelector(".lb-close").addEventListener("click", function () { dlg.close(); });
        dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
        dlg.addEventListener("keydown", function (e) {
          var l = visibleBtns();
          if (e.key === "ArrowLeft") { showBtn(l, lbIndex - 1); }
          if (e.key === "ArrowRight") { showBtn(l, lbIndex + 1); }
        });
      }
    }
  }

  /* ---------- Search + category filters (listing pages) ---------- */
  var list = document.getElementById("filter-list");
  var input = document.getElementById("search-input");
  var chips = document.querySelectorAll(".chip[data-filter]");
  var countEl = document.getElementById("result-count");
  var noResults = document.getElementById("no-results");
  var activeFilter = "all";

  function norm(s) { return (s || "").toLowerCase(); }
  function runFilter() {
    if (!list) return;
    var q = input ? norm(input.value).trim() : "";
    var shown = 0;
    list.querySelectorAll("[data-item]").forEach(function (item) {
      var cats = (item.getAttribute("data-cats") || "").split("|");
      var okCat = activeFilter === "all" || cats.indexOf(activeFilter) !== -1;
      var okQ = !q || norm(item.getAttribute("data-search")).indexOf(q) !== -1;
      var show = okCat && okQ;
      item.hidden = !show;
      if (show) shown++;
    });
    if (countEl) countEl.textContent = shown + (shown === 1 ? " result" : " results");
    if (noResults) noResults.hidden = shown !== 0;
  }
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      activeFilter = c.getAttribute("data-filter");
      chips.forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
      runFilter();
    });
  });
  if (input) input.addEventListener("input", runFilter);

  /* ---------- Share buttons ---------- */
  var copyBtn = document.getElementById("copy-link");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var label = copyBtn.querySelector("span");
      var done = function (msg) { if (label) { var old = label.textContent; label.textContent = msg; setTimeout(function () { label.textContent = old; }, 2000); } };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(location.href).then(function () { done("Link copied"); }, function () { done("Copy failed"); });
      } else { done("Copy not supported"); }
    });
  }

  /* ---------- Contact / collaboration form ---------- */
  var form = document.getElementById("contact-form");
  if (form) {
    var status = document.getElementById("form-status");
    var submitBtn = form.querySelector('button[type="submit"]');
    var tsField = form.querySelector('input[name="ts"]');
    if (tsField) tsField.value = String(Date.now());

    // Preselect inquiry type from the URL (?type=Cyber%20Awareness%20Session)
    try {
      var params = new URLSearchParams(location.search);
      var preset = params.get("type");
      var sel = form.querySelector("select[name=inquiryType]");
      if (preset && sel) {
        Array.prototype.forEach.call(sel.options, function (o) { if (o.value === preset) sel.value = preset; });
      }
    } catch (e) {}

    var rules = {
      name: function (v) { return v.trim().length >= 2 ? "" : "Please enter your full name."; },
      email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "Please enter a valid email address."; },
      inquiryType: function (v) { return v ? "" : "Please choose an inquiry type."; },
      message: function (v) {
        var n = v.trim().length;
        if (n < 20) return "Please write at least 20 characters so I can understand your request.";
        if (n > 3000) return "Please keep the message under 3000 characters.";
        return "";
      },
      consent: function (v, el) { return el.checked ? "" : "Please tick the box to agree before sending."; }
    };
    function showError(name, msg) {
      var el = form.elements[name];
      var err = document.getElementById("err-" + name);
      if (!el || !err) return;
      err.textContent = msg;
      if (msg) { el.setAttribute("aria-invalid", "true"); } else { el.removeAttribute("aria-invalid"); }
    }
    function validate() {
      var firstBad = null;
      Object.keys(rules).forEach(function (name) {
        var el = form.elements[name];
        if (!el) return;
        var msg = rules[name](el.value || "", el);
        showError(name, msg);
        if (msg && !firstBad) firstBad = el;
      });
      return firstBad;
    }
    Object.keys(rules).forEach(function (name) {
      var el = form.elements[name];
      if (!el) return;
      el.addEventListener("blur", function () { showError(name, rules[name](el.value || "", el)); });
    });
    function setStatus(kind, html, focusIt) {
      status.className = "notice " + kind + " form-status";
      status.innerHTML = "";
      var p = document.createElement("p");
      p.textContent = html;
      status.appendChild(p);
      status.hidden = false;
      if (focusIt) status.focus();
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.hidden = true;
      var bad = validate();
      if (bad) { bad.focus(); setStatus("danger", "Please fix the highlighted fields and try again."); return; }

      var endpoint = form.getAttribute("data-endpoint") || "/api/contact";
      var payload = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        payload[el.name] = el.type === "checkbox" ? el.checked : el.value;
      });
      submitBtn.disabled = true;
      var oldLabel = submitBtn.textContent;
      submitBtn.textContent = "Sending...";

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; });
      }).then(function (r) {
        if (r.res.ok && (r.data.ok === undefined || r.data.ok === true)) {
          setStatus("ok", "Thank you. Your message has been delivered. You will get a reply on the email address you provided.", true);
          form.reset();
          if (tsField) tsField.value = String(Date.now());
        } else if (r.data && r.data.errors && !Array.isArray(r.data.errors) && typeof r.data.errors === "object") {
          Object.keys(r.data.errors).forEach(function (k) { showError(k, r.data.errors[k]); });
          setStatus("danger", "Your message was not sent. Please check the highlighted fields.", true);
        } else {
          setStatus("danger", (r.data && r.data.message) || "Your message could not be delivered right now. Please try again later or reach out on LinkedIn.", true);
        }
      }).catch(function () {
        setStatus("danger", "Network problem: your message was NOT sent. Please check your connection and try again, or reach out on LinkedIn.", true);
      }).then(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = oldLabel;
      });
    });
  }

  /* ---------- Theme switch (dark / mix / light) ---------- */
  var themeBtns = document.querySelectorAll("[data-theme-set]");
  function currentTheme() {
    var d = document.documentElement;
    return d.getAttribute("data-theme") === "light" ? (d.hasAttribute("data-mix") ? "mix" : "light") : "dark";
  }
  function setTheme(t) {
    var d = document.documentElement;
    d.setAttribute("data-theme", t === "mix" ? "light" : t);
    if (t === "mix") d.setAttribute("data-mix", "1"); else d.removeAttribute("data-mix");
    try { localStorage.setItem("aks-theme", t); } catch (e) {}
    themeState();
  }
  function themeState() {
    var t = currentTheme();
    themeBtns.forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-theme-set") === t ? "true" : "false"); });
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "light" ? "#f4f7fb" : "#07111f");
  }
  themeBtns.forEach(function (x) { x.addEventListener("click", function () { setTheme(x.getAttribute("data-theme-set")); }); });
  themeState();

  /* ---------- Scroll reveal + count-up (skipped when the visitor prefers reduced motion) ---------- */
  (function () {
    var root = document.documentElement;
    if (root.classList.contains("no-motion") || !("IntersectionObserver" in window)) return;
    var targets = document.querySelectorAll(".section-head, .card, .news-item, .cohead, .impact-item, .page-header .container > *, .prose > h2, .safety-card, .empty");
    var idx = new WeakMap();
    targets.forEach(function (el) {
      if (el.closest("#filter-list") && el.closest("#filter-list").children.length > 40) return;
      var sib = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.transitionDelay = Math.min(sib, 6) * 70 + "ms";
      el.classList.add("reveal");
    });
    function countUp(el) {
      var end = parseFloat(el.getAttribute("data-count")); if (isNaN(end)) return;
      var start = performance.now(), dur = 1100;
      function step(now) { var p = Math.min(1, (now - start) / dur); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target; io.unobserve(el);
        el.classList.add("in");
        el.querySelectorAll("[data-count]").forEach(countUp);
        setTimeout(function () { el.classList.remove("reveal", "in"); el.style.transitionDelay = ""; }, 1100);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
  })();

  applyLang(getLang());
})();

/* Welcome message (bottom card, shown once per visit). Loaded from its own file so this file stays small. */
(function () {
  var me = document.currentScript;
  if (!me || !me.src) return;
  var s = document.createElement("script");
  s.src = me.src.replace(/app\.js(\?.*)?$/, "welcome-toast.js");
  s.defer = true;
  document.head.appendChild(s);
})();
