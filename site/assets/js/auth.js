/* ThreadPass — session handling
 * ---------------------------------------------------------------------------
 * IMPORTANT, AND SAY THIS OUT LOUD IF ANYONE ASKS:
 * This is a browser-side demonstration gate, not real authentication. The
 * account list and the password live in JavaScript the visitor has already
 * downloaded, and the session is a localStorage key they could set themselves.
 * It exists so the demo can show role-based views — Monitor sees the cluster,
 * a unit sees only itself — not to protect anything.
 *
 * Real auth needs a server: a password hash the browser never sees, a session
 * cookie the browser cannot forge, and the role check done server-side before
 * any data is sent. That is a server-rendered build, and the note in
 * PROJECT-NOTES.md covers moving to one.
 */
(function () {
  "use strict";

  var TP = (window.TP = window.TP || {});
  var KEY = "threadpass.session";

  TP.signIn = function (email, password) {
    var target = String(email || "").trim().toLowerCase();
    var account = TP.ACCOUNTS.filter(function (a) {
      return a.email.toLowerCase() === target;
    })[0];

    if (!account) return { ok: false, error: "No account matches that email address." };
    if (password !== TP.PASSWORD) return { ok: false, error: "That password is not correct." };

    var session = {
      email: account.email,
      role: account.role,
      unit: account.unit,
      label: account.label,
      since: new Date().toISOString()
    };

    try { localStorage.setItem(KEY, JSON.stringify(session)); } catch (e) { /* private mode */ }
    return { ok: true, session: session };
  };

  TP.session = function () {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };

  TP.signOut = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    location.href = "signin.html";
  };

  /* Call at the top of every page that should not be readable when signed out.
     Returns the session so the page can branch on role. */
  TP.requireSession = function (opts) {
    var session = TP.session();
    if (!session) { location.replace("signin.html"); return null; }
    if (opts && opts.monitorOnly && session.role !== "MONITOR") {
      location.replace("dashboard.html");
      return null;
    }
    return session;
  };

  /* Which units is this session allowed to see? */
  TP.visibleUnits = function (session) {
    var all = TP.analyseAll();
    if (!session) return [];
    if (session.role === "MONITOR") return all;
    return all.filter(function (a) { return a.unit.slug === session.unit; });
  };
})();
