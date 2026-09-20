/* ThreadPass — shared interface pieces
 * Header, footer, badges, and the small formatting helpers every page needs.
 */
(function () {
  "use strict";

  var TP = (window.TP = window.TP || {});

  /* ---------------------------------------------------------------------
   * Escaping
   * ------------------------------------------------------------------ */

  /* Everything user-facing goes through this before reaching innerHTML.
     Unit names are ours today, but a real deployment takes them from a
     database, and that is exactly where injected markup arrives. */
  TP.esc = function (value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  /* ---------------------------------------------------------------------
   * Theme
   * ------------------------------------------------------------------ */

  var THEME_KEY = "threadpass.theme";

  TP.applyTheme = function () {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  };

  TP.toggleTheme = function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
    var btn = document.getElementById("theme-btn");
    if (btn) btn.textContent = next === "dark" ? "☀" : "☾";
  };

  /* Apply before first paint so the page never flashes the wrong theme. */
  TP.applyTheme();

  /* ---------------------------------------------------------------------
   * Badges
   * ------------------------------------------------------------------ */

  var BADGE_TONE = {
    "Certified": "ok",
    "Normal": "ok",
    "Watch": "watch",
    "Under Review": "watch",
    "Flagged": "flag",
    "Revoked": "flag",
    "Not Yet Eligible": "neutral",
    "Insufficient history": "neutral"
  };

  TP.badge = function (label) {
    var tone = BADGE_TONE[label] || "neutral";
    return '<span class="badge ' + tone + '">' + TP.esc(label) + "</span>";
  };

  /* ---------------------------------------------------------------------
   * Numbers
   * ------------------------------------------------------------------ */

  TP.fmtValue = function (channel, value) {
    if (channel === "ph")   return value.toFixed(2);
    if (channel === "tds")  return String(Math.round(value));
    if (channel === "turb") return value.toFixed(1);
    return value.toFixed(1);
  };

  /* ---------------------------------------------------------------------
   * Page chrome
   * ------------------------------------------------------------------ */

  var NAV = [
    { id: "dashboard",   href: "dashboard.html",   label: "Dashboard" },
    { id: "alerts",      href: "alerts.html",      label: "Alerts" },
    { id: "methodology", href: "methodology.html", label: "Methodology" },
    { id: "admin",       href: "admin.html",       label: "Admin", monitorOnly: true }
  ];

  TP.renderChrome = function (currentId, session) {
    var links = NAV.filter(function (item) {
      return !item.monitorOnly || (session && session.role === "MONITOR");
    }).map(function (item) {
      var current = item.id === currentId ? ' aria-current="page"' : "";
      return '<a href="' + item.href + '"' + current + ">" + TP.esc(item.label) + "</a>";
    }).join("");

    var isDark = document.documentElement.getAttribute("data-theme") === "dark";

    var right = session
      ? '<div class="who"><b>' + TP.esc(session.label) + "</b>" +
        TP.esc(session.role === "MONITOR" ? "Monitor — full cluster" : "Textile unit account") +
        "</div>" +
        '<button class="btn sm" type="button" onclick="TP.signOut()">Sign out</button>'
      : '<a class="btn sm" href="signin.html">Sign in</a>';

    var host = document.getElementById("chrome");
    if (!host) return;

    host.innerHTML =
      '<header class="topbar"><div class="wrap">' +
        '<a class="brand" href="dashboard.html"><b>ThreadPass</b><span>Compliance Monitoring</span></a>' +
        '<nav class="nav">' + links + "</nav>" +
        '<div class="topbar-right">' + right +
          '<button class="icon-btn" id="theme-btn" type="button" title="Switch theme" ' +
          'onclick="TP.toggleTheme()">' + (isDark ? "☀" : "☾") + "</button>" +
        "</div>" +
      "</div></header>" +
      '<div class="simbar"><div class="wrap">' + TP.esc(TP.SIM_NOTICE) + "</div></div>";
  };

  TP.renderFooter = function () {
    var host = document.getElementById("site-footer");
    if (!host) return;
    host.className = "footer";
    host.innerHTML = '<div class="wrap">ThreadPass · Demonstration build. ' +
      "All satellite and sensor readings are simulated; unit names and " +
      "registration numbers are fictional. Not a regulatory certification.</div>";
  };

  /* ---------------------------------------------------------------------
   * Query string
   * ------------------------------------------------------------------ */

  TP.query = function (name) {
    var match = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : null;
  };
})();
