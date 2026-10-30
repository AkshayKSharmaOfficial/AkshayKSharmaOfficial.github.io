/* Runs first (in <head>): applies the saved theme, enables animations, and shows the one-time intro. */
(function () {
  var d = document.documentElement;
  var t = "dark";
  try { var saved = localStorage.getItem("aks-theme"); if (saved === "light" || saved === "dark" || saved === "mix") t = saved; } catch (e) {}
  /* "mix" = light content with a dark header, hero and footer */
  d.setAttribute("data-theme", t === "mix" ? "light" : t);
  if (t === "mix") d.setAttribute("data-mix", "1"); else d.removeAttribute("data-mix");
  d.classList.add("js");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { d.classList.add("no-motion"); return; }
  try {
    if (!sessionStorage.getItem("aks-intro")) { sessionStorage.setItem("aks-intro", "1"); d.classList.add("intro"); }
  } catch (e) {}
})();
